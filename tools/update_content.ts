import { App, normalizePath } from "obsidian";
import { z } from "zod";
import { ToolRegistration } from "./types";

export const updateContentTool: ToolRegistration = {
	name: "update_content",
	description: "Updates file content by either appending or replacing content",
	schema: {
		path: z.string().describe("Path to the file (relative to vault root)"),
		mode: z.enum(["append", "replace"]).describe("Mode: 'append' to add content to the end, 'replace' to find and replace content"),
		content: z.string().describe("Content to add (for append mode) or replacement content (for replace mode)"),
		find: z.string().optional().describe("Content to find and replace (required for replace mode)"),
		create_if_missing: z.boolean().optional().default(false).describe("Create the file if it doesn't exist (only for append mode)"),
	},
	handler: (app: App) => async (args: { 
		path: string; 
		mode: "append" | "replace"; 
		content: string; 
		find?: string;
		create_if_missing?: boolean;
	}) => {
		const filePath = normalizePath(args.path);
		const adapter = app.vault.adapter;
		
		// Check if file exists
		const file = app.vault.getFileByPath(filePath);
		if (!file) {
			if (args.mode === "append" && args.create_if_missing) {
				// Create file if it doesn't exist and create_if_missing is true
				await app.vault.create(filePath, args.content);
				return "File created with content";
			} else {
				throw new Error(`File not found: ${filePath}`);
			}
		}

		const fileContent = await app.vault.read(file);

		if (args.mode === "append") {
			// Append mode - add content to the end
			let updatedContent = fileContent;
			if (!updatedContent.endsWith("\n")) {
				updatedContent += "\n";
			}
			updatedContent += args.content;
			await adapter.write(filePath, updatedContent);
			return "Content appended successfully";
		} else {
			// Replace mode - find and replace content
			if (!args.find) {
				throw new Error("'find' parameter is required for replace mode");
			}

			const findContent = args.find;
			const matches = fileContent.split(findContent).length - 1;

			if (matches === 0) {
				throw new Error(`Content not found in file: ${filePath}`);
			}

			if (matches > 1) {
				throw new Error(
					`Multiple matches (${matches}) found in file: ${filePath}. Please use a more specific search string.`
				);
			}

			const updatedContent = fileContent.replace(findContent, args.content);
			await adapter.write(filePath, updatedContent);
			return `Content successfully replaced in ${filePath}`;
		}
	},
};