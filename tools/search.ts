import { App, prepareSimpleSearch } from "obsidian";
import { z } from "zod";
import { ToolRegistration } from "./types";

export const searchTool: ToolRegistration = {
  name: "search",
  description: "Searches vault files for the given query and returns matching files",
  schema: {
    query: z.string().describe("Search query")
  },
  handler: (app: App) => async (args: { query: string }) => {
    const query = args.query;
    const results = [];

    const search = prepareSimpleSearch(query);

    for (const file of app.vault.getMarkdownFiles()) {
      const cachedContents = await app.vault.cachedRead(file);
      const result = search(cachedContents);
      if (result) {
        results.push({
          filename: file.path
        });
      }
    }

    if (results.length === 0) {
      throw new Error("No results found for query: " + query);
    }

    return results.map(r => r.filename).join("\n");
  }
};
