import { z } from "zod";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol";
import type { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types";

import type { ObsidianInterface } from "../obsidian/obsidian_interface";
import type { AuthenticatedRequest } from "server/auth";

import { resolveUriToPath } from "./daily_note_utils";
import type { ToolRegistration } from "./types";
import { VaultFileResource } from "./vault_file_resource";

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
	handler: async (
		obsidian: ObsidianInterface,
		request: AuthenticatedRequest,
		args: Record<string, string | number>
	): Promise<string> => {
		if (!args.uri) {
			throw new Error("URI parameter is required");
		}

		const path = await resolveUriToPath(obsidian, args.uri as string);
		const encodedPath = encodeURI(path);
		const url = new URL(`file:///${encodedPath}`);

		["depth", "startOffset", "endOffset"].forEach((key) => {
			if (args[key] !== undefined) {
				url.searchParams.set(key, String(args[key]));
			}
		});

		// Wrap request in extra format for resource handler
		const extra: RequestHandlerExtra<ServerRequest, ServerNotification> = {
			signal: new AbortController().signal,
			requestId: "tool-request",
			sendNotification: async () => {
				// No-op for tool context
			},
			sendRequest: async () => ({}) as never,
			authInfo: {
				token: request.token.token,
				clientId: "tool-client",
				scopes: ["*"],
				extra: {
					request,
				},
			},
		};
		const result = await new VaultFileResource(obsidian).handler(url, extra);
		const content = result.contents?.[0];
		if (!content) {
			throw new Error(`No content found for URI: ${url}`);
		}
		if ("text" in content && typeof content.text === "string") {
			return content.text;
		}
		if ("blob" in content && typeof content.blob === "string") {
			// Convert blob (base64) to text if needed
			return Buffer.from(content.blob, "base64").toString("utf-8");
		}
		throw new Error(`No text or blob found for URI: ${url}`);
	},
};
