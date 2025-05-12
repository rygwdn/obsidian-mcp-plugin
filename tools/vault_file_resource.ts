import { App, normalizePath, TFile } from "obsidian";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReadResourceResult } from "@modelcontextprotocol/sdk/types";
import { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate";
import { logger } from "./logging";
import { ALIASES, resolvePath } from "./daily_note_utils";

export class VaultFileResource {
	protected resourceName: string;
	protected description: string;

	constructor(protected app: App) {
		this.resourceName = "file";
		this.description = "Provides access to files and directories in the Obsidian vault";
	}

	public register(server: McpServer) {
		logger.logResourceRegistration(this.resourceName);

		server.resource(
			this.resourceName,
			this.template,
			{ description: this.description },
			logger.withResourceLogging(this.resourceName, async (uri: URL, variables: Variables) => {
				return await this.handler(uri, variables);
			})
		);
	}

	public get template() {
		const uriTemplate = `${this.resourceName}://{+path}{?depth,startOffset,endOffset}`;
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

		const resources = files.map((file) => ({
			name: file.path,
			uri: `${this.resourceName}://${file.path}`,
			mimeType: "text/markdown",
		}));

		return { resources };
	}

	public completePath(value: string) {
		const files = this.app.vault.getMarkdownFiles();
		logger.log(`completePath '${value}' found ${files.length} candidate files`);
		return files.map((file) => file.path).filter((path) => path.startsWith(value));
	}

	public async handler(uri: URL, variables: Variables): Promise<ReadResourceResult> {
		const pathVar = await resolvePath(this.app, uri);
		if (!pathVar) {
			throw new Error("File not found: " + uri.toString());
		}

		const depth = variables.depth ? parseInt(variables.depth as string) : 1;
		const startOffset = variables.startOffset ? parseInt(variables.startOffset as string) : 0;
		const endOffset = variables.endOffset ? parseInt(variables.endOffset as string) : undefined;

		const file = this.app.vault.getFileByPath(pathVar) as TFile | null;

		if (file) {
			const content = await this.app.vault.cachedRead(file);
			const slicedContent = content.slice(startOffset, endOffset);

			return createResourceResult(uri.toString(), slicedContent);
		}

		const dirPath = pathVar ? normalizePath(pathVar) : "";
		const allFilePaths = this.app.vault.getFiles().map((f) => f.path);
		const files = processDirectoryPaths(allFilePaths, dirPath, depth);

		if (files.length === 0) {
			throw new Error("No files found in path: " + dirPath);
		}

		return createResourceResult(uri.toString(), files.join("\n"), "text/directory");
	}
}

export class VaultDailyNoteResource extends VaultFileResource {
	constructor(app: App) {
		super(app);
		this.resourceName = "daily";
		this.description = "Provides access to daily notes in the Obsidian vault";
	}

	public list() {
		return {
			resources: Object.keys(ALIASES).map((key) => ({
				name: key,
				uri: `${this.resourceName}://${key}`,
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
	depth: number = 1
): string[] {
	const matchingFiles = allFilePaths
		.filter((filename) => (dirPath === "" ? true : filename.startsWith(dirPath + "/")))
		.map((filePath) => {
			const relativePath = dirPath ? filePath.slice(dirPath.length + 1) : filePath;
			const pathSegments = relativePath.split("/");
			return { relativePath, pathSegments };
		})
		.filter((pathDetails) => pathDetails.pathSegments.length <= depth)
		.map((pathDetails) => pathDetails.relativePath);

	return Array.from(new Set(matchingFiles)).sort();
}
