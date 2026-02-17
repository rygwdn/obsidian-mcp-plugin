import type {
	TaskFilter,
	TaskNotesInterface,
	TimeblocksInterface,
} from "../obsidian/obsidian_interface";

import type { Extension, ExtensionTool, ToolContext } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTaskNotes(context: ToolContext): TaskNotesInterface {
	const taskNotes = context.getPlugin("tasknotes") as TaskNotesInterface | null;
	if (!taskNotes) throw new Error("TaskNotes plugin is not enabled");
	return taskNotes;
}

function getTimeblocks(context: ToolContext): TimeblocksInterface {
	const timeblocks = context.getPlugin("timeblocks") as TimeblocksInterface | null;
	if (!timeblocks)
		throw new Error("Timeblocks feature is not enabled or daily notes plugin is not active");
	return timeblocks;
}

// ---------------------------------------------------------------------------
// TaskNotes tools
// ---------------------------------------------------------------------------

export const taskNotesQueryTool: ExtensionTool = {
	name: "tasknotes_query",
	title: "TaskNotes Query Tool",
	description:
		"Query tasks from TaskNotes. By default returns tasks due or scheduled today or earlier (actionable tasks).",
	hints: { readOnly: true, idempotent: true },
	parameters: {
		status: {
			type: "array",
			items: { type: "string" },
			description: "Filter by task status(es)",
		},
		priority: {
			type: "array",
			items: { type: "string" },
			description: "Filter by priority level(s)",
		},
		due_before: {
			type: "string",
			description:
				"Filter tasks due/scheduled on or before this date (YYYY-MM-DD). Defaults to today.",
		},
		tags: { type: "array", items: { type: "string" }, description: "Filter by tag(s)" },
		archived: { type: "boolean", default: false, description: "Include archived tasks" },
		limit: { type: "number", default: 20, description: "Maximum number of tasks to return" },
		include_stats: {
			type: "boolean",
			default: true,
			description: "Include task statistics in response",
		},
	},
	handler: async (args: Record<string, unknown>, context: ToolContext) => {
		const taskNotes = getTaskNotes(context);

		const status = args.status as string[] | undefined;
		const priority = args.priority as string[] | undefined;
		const dueBefore = (args.due_before as string) ?? new Date().toISOString().split("T")[0];
		const archived = (args.archived as boolean) ?? false;
		const tags = args.tags as string[] | undefined;
		const limit = (args.limit as number) ?? 20;
		const includeStats = (args.include_stats as boolean) ?? true;

		const requestLimit = limit + 1;
		const filter: TaskFilter = {
			status,
			priority,
			dueBefore,
			archived,
			tags,
			limit: requestLimit,
		};

		const tasks = await taskNotes.queryTasks(filter);
		const hasMore = tasks.length > limit;
		const returnedTasks = hasMore ? tasks.slice(0, limit) : tasks;

		const result: {
			tasks: typeof returnedTasks;
			hasMore: boolean;
			returned: number;
			stats?: {
				total: number;
				active: number;
				completed: number;
				overdue: number;
				archived: number;
			};
			filterOptions?: { statuses: string[]; priorities: string[] };
		} = { tasks: returnedTasks, hasMore, returned: returnedTasks.length };

		if (includeStats) {
			result.stats = await taskNotes.getStats();
			result.filterOptions = taskNotes.getFilterOptions();
		}

		return JSON.stringify(result, null, 2);
	},
};

export const taskNotesTool: ExtensionTool = {
	name: "tasknotes",
	title: "TaskNotes Tool",
	description:
		"Create or update a task. Provide 'path' to update an existing task, or omit 'path' and provide 'title' to create a new task.",
	hints: { destructive: true },
	parameters: {
		path: {
			type: "string",
			description: "Task file path. Required for update, omit for create.",
		},
		title: {
			type: "string",
			description: "Task title. Required when creating a new task.",
		},
		status: { type: "string", description: "Task status (e.g., 'todo', 'done')" },
		priority: { type: "string", description: "Priority level" },
		due: { type: "string", description: "Due date (YYYY-MM-DD)" },
		tags: { type: "array", items: { type: "string" }, description: "Tags" },
		archived: { type: "boolean", description: "Archive status" },
	},
	handler: async (args: Record<string, unknown>, context: ToolContext) => {
		const taskNotes = getTaskNotes(context);

		const { path, title, ...updates } = args as {
			path?: string;
			title?: string;
			status?: string;
			priority?: string;
			due?: string;
			tags?: string[];
			archived?: boolean;
		};

		let result;
		if (path) {
			const filteredUpdates = Object.fromEntries(
				Object.entries({ title, ...updates }).filter(([_, v]) => v !== undefined)
			);
			result = await taskNotes.updateTask(path, filteredUpdates);
		} else {
			if (!title) {
				throw new Error("Title is required when creating a new task");
			}
			const taskData = Object.fromEntries(
				Object.entries({ title, ...updates }).filter(([_, v]) => v !== undefined)
			) as { title: string; [key: string]: unknown };
			result = await taskNotes.createTask(taskData);
		}

		return JSON.stringify(result, null, 2);
	},
};

