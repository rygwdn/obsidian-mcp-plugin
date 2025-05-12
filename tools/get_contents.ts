import { App } from "obsidian";
import { z } from "zod";
import { ToolRegistration } from "./types";
import { VaultDailyNoteResource, VaultFileResource } from "./vault_file_resource";

export const getContentsTool: ToolRegistration = {
	name: "get_contents",
	description: "Gets the content of a file or directory from the vault, including daily notes",
	annotations: {
		title: "Get File or Directory Contents",
		readOnlyHint: true,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false,
	},
	schema: {
		uri: z
			.string()
			.describe(
				"URI to the file or directory (e.g., file:///path/to/file.md, daily:///today, daily:///yesterday, daily:///tomorrow)"
			),
		depth: z
			.number()
			.int()
			.min(0)
			.optional()
			.describe(
				"Directory depth to show when listing (0=current dir only, 1=one level of subdirs). Default is 1."
			),
		startOffset: z.number().optional().describe("Start offset for file contents, defaults to 0"),
		endOffset: z
			.number()
			.optional()
			.describe("End offset for file contents, defaults to file length"),
	},
	handler:
		(app: App) =>
		async (args: Record<string, string | number>): Promise<string> => {
			if (!args.uri) {
				throw new Error("URI parameter is required");
			}

			// Convert file:// and daily:// to file:/// and daily:///
			const uri = (args.uri as string).replace(/^(file|daily):\/\/([^/])/, "$1:///$2");

			const resource = uri.startsWith("daily://")
				? new VaultDailyNoteResource(app)
				: new VaultFileResource(app);

			const url = new URL(uri);
			["depth", "startOffset", "endOffset"].forEach((key) => {
				if (args[key] !== undefined) {
					url.searchParams.set(key, String(args[key]));
				}
			});

			const result = await resource.handler(url);
			if (typeof result.contents?.[0]?.text !== "string") {
				throw new Error(`No text found for URI: ${uri}`);
			}
			return result.contents[0].text;
		},
};
