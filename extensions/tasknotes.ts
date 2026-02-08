import { taskNotesQueryTool, taskNotesTool } from "../tools/tasknotes";

import type { Extension } from "./types";

export const tasknotesExtension: Extension = {
	id: "tasknotes",
	name: "TaskNotes",
	tools: [taskNotesQueryTool, taskNotesTool],
	isAvailable: (obsidian, request) => obsidian.getTaskNotes(request) !== null,
};
