import { App } from "obsidian";
import { z } from "zod";
import { ToolRegistration } from "./types";
import { getAPI, isPluginEnabled } from "obsidian-dataview";

const DATAVIEW_DOCS_URL = "https://blacksmithgu.github.io/obsidian-dataview/";
const QUERY_TYPES_DOCS_URL = `${DATAVIEW_DOCS_URL}queries/query-types/`;

const QUERY_TYPES_DESCRIPTION =
	"- LIST: Outputs a bullet point list of files with optional additional information. Example: `LIST file.mtime FROM #tag`\n" +
	'- TABLE: Outputs a tabular view with multiple columns. Example: `TABLE field1, field2 AS "Custom Header" FROM "folder"`\n' +
	"- TASK: Outputs an interactive list of tasks (operates at task level, not page level). Example: `TASK WHERE !completed FROM #project`\n" +
	'- CALENDAR: Outputs a monthly calendar view (requires a date field). Example: `CALENDAR file.ctime FROM "folder"`';

const QUERY_EXAMPLES =
	"- LIST: `LIST FROM #tag` or `LIST file.size WHERE file.size > 1000`\n" +
	'- TABLE: `TABLE file.ctime, file.tags FROM "folder"` or `TABLE WITHOUT ID file.link AS "Name", field`\n' +
	'- TASK: `TASK WHERE !completed` or `TASK WHERE contains(tags, "#project") GROUP BY file.link`\n' +
	'- CALENDAR: `CALENDAR due FROM #project WHERE typeof(due) = "date"`';

const FILTERING_DESCRIPTION =
	"For filtering, you can use the WHERE clause with operators (=, !=, >, <, >=, <=), logical operators (AND, OR, NOT), and functions like contains(), startswith(), endswith(), regexmatch(), etc.";

const FILTERING_EXAMPLES =
	'- Basic comparison: `WHERE status = "In Progress" AND priority > 3`\n' +
	"- Date comparison: `WHERE file.mtime >= date(2023-01-01) AND file.mtime <= date(today)`\n" +
	'- Text functions: `WHERE contains(file.tags, "#important") OR startswith(file.name, "Project")`\n' +
	'- Types and existence: `WHERE typeof(due) = "date" AND exists(priority)`';

const DATA_COMMANDS =
	"Queries can be refined with data commands like FROM, WHERE, SORT, GROUP BY, LIMIT, etc.";

export const dataviewQueryTool: ToolRegistration = {
	name: "dataview_query",
	description:
		"Executes a Dataview query against your vault's notes and returns the results in markdown format. Supports four query types:\n" +
		`${QUERY_TYPES_DESCRIPTION}\n` +
		`${DATA_COMMANDS}\n` +
		`${FILTERING_DESCRIPTION}\n` +
		`Documentation: ${DATAVIEW_DOCS_URL}`,
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
				"Dataview query to execute. Examples:\n" +
					`${QUERY_EXAMPLES}\n` +
					"Filtering examples:\n" +
					`${FILTERING_EXAMPLES}\n` +
					`Documentation: ${QUERY_TYPES_DOCS_URL}`
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
