import { App, TFile } from "obsidian";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReadResourceResult } from "@modelcontextprotocol/sdk/types";
import { UriTemplate, Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import { logger } from "./logging";
import { ALIASES, resolvePath } from "./daily_note_utils";

class SimpleUriTemplate extends UriTemplate {
	constructor(
		template: string,
		private startsWith: string
	) {
		super(template);
	}

	match(uri: string): Variables | null {
		if (uri.startsWith(this.startsWith)) {
			return null;
		}

		return {};
	}
}

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
			logger.withResourceLogging(this.resourceName, async (uri: URL, _variables: Variables) => {
				return await this.handler(uri);
			})
		);
	}

	public get template() {
		const uriTemplate = `${this.resourceName}://{+path}{?depth}{&startOffset}{&endOffset}`;
		return new ResourceTemplate(new SimpleUriTemplate(uriTemplate, this.resourceName + "://"), {
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
			uri: `${this.resourceName}:///${file.path}`,
			mimeType: "text/markdown",
		}));

		return { resources };
	}

	public completePath(value: string) {
		const files = this.app.vault.getMarkdownFiles();
		logger.log(`completePath '${value}' found ${files.length} candidate files`);
		return files.map((file) => file.path).filter((path) => path.startsWith(value));
	}

	public async handler(uri: URL): Promise<ReadResourceResult> {
		if (uri.protocol !== `${this.resourceName}:`) {
			throw new Error(
				"Invalid protocol: " + uri.protocol + " expecting " + this.resourceName + ":"
			);
		}

		const pathVar = await resolvePath(this.app, uri);
		if (!pathVar) {
			throw new Error("File not found: " + uri.toString());
		}

		const depth = parseInt(uri.searchParams.get("depth") ?? "1");
		const startOffset = parseInt(uri.searchParams.get("startOffset") ?? "0");
		const endOffset = uri.searchParams.get("endOffset")
			? parseInt(uri.searchParams.get("endOffset") as string)
			: undefined;

		const file = this.app.vault.getFileByPath(pathVar) as TFile | null;

		if (file) {
			const content = await this.app.vault.cachedRead(file);
			const slicedContent = content.slice(startOffset, endOffset);

			return createResourceResult(uri.toString(), slicedContent);
		}

		const allFilePaths = this.app.vault.getFiles().map((f) => f.path);
		const files = processDirectoryPaths(allFilePaths, pathVar === "/" ? "" : pathVar, depth);

		if (files.length === 0) {
			throw new Error("Not found: " + pathVar);
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
	depth: number = 1
): string[] {
	const matchingFiles = allFilePaths
		.filter((filename) => (dirPath === "" ? true : filename.startsWith(dirPath + "/")))
		.map((filePath) => {
			const relativePath = dirPath ? filePath.slice(dirPath.length + 1) : filePath;
			const parts = relativePath.split("/");
			const path = parts.slice(0, depth).join("/");
			return parts.length > depth ? path + "/" : path;
		});

	return Array.from(new Set(matchingFiles)).sort();
}
