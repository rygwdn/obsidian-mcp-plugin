import { App, TFile } from "obsidian";
import { z, ZodType } from "zod";
import { McpServer, RegisteredPrompt } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { MCPPluginSettings } from "../settings/types";
import { logger } from "./logging";

export class VaultPrompt {
	public registration: RegisteredPrompt | undefined;

	constructor(
		public file: TFile,
		private app: App
	) {}

	private get metadata() {
		return this.app.metadataCache.getFileCache(this.file);
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
		const parsedArgs: string[] =
			typeof args === "string" ? JSON.parse(args) : Array.isArray(args) ? args : [];
		return Object.fromEntries(parsedArgs.map((arg) => [arg, z.string()]));
	}

	public async handler(args: Record<string, string>): Promise<GetPromptResult> {
		return logger.withPromptLogging(this.name, async () => {
			const frontmatterPosition = this.metadata?.frontmatterPosition?.end.offset;
			let content = await this.app.vault.cachedRead(this.file);
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

export function getPrompts(app: App, settings: MCPPluginSettings) {
	return app.vault
		.getMarkdownFiles()
		.filter((file) => file.path.startsWith(settings.promptsFolder))
		.map((file) => new VaultPrompt(file, app));
}

export function registerPrompts(app: App, server: McpServer, settings: MCPPluginSettings) {
	const prompts = getPrompts(app, settings);
	logger.log(`Found ${prompts.length} prompts in folder: ${settings.promptsFolder}`);

	app.vault.on("modify", (file) => {
		if (file.path.startsWith(settings.promptsFolder)) {
			logger.log(`Prompt file modified: ${file.path}`);
			const prompt = prompts.find((prompt) => prompt.file.path === file.path);
			prompt?.update();
		}
	});

	for (const prompt of prompts) {
		prompt.register(server);
	}
}
