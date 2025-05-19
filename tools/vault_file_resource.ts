import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReadResourceResult } from "@modelcontextprotocol/sdk/types";
import { UriTemplate, Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import { logger } from "./logging";
import { ALIASES, resolveUriToPath } from "./daily_note_utils";
import type { ObsidianInterface } from "../obsidian/obsidian_interface";

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
		const files = this.obsidian.getMarkdownFiles();

		const resources = files.map((file) => ({
			name: file.path,
			uri: `${this.resourceName}:///${file.path}`,
			mimeType: "text/markdown",
		}));

		return { resources };
	}

	public completePath(value: string) {
		const files = this.obsidian.getMarkdownFiles();
		logger.log(`completePath '${value}' found ${files.length} candidate files`);
		return files.map((file) => file.path).filter((path) => path.startsWith(value));
	}

	public async handler(uri: URL): Promise<ReadResourceResult> {
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

		const pathVar = await resolveUriToPath(this.obsidian, uri.toString());

		const depth = parseInt(uri.searchParams.get("depth") ?? "1");
		const startOffset = parseInt(uri.searchParams.get("startOffset") ?? "0");
		const endOffset = uri.searchParams.get("endOffset")
			? parseInt(uri.searchParams.get("endOffset") as string)
			: undefined;

		const checkResult = await this.obsidian.checkFile(pathVar);

		if (checkResult.exists) {
			const content = await this.obsidian.cachedRead(checkResult.file);
			const slicedContent = content.slice(startOffset, endOffset);
			return createResourceResult(uri.toString(), slicedContent);
		}

		const allFilePaths = this.obsidian.getMarkdownFiles().map((f) => f.path);
		const files = processDirectoryPaths(allFilePaths, pathVar === "/" ? "" : pathVar, depth);

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
