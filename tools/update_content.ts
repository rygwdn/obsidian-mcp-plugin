import { App, TFile } from "obsidian";
import { z } from "zod";
import { ToolRegistration } from "./types";
import { resolvePath } from "./daily_note_utils";

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
		uri: z
			.string()
			.describe(
				"URI to the file or directory (e.g., file:///path/to/file.md, daily:///today, daily:///yesterday, daily:///tomorrow)"
			),
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
			uri: string;
			mode: "append" | "replace";
			content: string;
			find?: string;
			create_if_missing?: boolean;
		}) => {
			const resolved = await resolvePath(app, new URL(args.uri));
			let file = app.vault.getFileByPath(resolved);

			if (args.create_if_missing && !file) {
				file = await app.vault.create(resolved, args.content);
			} else if (!file) {
				throw new Error(`File not found: ${resolved}`);
			}

			const fileContent = await app.vault.read(file);

			if (args.mode === "append") {
				return await append(args.content, fileContent, app, file, resolved);
			} else if (args.mode === "replace") {
				return await replace(args.find, args.content, fileContent, resolved, app, file);
			} else {
				throw new Error(`Invalid mode: ${args.mode}`);
			}
		},
};

async function replace(
	find: string | undefined,
	replacement: string,
	fileContent: string,
	resolved: string,
	app: App,
	file: TFile
) {
	if (!find) {
		throw new Error("'find' parameter is required for replace mode");
	}

	const firstMatch = fileContent.indexOf(find);
	if (firstMatch === -1) {
		throw new Error(`Content not found in file: ${resolved}`);
	}

	const lastMatch = fileContent.lastIndexOf(find);
	if (lastMatch !== firstMatch) {
		throw new Error(
			`Multiple matches found in file: ${resolved}. Please use a more specific search string.`
		);
	}

	const updatedContent = fileContent.replace(find, replacement);

	await app.vault.modify(file, updatedContent);
	return `Content successfully replaced in ${resolved}`;
}

async function append(
	content: string,
	fileContent: string,
	app: App,
	file: TFile,
	resolved: string
) {
	if (!fileContent.endsWith("\n")) {
		content = "\n" + content;
	}

	await app.vault.append(file, content);

	return `Content appended successfully to ${resolved}`;
}