// ---------------------------------------------------------------------------
// Timeblocks tools
// ---------------------------------------------------------------------------

export const timeblocksQueryTool: ExtensionTool = {
	name: "timeblocks_query",
	title: "Timeblocks Query Tool",
	description:
		"Query timeblocks for a specific date. Returns time blocks scheduled in the daily note.",
	hints: { readOnly: true, idempotent: true },
	parameters: {
		date: {
			type: "string",
			description:
				"Date in YYYY-MM-DD format or alias (today/yesterday/tomorrow). Defaults to today.",
		},
	},
	handler: async (args: Record<string, unknown>, context: ToolContext) => {
		const timeblocks = getTimeblocks(context);
		const date = (args.date as string) ?? "today";

		const blocks = await timeblocks.getTimeblocks(date);
		return JSON.stringify({ date, timeblocks: blocks }, null, 2);
	},
};

export const timeblocksTool: ExtensionTool = {
	name: "timeblocks",
	title: "Timeblocks Tool",
	description:
		"Create, update, or delete a timeblock. Omit 'id' and provide 'title' to create. Provide 'id' with 'delete: true' to delete. Provide 'id' with other fields to update.",
	hints: { destructive: true },
	parameters: {
		date: {
			type: "string",
			description: "Date in YYYY-MM-DD format or alias (today/yesterday/tomorrow)",
		},
		id: {
			type: "string",
			description: "Timeblock ID. Required for update/delete, omit for create.",
		},
		delete: {
			type: "boolean",
			description: "Set to true to delete the timeblock (requires id)",
		},
		title: { type: "string", description: "Timeblock title. Required when creating." },
		startTime: { type: "string", description: "Start time in HH:MM format (24-hour)" },
		endTime: { type: "string", description: "End time in HH:MM format (24-hour)" },
		attachments: {
			type: "array",
			items: { type: "string" },
			description: "Links to tasks/notes (wikilink format)",
		},
		color: { type: "string", description: "Hex color for display (e.g., #6366f1)" },
		description: { type: "string", description: "Description text" },
	},
	required: ["date"],
	handler: async (args: Record<string, unknown>, context: ToolContext) => {
		const timeblocks = getTimeblocks(context);

		const {
			date,
			id,
			delete: shouldDelete,
			title,
			startTime,
			endTime,
			attachments,
			color,
			description,
		} = args as {
			date: string;
			id?: string;
			delete?: boolean;
			title?: string;
			startTime?: string;
			endTime?: string;
			attachments?: string[];
			color?: string;
			description?: string;
		};

		if (shouldDelete) {
			if (!id) throw new Error("ID is required for delete");
			await timeblocks.deleteTimeblock(date, id);
			return JSON.stringify({ success: true, deleted: id });
		}

		if (id) {
			const updates = Object.fromEntries(
				Object.entries({ title, startTime, endTime, attachments, color, description }).filter(
					([_, v]) => v !== undefined
				)
			);
			const result = await timeblocks.updateTimeblock(date, id, updates);
			return JSON.stringify(result, null, 2);
		}

		if (!title || !startTime || !endTime) {
			throw new Error("title, startTime, and endTime are required when creating a new timeblock");
		}
		const result = await timeblocks.createTimeblock(date, {
			title,
			startTime,
			endTime,
			...(attachments && { attachments }),
			...(color && { color }),
			...(description && { description }),
		});
		return JSON.stringify(result, null, 2);
	},
};

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const tasknotesExtension: Extension = {
	id: "tasknotes",
	name: "TaskNotes",
	tools: [taskNotesQueryTool, taskNotesTool, timeblocksQueryTool, timeblocksTool],
};
