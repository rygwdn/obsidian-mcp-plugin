import { quickAddExecuteTool, quickAddListTool } from "../tools/quickadd";

import type { Extension } from "./types";

export const quickaddExtension: Extension = {
	id: "quickadd",
	name: "QuickAdd",
	tools: [quickAddListTool, quickAddExecuteTool],
	isAvailable: (obsidian, request) => obsidian.getQuickAdd(request) !== null,
};
