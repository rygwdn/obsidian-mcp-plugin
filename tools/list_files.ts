import { App, normalizePath } from "obsidian";
import { z } from "zod";
import { ToolRegistration } from "./types";
import * as DailyNoteUtils from "./daily_note_utils";

export const listFilesTool: ToolRegistration = {
	name: "list_files",
	description:
		"Lists all files and directories in a specific Obsidian directory (relative to vault root) or daily notes",
	annotations: {
		title: "List Files in Vault",
		readOnlyHint: true,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false,
	},
	schema: {
		path: z
			.string()
			.optional()
			.describe(
				"Path to list files from (relative to vault root or 'daily://') or leave empty for root."
			),
		depth: z
			.number()
			.int()
			.min(0)
			.optional()
			.describe(
				"Directory depth to show (0=current dir only, 1=one level of subdirs, etc). Default is 1."
			),
	},
	handler: (app: App) => async (args: { path?: string; depth?: number }) => {
		// Special case for daily:// path
		if (args.path === DailyNoteUtils.URI_PREFIX || args.path === "daily:") {
			if (!DailyNoteUtils.isDailyNotesEnabled(app)) {
				// Return empty result if daily notes are not enabled, rather than throwing an error
				return "";
			}

			// Return the list of daily note special references
			return DailyNoteUtils.getAvailableDailyPaths().join("\n");
		}

		// Special case for checking if the path is a daily note path
		if (args.path && DailyNoteUtils.isDailyNotePath(args.path)) {
			throw new Error(
				"Cannot list files within a specific daily note. Use get_file_contents with the daily note path instead."
			);
		}

		const dirPath = args.path ? normalizePath(args.path) : "";
		const depth = args.depth !== undefined ? args.depth : 1;

		// Get all files from the vault
		const allFilePaths = app.vault.getFiles().map((f) => f.path);

		// Filter files that start with our directory path
		const matchingFiles = allFilePaths.filter((filename) => filename.startsWith(dirPath));

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

		// If we're at the root level and daily notes are enabled, add the daily:// option
		if (dirPath === "" && DailyNoteUtils.isDailyNotesEnabled(app)) {
			files.push(DailyNoteUtils.URI_PREFIX);
		}

		if (files.length === 0) {
			throw new Error("No files found in path: " + dirPath);
		}

		return files.join("\n");
	},
};
