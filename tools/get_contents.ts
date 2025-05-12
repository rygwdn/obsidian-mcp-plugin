import { App } from "obsidian";
import { z } from "zod";
import { ToolRegistration } from "./types";
import { VaultFileResource } from "./vault_file_resource";
import { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate";

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
				"URI to the file or directory (e.g., file://path/to/file.md, file://daily:today, file://daily:yesterday)"
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
		create: z.boolean().optional().describe("Create daily note if it doesn't exist"),
	},
	handler:
		(app: App) =>
		async (args: Record<string, unknown>): Promise<string> => {
			// Create a VaultFileResource instance
			const resource = new VaultFileResource(app);

			// Extract the URI from args
			const uri = args.uri as string;
			if (!uri) {
				throw new Error("URI parameter is required");
			}

			try {
				// Parse the URI and extract path and query parameters
				const url = new URL(uri);

				// Extract path from URL (remove leading slash if present)
				const path = url.pathname.replace(/^\//, "");

				// Build variables object with the path
				const variables: Variables = { path };

				// Add optional parameters if they exist in args
				for (const param of ["depth", "startOffset", "endOffset", "create"]) {
					if (args[param] !== undefined) {
						variables[param] = String(args[param]);
					}
				}

				// Call the handler with parsed URL and variables
				const result = await resource.handler(url, variables);

				// Return the text content of the first item
				if (typeof result.contents[0].text !== "string") {
					throw new Error("Unexpected response type");
				}
				return result.contents[0].text;
			} catch (error) {
				if (error instanceof TypeError && error.message.includes("Invalid URL")) {
					throw new Error(
						`Invalid URI format: ${uri}. Use format like file://path/to/file or file://daily:today`
					);
				}
				throw error;
			}
		},
};
