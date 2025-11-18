import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReadResourceResult } from "@modelcontextprotocol/sdk/types";
import { UriTemplate, Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol";
import { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types";
import { logger } from "./logging";
import { ALIASES, resolveUriToPath } from "./daily_note_utils";
import type { ObsidianInterface } from "../obsidian/obsidian_interface";
import { isDirectoryAccessibleWithToken } from "./permissions";
import { AuthenticatedRequest, getRequest } from "server/auth";
import { AuthToken } from "settings/types";

class SimpleUriTemplate extends UriTemplate {
	constructor(
		template: string,
		private startsWith: string
	) {
		super(template);
	}

	match(uri: string): Variables | null {
		if (uri.startsWith(this.startsWith)) {
			return {};
		}

		return null;
	}
}

export class VaultFileResource {
	protected resourceName: string;
	protected description: string;

	constructor(protected obsidian: ObsidianInterface) {
		this.resourceName = "file";
		this.description = "Provides access to files and directories in the Obsidian vault";
	}

	public register(server: McpServer) {
		server.resource(
			this.resourceName,
			this.template,
			{ description: this.description },
			logger.withResourceLogging(
				this.resourceName,
				async (
					uri: URL,
					_variables: Variables,
					extra: RequestHandlerExtra<ServerRequest, ServerNotification>
				) => {
					return await this.handler(uri, extra);
				}
			)
		);
	}

	public get template() {
		const uriTemplate = `${this.resourceName}://{+path}{?depth}{&startOffset}{&endOffset}`;
		return new ResourceTemplate(new SimpleUriTemplate(uriTemplate, this.resourceName + "://"), {
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
		const resources = files.map((file) => ({
			name: file.path,
			uri: `${this.resourceName}:///${file.path}`,
			mimeType: "text/markdown",
		}));

		return { resources };
	}

	public completePath(value: string, request: AuthenticatedRequest) {
		const files = this.obsidian.getMarkdownFiles(request);
		logger.log(`completePath '${value}' found ${files.length} candidate files`);
		return files.map((file) => file.path).filter((path) => path.startsWith(value));
	}

	public async handler(
		uri: URL,
		extra?: RequestHandlerExtra<ServerRequest, ServerNotification> | AuthenticatedRequest
	): Promise<ReadResourceResult> {
		if (uri.protocol !== `${this.resourceName}:`) {
			throw new Error(
				"Invalid protocol: " +
					uri.protocol +
					" expecting " +
					this.resourceName +
					": for " +
					uri.toString()
			);
		}

		const request = getRequest(extra);

		const pathVar = await resolveUriToPath(this.obsidian, uri.toString());

		const depth = parseInt(uri.searchParams.get("depth") ?? "1");
		const startOffset = parseInt(uri.searchParams.get("startOffset") ?? "0");
		const endOffset = uri.searchParams.get("endOffset")
			? parseInt(uri.searchParams.get("endOffset") as string)
			: undefined;

		const checkResult = await this.obsidian.checkFile(pathVar, request);

		if (checkResult.exists) {
			if (!checkResult.isAccessible) {
				throw new Error(`Access denied: ${pathVar}`);
			}
			const content = await this.obsidian.cachedRead(checkResult.file, request);
			const slicedContent = content.slice(startOffset, endOffset);
			return createResourceResult(uri.toString(), slicedContent);
		}

		if (!isDirectoryAccessibleWithToken(pathVar === "/" ? "" : pathVar, request.token)) {
			throw new Error(`Access denied: ${pathVar}`);
		}

		const allFiles = this.obsidian.getMarkdownFiles(request);
		const allFilePaths = allFiles.map((f) => f.path);
		const files = processDirectoryPaths(
			allFilePaths,
			pathVar === "/" ? "" : pathVar,
			depth,
			request?.token
		);

		if (files.length === 0) {
			throw new Error("File not found: " + pathVar);
		}

		return createResourceResult(uri.toString(), files.join("\n"), "text/directory");
	}
}

export class VaultDailyNoteResource extends VaultFileResource {
	constructor(obsidian: ObsidianInterface) {
		super(obsidian);
		this.resourceName = "daily";
		this.description = "Provides access to daily notes in the Obsidian vault";
	}

	public list(_request: AuthenticatedRequest) {
		// Note: request parameter is required for consistency with parent class,
		// but daily notes don't require permission checks as they're aliases
		return {
			resources: Object.keys(ALIASES).map((key) => ({
				name: key,
				uri: `${this.resourceName}:///${key}`,
				mimeType: "text/markdown",
			})),
		};
	}

	public completePath(value: string) {
		return Object.keys(ALIASES).filter((key) => key.startsWith(value));
	}
}

function createResourceResult(
	uri: string,
	text: string,
	mimeType: string = "text/markdown"
): ReadResourceResult {
	return {
		contents: [
			{
				uri: uri.toString(),
				text,
				mimeType,
			},
		],
	};
}

function processDirectoryPaths(
	allFilePaths: string[],
	dirPath: string,
	depth: number = 1,
	token?: AuthToken
): string[] {
	const matchingFiles = allFilePaths
		.filter((filename) => {
			if (dirPath === "") return true;
			if (!filename.startsWith(dirPath + "/")) return false;
			if (!token) return true;
			const parentDir = filename.substring(0, filename.lastIndexOf("/"));
			return isDirectoryAccessibleWithToken(parentDir, token);
		})
		.map((filePath) => {
			const relativePath = dirPath ? filePath.slice(dirPath.length + 1) : filePath;
			const parts = relativePath.split("/");
			const path = parts.slice(0, depth).join("/");
			return parts.length > depth ? path + "/" : path;
		});

	return Array.from(new Set(matchingFiles)).sort();
}
