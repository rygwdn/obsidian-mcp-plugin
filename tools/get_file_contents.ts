import { App } from "obsidian";
import { z } from "zod";
import { ToolRegistration } from "./types";
import * as DailyNoteUtils from "./daily_note_utils";

export const getFileContentsTool: ToolRegistration = {
	name: "get_file_contents",
	description:
		"Gets the content of a file from the vault, including daily notes using daily:// paths",
	annotations: {
		title: "Get File Contents",
		readOnlyHint: true,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false,
	},
	schema: {
		path: z.string().describe("Path to the file (relative to vault root or daily:// path)"),
		startOffset: z.number().optional().default(0).describe("Start offset defaults to 0"),
		endOffset: z.number().optional().describe("End offset defaults to file length"),
		create: z.boolean().optional().default(false).describe("Create daily note if it doesn't exist"),
	},
	handler:
		(app: App) =>
		async (args: { path: string; startOffset?: number; endOffset?: number; create?: boolean }) => {
			// Resolve the path (handles both daily:// and regular paths)
			const resolved = await DailyNoteUtils.resolvePath(app, args.path, {
				create: args.create ?? false,
				errorOnMissingDailyNotePlugin: true,
			});

			// If the path was resolved but the file doesn't exist
			if (!resolved.file) {
				if (resolved.isDailyNote) {
					throw new Error(
						`Daily note not found: ${resolved.dateStr}. Use create: true parameter to create it.`
					);
				} else {
					throw new Error("File not found: " + resolved.path);
				}
			}

			// Read the file content
			const content = await app.vault.cachedRead(resolved.file);
			const start = args.startOffset ?? 0;
			const end = args.endOffset ?? content.length;

			return content.slice(start, end);
		},
};
