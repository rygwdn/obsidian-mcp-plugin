import { App } from "obsidian";
import { z } from "zod";
import { ToolRegistration } from "./types";
import * as DailyNoteUtils from "./daily_note_utils";

export const updateContentTool: ToolRegistration = {
	name: "update_content",
	description:
		"Updates file content by either appending or replacing content, including daily notes",
	annotations: {
		title: "Update File Content",
		readOnlyHint: false,
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: false,
	},
	schema: {
		path: z.string().describe("Path to the file (relative to vault root or daily:// path)"),
		mode: z
			.enum(["append", "replace"])
			.describe("Mode: 'append' to add content to the end, 'replace' to find and replace content"),
		content: z
			.string()
			.describe("Content to add (for append mode) or replacement content (for replace mode)"),
		find: z.string().optional().describe("Content to find and replace (required for replace mode)"),
		create_if_missing: z
			.boolean()
			.optional()
			.default(false)
			.describe(
				"Create the file if it doesn't exist (applies to both regular files and daily notes)"
			),
	},
	handler:
		(app: App) =>
		async (args: {
			path: string;
			mode: "append" | "replace";
			content: string;
			find?: string;
			create_if_missing?: boolean;
		}) => {
			// Resolve the path (handles both daily:// and regular paths)
			const resolved = await DailyNoteUtils.resolvePath(app, args.path, {
				create: args.create_if_missing ?? false,
				errorOnMissingDailyNotePlugin: true,
			});

			// If file doesn't exist after trying to resolve it
			if (!resolved.file) {
				if (resolved.isDailyNote) {
					if (args.create_if_missing) {
						// Try to create it again explicitly and verify success
						const createdFile = await DailyNoteUtils.getDailyNoteFile(app, resolved.dateStr, true);

						if (!createdFile) {
							throw new Error(`Failed to create daily note: ${resolved.dateStr}`);
						}

						// If we're in append mode, we add content directly to new file
						if (args.mode === "append") {
							await app.vault.modify(createdFile, args.content);
							return `Daily note created for ${resolved.dateStr} with content`;
						}

						// For replace mode, we continue with the newly created file
						resolved.file = createdFile;
					} else {
						throw new Error(
							`Daily note not found: ${resolved.dateStr}. Use create_if_missing: true parameter to create it.`
						);
					}
				} else if (args.create_if_missing) {
					// For regular files, create it with initial content
					await app.vault.create(resolved.path, args.content);
					return "File created with content";
				} else {
					throw new Error(`File not found: ${resolved.path}`);
				}
			}

			// At this point we have a valid file
			const fileContent = await app.vault.read(resolved.file);

			if (args.mode === "append") {
				// Append mode - add content to the end
				let updatedContent = fileContent;
				if (!updatedContent.endsWith("\n")) {
					updatedContent += "\n";
				}
				updatedContent += args.content;

				if (resolved.isDailyNote) {
					await app.vault.modify(resolved.file, updatedContent);
					return `Content appended successfully to daily note: ${resolved.dateStr}`;
				} else {
					await app.vault.adapter.write(resolved.path, updatedContent);
					return "Content appended successfully";
				}
			} else {
				// Replace mode - find and replace content
				if (!args.find) {
					throw new Error("'find' parameter is required for replace mode");
				}

				const findContent = args.find;
				const matches = fileContent.split(findContent).length - 1;

				if (matches === 0) {
					if (resolved.isDailyNote) {
						throw new Error(`Content not found in daily note: ${resolved.dateStr}`);
					} else {
						throw new Error(`Content not found in file: ${resolved.path}`);
					}
				}

				if (matches > 1) {
					if (resolved.isDailyNote) {
						throw new Error(
							`Multiple matches (${matches}) found in daily note: ${resolved.dateStr}. Please use a more specific search string.`
						);
					} else {
						throw new Error(
							`Multiple matches (${matches}) found in file: ${resolved.path}. Please use a more specific search string.`
						);
					}
				}

				const updatedContent = fileContent.replace(findContent, args.content);

				if (resolved.isDailyNote) {
					await app.vault.modify(resolved.file, updatedContent);
					return `Content successfully replaced in daily note: ${resolved.dateStr}`;
				} else {
					await app.vault.adapter.write(resolved.path, updatedContent);
					return `Content successfully replaced in ${resolved.path}`;
				}
			}
		},
};
