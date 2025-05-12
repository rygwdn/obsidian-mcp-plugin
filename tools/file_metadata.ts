import { App } from "obsidian";
import { z } from "zod";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReadResourceResult } from "@modelcontextprotocol/sdk/types";
import { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate";
import { ToolRegistration } from "./types";
import { logger } from "./logging";

export function generateFileMetadata(app: App, filePath: string): string {
	const file = app.vault.getFileByPath(filePath);
	if (!file) {
		throw new Error(`File not found: ${filePath}`);
	}

	const fileCache = app.metadataCache.getFileCache(file);
	if (!fileCache) {
		throw new Error(`No metadata found for file: ${filePath}`);
	}

	let result = `# File Metadata: ${file.path}\n\n`;

	result += `- **path**: ${file.path}\n`;
	result += `- **size**: ${file.stat.size} bytes\n`;
	result += `- **created**: ${new Date(file.stat.ctime).toISOString()}\n`;
	result += `- **modified**: ${new Date(file.stat.mtime).toISOString()}\n\n`;

	if (fileCache.frontmatter) {
		result += `## Frontmatter\n\n`;
		for (const [key, value] of Object.entries(fileCache.frontmatter)) {
			result += `- **${key}**: ${value}\n`;
		}
		result += "\n";
	}

	if (fileCache.tags && fileCache.tags.length > 0) {
		result += `## Tags\n\n`;
		for (const tag of fileCache.tags) {
			result += `- ${tag.tag}\n`;
		}
		result += "\n";
	}

	if (fileCache.headings && fileCache.headings.length > 0) {
		result += `## Headings\n\n`;
		for (const heading of fileCache.headings) {
			result += `- (offset: ${heading.position.start.offset}, line: ${heading.position.start.line}): ${"#".repeat(heading.level)} ${heading.heading}\n`;
		}
		result += "\n";
	}

	return result.trim();
}

export const getFileMetadataTool: ToolRegistration = {
	name: "get_file_metadata",
	description: "Retrieve metadata for a specified file",
	annotations: {
		title: "Get File Metadata",
		readOnlyHint: true,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false,
	},
	schema: {
		path: z.string().describe("Path to the file to get metadata for"),
	},
	handler: (app: App) => async (args: Record<string, unknown>) => {
		const path = args.path as string;
		return generateFileMetadata(app, path);
	},
};

export class FileMetadataResource {
	constructor(private app: App) {}

	public register(server: McpServer) {
		logger.logResourceRegistration("metadata");

		server.resource(
			"metadata",
			this.template,
			{ description: "Provides access to file metadata in the Obsidian vault" },
			logger.withResourceLogging("metadata", async (uri: URL, variables: Variables) => {
				return await this.handler(uri, variables);
			})
		);
	}

	public get template() {
		const uriTemplate = `metadata:///{+path}`;
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
				uri: `metadata:///${file.path}`,
				mimeType: "text/markdown",
			})),
		};
	}

	public completePath(value: string) {
		const files = this.app.vault.getMarkdownFiles();
		return files.map((file) => file.path).filter((path) => path.startsWith(value));
	}

	public async handler(uri: URL, variables: Variables): Promise<ReadResourceResult> {
		const filePath = variables.path;
		if (Array.isArray(filePath)) {
			throw new Error("Invalid path: " + filePath);
		}

		return {
			contents: [
				{
					uri: uri.toString(),
					text: generateFileMetadata(this.app, filePath),
					mimeType: "text/markdown",
				},
			],
		};
	}
}
