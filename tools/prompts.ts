import type { TFile } from "../obsidian/obsidian_types";
import { z, ZodType, type ZodTypeAny } from "zod";
import { McpServer, RegisteredPrompt } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	GetPromptResult,
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { logger } from "./logging";
import type { ObsidianInterface } from "../obsidian/obsidian_interface";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol";
import { getRequest } from "../server/auth";

export class VaultPrompt {
	public registration: RegisteredPrompt | undefined;

	constructor(
		public file: TFile,
		private obsidian: ObsidianInterface
	) {}

	private get metadata() {
		// Use unsafe method for prompt registration (no request context available)
		return this.obsidian.unsafeGetPromptFileCache(this.obsidian.settings, this.file);
	}

	public get name() {
		const customName = this.metadata?.frontmatter?.["name"];
		if (customName) {
			return customName as string;
		}

		return this.file.basename;
	}

	public get description() {
		return this.metadata?.frontmatter?.["description"] || "";
	}

	public get args(): Record<string, ZodType> {
		const args = this.metadata?.frontmatter?.["args"] || [];
		if (!args) {
			return {};
		}

		if (Array.isArray(args)) {
			return Object.fromEntries(args.map((arg) => [arg, z.string()]));
		}

		if (typeof args === "string") {
			try {
				return Object.fromEntries(JSON.parse(args).map((arg: string) => [arg, z.string()]));
			} catch (error) {
				logger.logError(`Invalid args: ${args}: ${error}`);
				return {};
			}
		}

		logger.logError(`Invalid args: ${args}`);
		return {};
	}

	public async handler(
		args: Record<string, unknown>,
		extra: RequestHandlerExtra<ServerRequest, ServerNotification>
	): Promise<GetPromptResult> {
		return logger.withPromptLogging(this.name, extra, async () => {
			const request = getRequest(extra);
			const frontmatterPosition = this.metadata?.frontmatterPosition?.end.offset;
			let content = await this.obsidian.cachedRead(this.file, request);
			if (frontmatterPosition) {
				content = content.slice(frontmatterPosition).trimStart();
			}
			// Convert args to strings for template replacement
			const stringArgs: Record<string, string> = {};
			for (const key in args) {
				stringArgs[key] = String(args[key] ?? "");
			}
			for (const key in stringArgs) {
				content = content.replace(new RegExp(`{{${key}}}`, "g"), stringArgs[key]);
			}

			return {
				messages: [{ role: "user" as const, content: { type: "text" as const, text: content } }],
			};
		})(args);
	}

	public async register(server: McpServer) {
		// MCP SDK expects ZodRawShapeCompat which is Record<string, ZodTypeAny>
		// Our args is Record<string, ZodType> which should be compatible
		this.registration = server.prompt(
			this.name,
			this.description,
			this.args as Record<string, ZodTypeAny>,
			async (args, extra) => {
				return await this.handler(args, extra);
			}
		);
	}

	public update() {
		logger.log(`Updating prompt: ${this.name}`);

		// MCP SDK expects ZodRawShapeCompat which is Record<string, ZodTypeAny>
		// Our args is Record<string, ZodType> which should be compatible
		this.registration?.update({
			description: this.description,
			argsSchema: this.args as Record<string, ZodTypeAny>,
		});
	}
}

function getPrompts(obsidian: ObsidianInterface) {
	// Prompts are registered at server startup, not per-request
	// Use unsafe method to get prompt files without permission checks
	return obsidian.unsafeGetPromptFiles(obsidian.settings);
}

function syncPrompts(
	existingPrompts: Map<string, VaultPrompt>,
	obsidian: ObsidianInterface,
	server: McpServer,
	updatedPrompts: TFile[]
) {
	const newPrompts = getPrompts(obsidian);

	for (const promptFile of newPrompts) {
		if (!existingPrompts.has(promptFile.path)) {
			const prompt = new VaultPrompt(promptFile, obsidian);
			existingPrompts.set(promptFile.path, prompt);
			prompt.register(server);
		}
	}
	for (const path of existingPrompts.keys()) {
		if (!newPrompts.find((p) => p.path === path)) {
			existingPrompts.delete(path);
		}
	}
	for (const prompt of updatedPrompts) {
		existingPrompts.get(prompt.path)?.update();
	}
}

export function registerPrompts(obsidian: ObsidianInterface, server: McpServer) {
	const promptMap = new Map<string, VaultPrompt>(
		getPrompts(obsidian).map((p) => [p.path, new VaultPrompt(p, obsidian)])
	);

	logger.log(`Found ${promptMap.size} prompts in folder: ${obsidian.settings.promptsFolder}`);

	obsidian.onFileModified((operation, file) => {
		if (!file.path.startsWith(obsidian.settings.promptsFolder)) {
			return;
		}

		logger.log(`Prompt file ${operation} ${file.path}`);
		if (operation === "delete") {
			promptMap.delete(file.path);
		} else if (operation === "create") {
			if (promptMap.has(file.path)) {
				return;
			}
			const prompt = new VaultPrompt(file, obsidian);
			promptMap.set(file.path, prompt);
			prompt.register(server);
		} else {
			syncPrompts(promptMap, obsidian, server, [file]);
		}
	});

	for (const prompt of promptMap.values()) {
		prompt.register(server);
	}
}
