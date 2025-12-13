import { z } from "zod";

import type { ObsidianInterface, TaskFilter } from "../obsidian/obsidian_interface";
import type { AuthenticatedRequest } from "../server/auth";

import type { ToolRegistration } from "./types";

const querySchema = {
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
const queryValidator = z.object(querySchema);

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
	schema: querySchema,
	handler: async (
		obsidian: ObsidianInterface,
		request: AuthenticatedRequest,
		args: Record<string, unknown>
	) => {
		const taskNotes = obsidian.getTaskNotes(request);
		if (!taskNotes) {
			throw new Error("TaskNotes plugin is not enabled");
		}

		const parsed = queryValidator.parse(args);

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

const manageSchema = {
	id: z.string().optional().describe("Task ID or file path. Required for update, omit for create."),
	title: z.string().optional().describe("Task title. Required when creating a new task."),
	status: z.string().optional().describe("Task status (e.g., 'todo', 'done')"),
	priority: z.string().optional().describe("Priority level"),
	due: z.string().optional().describe("Due date (YYYY-MM-DD)"),
	tags: z.array(z.string()).optional().describe("Tags"),
	archived: z.boolean().optional().describe("Archive status"),
};
const manageValidator = z.object(manageSchema);

export const taskNotesTool: ToolRegistration = {
	name: "tasknotes",
	description:
		"Create or update a task. Provide 'id' to update an existing task, or omit 'id' and provide 'title' to create a new task.",
	annotations: {
		title: "TaskNotes Tool",
		readOnlyHint: false,
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: false,
	},
	schema: manageSchema,
	handler: async (
		obsidian: ObsidianInterface,
		request: AuthenticatedRequest,
		args: Record<string, unknown>
	) => {
		const taskNotes = obsidian.getTaskNotes(request);
		if (!taskNotes) {
			throw new Error("TaskNotes plugin is not enabled");
		}

		const parsed = manageValidator.parse(args);
		const { id, title, ...updates } = parsed;

		let result;
		if (id) {
			// Update existing task
			const filteredUpdates = Object.fromEntries(
				Object.entries({ title, ...updates }).filter(([_, v]) => v !== undefined)
			);
			result = await taskNotes.updateTask(id, filteredUpdates);
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
