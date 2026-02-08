import { dataviewQueryTool } from "../tools/dataview_query";

import type { Extension } from "./types";

export const dataviewExtension: Extension = {
	id: "dataview_query",
	name: "Dataview",
	tools: [dataviewQueryTool],
	isAvailable: (obsidian, request) => obsidian.getDataview(request) !== null,
};
