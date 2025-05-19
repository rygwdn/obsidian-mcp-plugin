import { z } from "zod";
import { ToolRegistration } from "./types";
import type { ObsidianInterface } from "../obsidian/obsidian_interface";

const description = `
Executes a Dataview query against your vault's notes and returns the results in markdown format.
Gets results as LIST, TABLE, or TASK. Queries can be refined with data commands like FROM, WHERE, SORT, GROUP BY, LIMIT, etc.
Can use the WHERE clause with operators (=, !=, >, <, >=, <=), logical operators (AND, OR, NOT), and functions like contains(),
startswith(), endswith(), regexmatch(), etc. e.g. \`WHERE status = \"In Progress\" AND priority > 3\`

Examples:
- LIST: \`LIST FROM #tag\` or \`LIST file.size WHERE file.size > 1000\`
- TABLE: \`TABLE file.ctime, file.tags FROM "folder"\` or \`TABLE WITHOUT ID file.link AS "Name", field\`
- TASK: \`TASK WHERE !completed\` or \`TASK WHERE contains(tags, "#project") GROUP BY file.link\`

For more examples, see the [Dataview Query Examples](https://blacksmithgu.github.io/obsidian-dataview/queries/query-types/).
`;

export const dataviewQueryTool: ToolRegistration = {
	name: "dataview_query",
	description: description,
	annotations: {
		title: "Execute Dataview Query",
		readOnlyHint: true,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false,
	},
	schema: {
		query: z
			.string()
			.describe("Dataview query to execute. See tool description for examples and documentation."),
	},
	handler: (obsidian: ObsidianInterface) => async (args: Record<string, unknown>) => {
		const { query } = args as { query: string };
		if (!obsidian.dataview) {
			throw new Error("Dataview plugin is not enabled");
		}

		try {
			const queryResult = await obsidian.dataview.queryMarkdown(query);

			if (!queryResult.successful) {
				throw new Error(`Query execution failed: ${queryResult.error}`);
			}
			return queryResult.value ?? "";
		} catch (error) {
			throw new Error(`Error executing Dataview query: ${error.message}`);
		}
	},
};
