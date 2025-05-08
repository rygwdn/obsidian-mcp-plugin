import { App, TFile } from "obsidian";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { MCPPluginSettings } from "settings";

export class VaultPrompt {
	constructor(
		private file: TFile,
		private app: App
	) {}

	public get name() {
		return this.file.basename;
	}

	public get description() {
		return this.app.metadataCache.getFileCache(this.file)?.frontmatter?.["description"] || "";
	}

	public get args() {
		const metadataArgs =
			this.app.metadataCache.getFileCache(this.file)?.frontmatter?.["args"] || "[]";
		const parsedArgs = JSON.parse(metadataArgs) as string[];
		return Object.fromEntries(parsedArgs.map((arg) => [arg, z.string()]));
	}

	public async handler(args: Record<string, string>): Promise<GetPromptResult> {
		let content = await this.app.vault.read(this.file);
		for (const key in args) {
			content = content.replace(new RegExp(`{{${key}}}`, "g"), args[key]);
		}
		return {
			messages: [{ role: "user", content: { type: "text", text: content } }],
		};
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

	for (const prompt of prompts) {
		server.prompt(prompt.name, prompt.description, prompt.args, async (args) => {
			return await prompt.handler(args);
		});
	}
}
