import { z } from "zod";

import type { ObsidianInterface, TaskFilter } from "../obsidian/obsidian_interface";
import type { AuthenticatedRequest } from "../server/auth";
import type { ToolRegistration } from "../tools/types";

import type { Extension } from "./types";

// --- TaskNotes tools ---

const taskQuerySchema = {
	status: z.array(z.string()).optional().describe("Filter by task status(es)"),
	priority: z.array(z.string()).optional().describe("Filter by priority level(s)"),
	due_before: z
		.string()
		.optional()
		.describe("Filter tasks due/scheduled on or before this date (YYYY-MM-DD). Defaults to today."),
	tags: z.array(z.string()).optional().describe("Filter by tag(s)"),
	archived: z.boolean().default(false).describe("Include archived tasks"),
	limit: z.number().default(20).describe("Maximum number of tasks to return"),
	include_stats: z.boolean().default(true).describe("Include task statistics in response"),
};
const taskQueryValidator = z.object(taskQuerySchema);

export const taskNotesQueryTool: ToolRegistration = {
	name: "tasknotes_query",
	description:
		"Query tasks from TaskNotes. By default returns tasks due or scheduled today or earlier (actionable tasks).",
	annotations: {
		title: "TaskNotes Query Tool",
		readOnlyHint: true,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false,
	},
	schema: taskQuerySchema,
	handler: async (
		obsidian: ObsidianInterface,
		request: AuthenticatedRequest,
		args: Record<string, unknown>
	) => {
		const taskNotes = obsidian.getTaskNotes(request);
		if (!taskNotes) {
			throw new Error("TaskNotes plugin is not enabled");
		}

		const parsed = taskQueryValidator.parse(args);

		// Default due_before to today if not specified
		const today = new Date().toISOString().split("T")[0];
		const dueBefore = parsed.due_before ?? today;

		// Request one extra to detect if there are more
		const requestLimit = parsed.limit + 1;

		const filter: TaskFilter = {
			status: parsed.status,
			priority: parsed.priority,
			dueBefore,
			archived: parsed.archived,
			tags: parsed.tags,
			limit: requestLimit,
		};

		const tasks = await taskNotes.queryTasks(filter);
		const hasMore = tasks.length > parsed.limit;
		const returnedTasks = hasMore ? tasks.slice(0, parsed.limit) : tasks;

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
		} = {
			tasks: returnedTasks,
			hasMore,
			returned: returnedTasks.length,
		};

		if (parsed.include_stats) {
			result.stats = await taskNotes.getStats();
			result.filterOptions = taskNotes.getFilterOptions();
		}

		return JSON.stringify(result, null, 2);
	},
};

const taskManageSchema = {
	path: z.string().optional().describe("Task file path. Required for update, omit for create."),
	title: z.string().optional().describe("Task title. Required when creating a new task."),
	status: z.string().optional().describe("Task status (e.g., 'todo', 'done')"),
	priority: z.string().optional().describe("Priority level"),
	due: z.string().optional().describe("Due date (YYYY-MM-DD)"),
	tags: z.array(z.string()).optional().describe("Tags"),
	archived: z.boolean().optional().describe("Archive status"),
};
const taskManageValidator = z.object(taskManageSchema);

