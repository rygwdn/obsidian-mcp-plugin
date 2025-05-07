import { App, normalizePath, TFile } from "obsidian";
import { z } from "zod";
import { ToolRegistration } from "./types";

export const getFileContentsTool: ToolRegistration = {
	name: "get_file_contents",
	description: "Gets the content of a file from the vault",
	schema: {
		path: z.string().describe("Path to the file (relative to vault root)"),
	},
	handler: (app: App) => async (args: { path: string }) => {
		const filePath = normalizePath(args.path);
		const adapter = app.vault.adapter;
		const fileExists = await adapter.exists(filePath);

		if (fileExists && (await adapter.stat(filePath))?.type === "file") {
			const file = app.vault.getAbstractFileByPath(filePath) as TFile;
			const content = await app.vault.cachedRead(file);
			return content;
		} else {
			throw new Error("File not found: " + filePath);
		}
	},
};
