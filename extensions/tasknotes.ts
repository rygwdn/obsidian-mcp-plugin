import { taskNotesQueryTool, taskNotesTool } from "../tools/tasknotes";
import { timeblocksQueryTool, timeblocksTool } from "../tools/timeblocks";

import type { Extension } from "./types";

export const tasknotesExtension: Extension = {
	id: "tasknotes",
	name: "TaskNotes",
	tools: [taskNotesQueryTool, taskNotesTool, timeblocksQueryTool, timeblocksTool],
	isAvailable: (obsidian, request) =>
		obsidian.getTaskNotes(request) !== null || obsidian.getTimeblocks(request) !== null,
};