export const taskNotesTool: ToolRegistration = {
	name: "tasknotes",
	description:
		"Create or update a task. Provide 'path' to update an existing task, or omit 'path' and provide 'title' to create a new task.",
	annotations: {
		title: "TaskNotes Tool",
		readOnlyHint: false,
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: false,
	},
	schema: taskManageSchema,
	handler: async (
		obsidian: ObsidianInterface,
		request: AuthenticatedRequest,
		args: Record<string, unknown>
	) => {
		const taskNotes = obsidian.getTaskNotes(request);
		if (!taskNotes) {
			throw new Error("TaskNotes plugin is not enabled");
		}

		const parsed = taskManageValidator.parse(args);
		const { path, title, ...updates } = parsed;

		let result;
		if (path) {
			// Update existing task
			const filteredUpdates = Object.fromEntries(
				Object.entries({ title, ...updates }).filter(([_, v]) => v !== undefined)
			);
			result = await taskNotes.updateTask(path, filteredUpdates);
		} else {
			// Create new task
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

// --- Timeblocks tools ---

const timeblocksQuerySchema = {
	date: z
		.string()
		.optional()
		.describe("Date in YYYY-MM-DD format or alias (today/yesterday/tomorrow). Defaults to today."),
};
const timeblocksQueryValidator = z.object(timeblocksQuerySchema);

export const timeblocksQueryTool: ToolRegistration = {
	name: "timeblocks_query",
	description:
		"Query timeblocks for a specific date. Returns time blocks scheduled in the daily note.",
	annotations: {
		title: "Timeblocks Query Tool",
		readOnlyHint: true,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false,
	},
	schema: timeblocksQuerySchema,
	handler: async (
		obsidian: ObsidianInterface,
		request: AuthenticatedRequest,
		args: Record<string, unknown>
	) => {
		const timeblocks = obsidian.getTimeblocks(request);
		if (!timeblocks) {
			throw new Error("Timeblocks feature is not enabled or daily notes plugin is not active");
		}

		const parsed = timeblocksQueryValidator.parse(args);
		const date = parsed.date ?? "today";

		const blocks = await timeblocks.getTimeblocks(date);
		return JSON.stringify({ date, timeblocks: blocks }, null, 2);
	},
};

const timeblocksManageSchema = {
	date: z.string().describe("Date in YYYY-MM-DD format or alias (today/yesterday/tomorrow)"),
	id: z.string().optional().describe("Timeblock ID. Required for update/delete, omit for create."),
	delete: z.boolean().optional().describe("Set to true to delete the timeblock (requires id)"),
	title: z.string().optional().describe("Timeblock title. Required when creating."),
	startTime: z.string().optional().describe("Start time in HH:MM format (24-hour)"),
	endTime: z.string().optional().describe("End time in HH:MM format (24-hour)"),
	attachments: z.array(z.string()).optional().describe("Links to tasks/notes (wikilink format)"),
	color: z.string().optional().describe("Hex color for display (e.g., #6366f1)"),
	description: z.string().optional().describe("Description text"),
};
const timeblocksManageValidator = z.object(timeblocksManageSchema);

export const timeblocksTool: ToolRegistration = {
	name: "timeblocks",
	description:
		"Create, update, or delete a timeblock. Omit 'id' and provide 'title' to create. Provide 'id' with 'delete: true' to delete. Provide 'id' with other fields to update.",
	annotations: {
		title: "Timeblocks Tool",
		readOnlyHint: false,
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: false,
	},
	schema: timeblocksManageSchema,
	handler: async (
		obsidian: ObsidianInterface,
		request: AuthenticatedRequest,
		args: Record<string, unknown>
	) => {
		const timeblocks = obsidian.getTimeblocks(request);
		if (!timeblocks) {
			throw new Error("Timeblocks feature is not enabled or daily notes plugin is not active");
		}

		const parsed = timeblocksManageValidator.parse(args);
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
		} = parsed;

		if (shouldDelete) {
			if (!id) {
				throw new Error("ID is required for delete");
			}
			await timeblocks.deleteTimeblock(date, id);
			return JSON.stringify({ success: true, deleted: id });
		}

		if (id) {
			// Update
			const updates = Object.fromEntries(
				Object.entries({ title, startTime, endTime, attachments, color, description }).filter(
					([_, v]) => v !== undefined
				)
			);
			const result = await timeblocks.updateTimeblock(date, id, updates);
			return JSON.stringify(result, null, 2);
		}

		// Create
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

// --- Extension ---

export const tasknotesExtension: Extension = {
	id: "tasknotes",
	name: "TaskNotes",
	tools: [taskNotesQueryTool, taskNotesTool, timeblocksQueryTool, timeblocksTool],
};
