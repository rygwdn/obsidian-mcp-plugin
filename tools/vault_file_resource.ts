import { App, normalizePath } from "obsidian";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReadResourceResult } from "@modelcontextprotocol/sdk/types";
import { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate";
import { logger } from "./logging";
import * as DailyNoteUtils from "./daily_note_utils";

/**
 * Creates a ReadResourceResult with markdown content
 */
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

/**
 * Process directory paths for listing
 */
function processDirectoryPaths(
	allFilePaths: string[],
	dirPath: string,
	depth: number = 1
): string[] {
	// Filter files that start with our directory path
	const matchingFiles = allFilePaths.filter((filename) =>
		dirPath === "" ? true : filename.startsWith(dirPath + "/")
	);

	// Process matching files according to depth
	const processedPaths = new Set<string>();

	for (const filePath of matchingFiles) {
		// Remove directory prefix if it exists
		const relativePath = dirPath ? filePath.slice(dirPath.length + 1) : filePath;
		const pathSegments = relativePath.split("/");

		if (pathSegments.length === 1) {
			// This is a file in the root of our search
			processedPaths.add(relativePath);
		} else if (depth === 0) {
			// At depth 0, we just want the first directory level
			processedPaths.add(pathSegments[0] + "/");
		} else {
			// For deeper paths
			const segmentsToInclude = Math.min(depth + 1, pathSegments.length);
			const truncatedPath = pathSegments.slice(0, segmentsToInclude).join("/");

			if (segmentsToInclude < pathSegments.length) {
				// This is a directory
				processedPaths.add(truncatedPath + "/");
			} else {
				// This is a file
				processedPaths.add(truncatedPath);
			}
		}
	}

	const files = [...processedPaths];
	files.sort();
	return files;
}

export class VaultFileResource {
	private resourceName = "file";

	constructor(private app: App) {}

	public register(server: McpServer) {
		logger.logResourceRegistration(this.resourceName);

		server.resource(
			this.resourceName,
			this.template,
			{
				description:
					"Provides access to files and directories in the Obsidian vault, including daily notes",
			},
			logger.withResourceLogging(this.resourceName, async (uri: URL, variables: Variables) => {
				return await this.handler(uri, variables);
			})
		);
	}

	public get template() {
		const uriTemplate = `${this.resourceName}://{+path}{?depth,startOffset,endOffset,create}`;
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

		// Regular files with file:// schema
		const resources = files.map((file) => ({
			name: file.path,
			uri: `${this.resourceName}://${file.path}`,
			mimeType: "text/markdown",
		}));

		// Add daily notes resources if enabled
		resources.push(...DailyNoteUtils.listDailyResources(this.app, this.resourceName));

		return { resources };
	}

	public completePath(value: string) {
		// Handle daily note completion
		if (value === DailyNoteUtils.FILE_PREFIX || value.startsWith(DailyNoteUtils.FILE_PREFIX)) {
			return DailyNoteUtils.getDailyCompletions(this.app, value);
		}

		// Handle regular file completion
		const files = this.app.vault.getMarkdownFiles();
		logger.log(`completePath '${value}' found ${files.length} candidate files`);
		return files.map((file) => file.path).filter((path) => path.startsWith(value));
	}

	public async handler(uri: URL, variables: Variables): Promise<ReadResourceResult> {
		const pathVar = variables.path as string;
		const depth = variables.depth ? parseInt(variables.depth as string) : 1;
		const startOffset = variables.startOffset ? parseInt(variables.startOffset as string) : 0;
		const endOffset = variables.endOffset ? parseInt(variables.endOffset as string) : undefined;
		const create = variables.create === "true";

		// Special case for daily directory listing
		if (DailyNoteUtils.isDailyDirectory(pathVar)) {
			if (!DailyNoteUtils.isDailyNotesEnabled(this.app)) {
				throw new Error("Daily notes plugin is not enabled");
			}

			return createResourceResult(
				uri.toString(),
				DailyNoteUtils.getDailyDirectoryContent(),
				"text/directory"
			);
		}

		// Resolve the path (handles both daily: and regular paths)
		const resolved = await DailyNoteUtils.resolvePath(this.app, pathVar, { create });

		// If resolved to a file, return its contents
		if (resolved.file) {
			// Read the file content
			const content = await this.app.vault.cachedRead(resolved.file);
			const slicedContent = content.slice(startOffset, endOffset);

			return createResourceResult(uri.toString(), slicedContent);
		}

		// If it's a resolved daily note without a file and create=false
		if (resolved.isDailyNote && !resolved.exists) {
			throw new Error(
				`Daily note not found: ${resolved.dateStr}. Use create=true parameter to create it.`
			);
		}

		// Handle directory listing
		const dirPath = resolved.path ? normalizePath(resolved.path) : "";
		const allFilePaths = this.app.vault.getFiles().map((f) => f.path);

		// Process directory paths
		const files = processDirectoryPaths(allFilePaths, dirPath, depth);

		// If we're at the root level and daily notes are enabled, add the daily: option
		if (dirPath === "" && DailyNoteUtils.isDailyNotesEnabled(this.app)) {
			files.push(DailyNoteUtils.FILE_PREFIX);
		}

		if (files.length === 0) {
			throw new Error("No files found in path: " + dirPath);
		}

		return createResourceResult(uri.toString(), files.join("\n"), "text/directory");
	}
}
