import type { TFile } from "../obsidian/obsidian_types";
import { z, ZodType } from "zod";
import { McpServer, RegisteredPrompt } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "./logging";
import type { ObsidianInterface } from "../obsidian/obsidian_interface";

export class VaultPrompt {
	public registration: RegisteredPrompt | undefined;

	constructor(
		public file: TFile,
		private obsidian: ObsidianInterface
	) {}

	private get metadata() {
		return this.obsidian.getFileCache(this.file);
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

	public async handler(args: Record<string, string>): Promise<GetPromptResult> {
		return logger.withPromptLogging(this.name, async () => {
			const frontmatterPosition = this.metadata?.frontmatterPosition?.end.offset;
			let content = await this.obsidian.cachedRead(this.file);
			if (frontmatterPosition) {
				content = content.slice(frontmatterPosition).trimStart();
			}
			for (const key in args) {
				content = content.replace(new RegExp(`{{${key}}}`, "g"), args[key]);
			}

			return {
				messages: [{ role: "user" as const, content: { type: "text" as const, text: content } }],
			};
		})(args);
	}

	public async register(server: McpServer) {
		logger.logPromptRegistration(this.name, this.description, Object.keys(this.args));

		this.registration = server.prompt(this.name, this.description, this.args, async (args) => {
			return await this.handler(args);
		});
	}

	public update() {
		logger.log(`Updating prompt: ${this.name}`);

		this.registration?.update({
			description: this.description,
			argsSchema: this.args,
		});
	}
}

function getPrompts(obsidian: ObsidianInterface) {
	return obsidian
		.getMarkdownFiles()
		.filter((file) => file.path.startsWith(obsidian.settings.promptsFolder));
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
