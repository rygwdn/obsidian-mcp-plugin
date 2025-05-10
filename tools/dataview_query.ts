import { App } from "obsidian";
import { z } from "zod";
import { ToolRegistration } from "./types";
import { getAPI, isPluginEnabled } from "obsidian-dataview";

export const dataviewQueryTool: ToolRegistration = {
	name: "dataview_query",
	description:
		"Executes a Dataview query against your vault's notes and returns the results in markdown format",
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
			.describe(
				"Dataview query to execute. Can be any valid Dataview query (e.g., 'LIST FROM #tag', 'TABLE field1, field2 FROM \"folder\"', 'TASK WHERE !completed FROM #project')"
			),
	},
	handler: (app: App) => async (args: Record<string, unknown>) => {
		const { query } = args as { query: string };
		if (!isPluginEnabled(app)) {
			throw new Error("Dataview plugin is not enabled");
		}

		const dataviewApi = getAPI(app);
		if (!dataviewApi) {
			throw new Error(
				"Dataview API is not available. Make sure the Dataview plugin is correctly loaded."
			);
		}

		try {
			const queryResult = await dataviewApi.queryMarkdown(query);
			if (!queryResult.successful) {
				throw new Error(`Query execution failed: ${queryResult.error}`);
			}
			return queryResult.value;
		} catch (error) {
			throw new Error(`Error executing Dataview query: ${error.message}`);
		}
	},
};
