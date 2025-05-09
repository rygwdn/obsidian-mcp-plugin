import { App } from "obsidian";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReadResourceResult } from "@modelcontextprotocol/sdk/types";
import { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate";

export class VaultFileResource {
	constructor(private app: App) {}

	public register(server: McpServer) {
		server.resource(
			"vault-file",
			this.template,
			{ description: "Provides access to files in the Obsidian vault" },
			async (uri, variables) => this.handler(uri, variables)
		);
	}

	public get template() {
		return new ResourceTemplate("vault-file:///{+path}", {
			list: async () => {
				return this.list();
			},
			complete: {
				["+path"]: async (value) => {
					return this.completePath(value);
				},
			},
		});
	}

	public list() {
		const files = this.app.vault.getMarkdownFiles();
		return {
			resources: files.map((file) => ({
				name: file.path,
				uri: `vault-file:///${file.path}`,
				mimeType: "text/markdown",
			})),
		};
	}

	public completePath(value: string) {
		const files = this.app.vault.getMarkdownFiles();
		console.log(
			"completePath",
			value,
			files.map((file) => file.path)
		);
		return files.map((file) => file.path).filter((path) => path.startsWith(value));
	}

	public async handler(uri: URL, variables: Variables): Promise<ReadResourceResult> {
		const filePath = variables.path;
		if (Array.isArray(filePath)) {
			throw new Error("Invalid path: " + filePath);
		}
		const file = this.app.vault.getFileByPath(filePath);
		if (!file) {
			throw new Error("File not found: " + filePath);
		}

		return {
			contents: [
				{
					uri: uri.toString(),
					text: await this.app.vault.read(file),
					mimeType: "text/markdown",
				},
			],
		};
	}
}
