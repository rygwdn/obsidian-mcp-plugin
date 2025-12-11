import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
	ReadResourceResult,
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types";
import type { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol";

import type { ObsidianInterface } from "../obsidian/obsidian_interface";
import type { AuthenticatedRequest } from "server/auth";
import { getRequest } from "server/auth";

import { resolveUriToPath } from "./daily_note_utils";
import { logger } from "./logging";
import type { ToolRegistration } from "./types";

export async function generateFileMetadata(
	obsidian: ObsidianInterface,
	filePath: string,
	request: AuthenticatedRequest
): Promise<string> {
	const file = await obsidian.getFileByPath(filePath, "read", request);

	const fileCache = obsidian.getFileCache(file);
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

	// Add TaskNotes computed fields if available
	const taskNotes = obsidian.getTaskNotes(request);
	if (taskNotes) {
		const taskInfo = taskNotes.getTaskByPath(filePath);
		if (taskInfo) {
			result += `## TaskNotes\n\n`;
			result += `- **id**: ${taskInfo.id}\n`;
			result += `- **status**: ${taskInfo.status}\n`;
			result += `- **priority**: ${taskInfo.priority}\n`;
			if (taskInfo.due) result += `- **due**: ${taskInfo.due}\n`;
			if (taskInfo.scheduled) result += `- **scheduled**: ${taskInfo.scheduled}\n`;
			// Boolean fields use !== undefined to show false values (truthy check would hide them)
			if (taskInfo.isBlocked !== undefined) result += `- **isBlocked**: ${taskInfo.isBlocked}\n`;
			if (taskInfo.isBlocking !== undefined) result += `- **isBlocking**: ${taskInfo.isBlocking}\n`;
			if (taskInfo.totalTrackedTime)
				result += `- **totalTrackedTime**: ${taskInfo.totalTrackedTime}ms\n`;
			if (taskInfo.recurrence) result += `- **recurrence**: ${taskInfo.recurrence}\n`;
			if (taskInfo.contexts?.length) result += `- **contexts**: ${taskInfo.contexts.join(", ")}\n`;
			if (taskInfo.projects?.length) result += `- **projects**: ${taskInfo.projects.join(", ")}\n`;
			result += "\n";
		}
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
		path: z
			.string()
			.describe(
				"URI to the file to get metadata for (e.g., file:///path/to/file.md or daily:///today)"
			),
	},
	handler: async (
		obsidian: ObsidianInterface,
		request: AuthenticatedRequest,
		args: Record<string, unknown>
	) => {
		const vaultPath = await resolveUriToPath(obsidian, args.path as string);
		return await generateFileMetadata(obsidian, vaultPath, request);
	},
};

export class FileMetadataResource {
	constructor(private obsidian: ObsidianInterface) {}

	public register(server: McpServer) {
		server.resource(
			"metadata",
			this.template,
			{ description: "Provides access to file metadata in the Obsidian vault" },
			logger.withResourceLogging(
				"metadata",
				async (
					uri: URL,
					variables: Variables,
					extra: RequestHandlerExtra<ServerRequest, ServerNotification>
				) => {
					return await this.handler(uri, variables, extra);
				}
			)
		);
	}

	public get template() {
		const uriTemplate = `metadata:///{+path}`;
		return new ResourceTemplate(uriTemplate, {
			list: async (extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
				const request = getRequest(extra);
				return this.list(request);
			},
			complete: {
				["+path"]: async (value: string) => {
					// Complete callback doesn't receive extra/request context
					// Use method to get files accessible by ANY token
					const files = this.obsidian.getFilesForAnyToken(this.obsidian.settings);
					return files.map((file) => file.path).filter((path) => path.startsWith(value));
				},
			},
		});
	}

	public list(request: AuthenticatedRequest) {
		const files = this.obsidian.getMarkdownFiles(request);
		return {
			resources: files.map((file) => ({
				name: file.path,
				uri: `metadata:///${file.path}`,
				mimeType: "text/markdown",
			})),
		};
	}

	public completePath(value: string, request: AuthenticatedRequest) {
		const files = this.obsidian.getMarkdownFiles(request);
		logger.log(`completePath '${value}' found ${files.length} candidate files`);
		return files.map((file) => file.path).filter((path) => path.startsWith(value));
	}

	public async handler(
		uri: URL,
		variables: Variables,
		extra?: RequestHandlerExtra<ServerRequest, ServerNotification>
	): Promise<ReadResourceResult> {
		const filePath = variables.path;
		if (Array.isArray(filePath)) {
			throw new Error("Invalid path: " + filePath);
		}

		const request = getRequest(extra);

		return {
			contents: [
				{
					uri: uri.toString(),
					text: await generateFileMetadata(this.obsidian, filePath, request),
					mimeType: "text/markdown",
				},
			],
		};
	}
}
