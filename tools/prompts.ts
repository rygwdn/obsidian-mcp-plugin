import { App, TFile } from "obsidian";
import { z, ZodType } from "zod";
import { McpServer, RegisteredPrompt } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { MCPPluginSettings } from "settings";

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
		const frontmatterPosition = this.metadata?.frontmatterPosition?.end.offset;
		let content = await this.app.vault.cachedRead(this.file);
		if (frontmatterPosition) {
			content = content.slice(frontmatterPosition).trimStart();
		}
		for (const key in args) {
			content = content.replace(new RegExp(`{{${key}}}`, "g"), args[key]);
		}
		return {
			messages: [{ role: "user", content: { type: "text", text: content } }],
		};
	}

	public async register(server: McpServer) {
		this.registration = server.prompt(this.name, this.description, this.args, async (args) => {
			return await this.handler(args);
		});
	}

	public update() {
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

	app.vault.on("modify", (file) => {
		const prompt = prompts.find((prompt) => prompt.file.path === file.path);
		prompt?.update();
	});

	for (const prompt of prompts) {
		prompt.register(server);
	}
}
