import { App } from "obsidian";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReadResourceResult } from "@modelcontextprotocol/sdk/types";
import { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate";
import { logger } from "./logging";

export class VaultFileResource {
	private resourceName: string;

	constructor(
		private app: App,
		prefix: string = "vault"
	) {
		this.resourceName = `${prefix}-file`;
	}

	public register(server: McpServer) {
		logger.logResourceRegistration(this.resourceName);

		server.resource(
			this.resourceName,
			this.template,
			{ description: "Provides access to files in the Obsidian vault" },
			logger.withResourceLogging(this.resourceName, async (uri: URL, variables: Variables) => {
				return await this.handler(uri, variables);
			})
		);
	}

	public get template() {
		const uriTemplate = `${this.resourceName}:///{+path}`;
		return new ResourceTemplate(uriTemplate, {
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
				uri: `${this.resourceName}:///${file.path}`,
				mimeType: "text/markdown",
			})),
		};
	}

	public completePath(value: string) {
		const files = this.app.vault.getMarkdownFiles();
		logger.log(`completePath '${value}' found ${files.length} candidate files`);
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
