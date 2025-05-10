import { App, normalizePath, TFile } from "obsidian";
import { z } from "zod";
import { ToolRegistration } from "./types";

export const getFileContentsTool: ToolRegistration = {
	name: "get_file_contents",
	description: "Gets the content of a file from the vault",
	annotations: {
		title: "Get File Contents",
		readOnlyHint: true,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false,
	},
	schema: {
		path: z.string().describe("Path to the file (relative to vault root)"),
		startOffset: z.number().optional().default(0).describe("Start offset defaults to 0"),
		endOffset: z.number().optional().describe("End offset defaults to file length"),
	},
	handler:
		(app: App) => async (args: { path: string; startOffset?: number; endOffset?: number }) => {
			const filePath = normalizePath(args.path);
			const adapter = app.vault.adapter;
			const fileExists = await adapter.exists(filePath);

			if (fileExists && (await adapter.stat(filePath))?.type === "file") {
				const file = app.vault.getAbstractFileByPath(filePath) as TFile;
				const content = await app.vault.cachedRead(file);
				const start = args.startOffset ?? 0;
				const end = args.endOffset ?? content.length;

				return content.slice(start, end);
			} else {
				throw new Error("File not found: " + filePath);
			}
		},
};
