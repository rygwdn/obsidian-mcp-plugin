import { App, normalizePath } from "obsidian";
import { z } from "zod";
import { ToolRegistration } from "./types";

export const replaceContentTool: ToolRegistration = {
	name: "replace_content",
	description:
		"Replaces specific content in a file with new content, failing if not found or multiple matches",
	schema: {
		path: z.string().describe("Path to the file (relative to vault root)"),
		find: z.string().describe("Content to find and replace"),
		replace: z.string().describe("New content to replace the found content with"),
	},
	handler: (app: App) => async (args: { path: string; find: string; replace: string }) => {
		const filePath = normalizePath(args.path);
		const findContent = args.find;
		const replaceContent = args.replace;

		// Check if file exists
		const file = app.vault.getFileByPath(filePath);
		if (!file) {
			throw new Error(`File not found: ${filePath}`);
		}

		// Read file content
		const fileContent = await app.vault.read(file);

		// Find occurrences
		const matches = fileContent.split(findContent).length - 1;

		if (matches === 0) {
			throw new Error(`Content not found in file: ${filePath}`);
		}

		if (matches > 1) {
			throw new Error(
				`Multiple matches (${matches}) found in file: ${filePath}. Please use a more specific search string.`
			);
		}

		// Replace content
		const updatedContent = fileContent.replace(findContent, replaceContent);

		// Write updated content back to file
		await app.vault.adapter.write(filePath, updatedContent);

		return `Content successfully replaced in ${filePath}`;
	},
};
