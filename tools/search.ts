import { z } from "zod";
import { ToolRegistration } from "./types";
import type { ObsidianInterface } from "../obsidian/obsidian_interface";
import { AuthenticatedRequest } from "server/auth";

export const searchTool: ToolRegistration = {
	name: "search",
	description: "Searches vault files for the given query and returns matching files",
	annotations: {
		title: "Search Vault Files",
		readOnlyHint: true,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false,
	},
	schema: {
		query: z.string().describe("Search query"),
		limit: z.number().default(100).describe("Limit the number of results"),
		fuzzy: z.boolean().default(false).describe("Use fuzzy search"),
		folder: z.string().optional().describe("Search under specific folder"),
	},
	handler: async (
		obsidian: ObsidianInterface,
		request: AuthenticatedRequest,
		args: {
			query: string;
			limit: number;
			fuzzy: boolean;
			folder?: string;
		}
	) => {
		const query = args.query;

		const allMatches = await obsidian.search(query, args.fuzzy, args.folder, request);
		const totalMatches = allMatches.flatMap((m) => m.matches).length;

		if (totalMatches === 0) {
			throw new Error("No results found for query: " + query);
		}
		const lines = [`# ${Math.min(args.limit, totalMatches)} of ${totalMatches} matches:`, ""];

		let remainingMatches = args.limit;

		for (const { matches, cachedContents, file } of allMatches) {
			lines.push(`## file:///${file.path}\n`);

			for (const match of matches) {
				if (remainingMatches <= 0) break;
				lines.push(...writeMatch(match, cachedContents));
				remainingMatches--;
			}

			if (remainingMatches <= 0) break;
			lines.push("");
		}

		return lines.join("\n");
	},
};

function writeMatch([start, end]: [number, number], cachedContents: string) {
	const { startOffset, endOffset } = getOffsets(start, end, cachedContents);
	const matchLines = cachedContents.slice(startOffset, endOffset).split("\n");

	return [`@[${start}, ${end}]`, ...matchLines.map((l) => `> ${l}`), ""];
}

function getOffsets(start: number, end: number, contents: string) {
	let startOffset = start;
	while (startOffset > 0 && contents[startOffset - 1] !== "\n" && start - startOffset < 100) {
		startOffset--;
	}

	let endOffset = end;
	while (endOffset < contents.length && contents[endOffset] !== "\n" && endOffset - end < 100) {
		endOffset++;
	}

	return { startOffset, endOffset };
}
