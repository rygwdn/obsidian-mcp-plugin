import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
	ReadResourceResult,
	ServerNotification,
	ServerRequest,
} from "@modelcontextprotocol/sdk/types";
import type { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol";

import type { ObsidianInterface, TaskFilter } from "../obsidian/obsidian_interface";
import type { AuthenticatedRequest } from "../server/auth";
import { getRequest } from "../server/auth";

import { logger } from "./logging";
import type { ToolRegistration } from "./types";

const querySchema = {
	status: z.array(z.string()).optional().describe("Filter by task status(es)"),
	priority: z.array(z.string()).optional().describe("Filter by priority level(s)"),
	due_before: z.string().optional().describe("Filter tasks due before this date (YYYY-MM-DD)"),
	due_after: z.string().optional().describe("Filter tasks due after this date (YYYY-MM-DD)"),
	archived: z.boolean().optional().describe("Filter by archived status"),
	tags: z.array(z.string()).optional().describe("Filter by tag(s)"),
	contexts: z.array(z.string()).optional().describe("Filter by context(s)"),
	projects: z.array(z.string()).optional().describe("Filter by project(s)"),
	limit: z.number().default(50).describe("Maximum number of tasks to return"),
	offset: z.number().default(0).describe("Number of tasks to skip"),
	sort_by: z.string().optional().describe("Field to sort by"),
	sort_direction: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
};
const queryValidator = z.object(querySchema);

export const taskNotesQueryTool: ToolRegistration = {
	name: "tasknotes_query",
	description:
		"Query tasks with filtering. See tasknotes:///stats resource for available filter options like statuses, priorities, contexts, and projects.",
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

		const filter: TaskFilter = {
			status: parsed.status,
			priority: parsed.priority,
			due:
				parsed.due_before || parsed.due_after
					? { before: parsed.due_before, after: parsed.due_after }
					: undefined,
			archived: parsed.archived,
			tags: parsed.tags,
			contexts: parsed.contexts,
			projects: parsed.projects,
			limit: parsed.limit,
			offset: parsed.offset,
			sortBy: parsed.sort_by,
			sortDirection: parsed.sort_direction,
		};

		const tasks = taskNotes.queryTasks(filter);
		return JSON.stringify(tasks, null, 2);
	},
};

const updateSchema = {
	id: z.string().min(1).describe("Task ID or file path (required)"),
	toggle_status: z.boolean().optional().describe("Toggle the task status"),
	complete_instance: z.boolean().optional().describe("Complete a recurring instance"),
	instance_date: z.string().optional().describe("Date of the recurring instance (YYYY-MM-DD)"),
	status: z.string().optional().describe("New task status"),
	priority: z.string().optional().describe("New priority level"),
	due: z.string().optional().describe("New due date (YYYY-MM-DD)"),
	scheduled: z.string().optional().describe("New scheduled date (YYYY-MM-DD)"),
	title: z.string().optional().describe("New task title"),
	tags: z.array(z.string()).optional().describe("New tags"),
	contexts: z.array(z.string()).optional().describe("New contexts"),
	projects: z.array(z.string()).optional().describe("New projects"),
	archived: z.boolean().optional().describe("Archive status"),
};
const updateValidator = z.object(updateSchema);

export const taskNotesUpdateTool: ToolRegistration = {
	name: "tasknotes_update",
	description:
		"Update a task. Action is inferred from inputs: toggle_status to toggle task status, complete_instance to complete a recurring instance, or provide properties to update.",
	annotations: {
		title: "TaskNotes Update Tool",
		readOnlyHint: false,
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: false,
	},
	schema: updateSchema,
	handler: async (
		obsidian: ObsidianInterface,
		request: AuthenticatedRequest,
		args: Record<string, unknown>
	) => {
		const taskNotes = obsidian.getTaskNotes(request);
		if (!taskNotes) {
			throw new Error("TaskNotes plugin is not enabled");
		}

		const parsed = updateValidator.parse(args);
		const { id, toggle_status, complete_instance, instance_date, ...updates } = parsed;

		let result;
		if (toggle_status) {
			result = await taskNotes.toggleStatus(id);
		} else if (complete_instance) {
			result = await taskNotes.completeInstance(id, instance_date);
		} else {
			// Filter out undefined values before passing to updateTask
			const filteredUpdates = Object.fromEntries(
				Object.entries(updates).filter(([_, v]) => v !== undefined)
			);
			result = await taskNotes.updateTask(id, filteredUpdates);
		}

		return JSON.stringify(result, null, 2);
	},
};

const createSchema = {
	title: z.string().min(1).describe("Task title (required)"),
	status: z.string().optional().describe("Task status"),
	priority: z.string().optional().describe("Priority level"),
	due: z.string().optional().describe("Due date (YYYY-MM-DD)"),
	scheduled: z.string().optional().describe("Scheduled date (YYYY-MM-DD)"),
	tags: z.array(z.string()).optional().describe("Tags"),
	contexts: z.array(z.string()).optional().describe("Contexts"),
	projects: z.array(z.string()).optional().describe("Projects"),
	details: z.string().optional().describe("Task body content"),
};
const createValidator = z.object(createSchema);

export const taskNotesCreateTool: ToolRegistration = {
	name: "tasknotes_create",
	description: "Create a new task in TaskNotes.",
	annotations: {
		title: "TaskNotes Create Tool",
		readOnlyHint: false,
		destructiveHint: false,
		idempotentHint: false,
		openWorldHint: false,
	},
	schema: createSchema,
	handler: async (
		obsidian: ObsidianInterface,
		request: AuthenticatedRequest,
		args: Record<string, unknown>
	) => {
		const taskNotes = obsidian.getTaskNotes(request);
		if (!taskNotes) {
			throw new Error("TaskNotes plugin is not enabled");
		}

		// Zod parse validates and strips unknown keys (preventing prototype pollution)
		const parsed = createValidator.parse(args);

		// Filter out undefined values
		const taskData = Object.fromEntries(
			Object.entries(parsed).filter(([_, v]) => v !== undefined)
		) as { title: string; [key: string]: unknown };

		const task = await taskNotes.createTask(taskData);
		return JSON.stringify(task, null, 2);
	},
};

export class TaskNotesStatsResource {
	constructor(private obsidian: ObsidianInterface) {}

	public register(server: McpServer) {
		server.resource(
			"tasknotes_stats",
			this.template,
			{ description: "Provides TaskNotes statistics and available filter options" },
			logger.withResourceLogging(
				"tasknotes_stats",
				async (
					uri: URL,
					variables: Variables,
					extra: RequestHandlerExtra<ServerRequest, ServerNotification>
				) => {
					return await this.handler(uri, variables, extra);
				}
			)
		);
	}

	public get template() {
		return new ResourceTemplate("tasknotes:///stats", {
			list: async (_extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
				return {
					resources: [
						{
							name: "TaskNotes Stats",
							uri: "tasknotes:///stats",
							mimeType: "application/json",
						},
					],
				};
			},
		});
	}

	public async handler(
		uri: URL,
		_variables: Variables,
		extra?: RequestHandlerExtra<ServerRequest, ServerNotification>
	): Promise<ReadResourceResult> {
		const request = getRequest(extra);
		const taskNotes = this.obsidian.getTaskNotes(request);

		if (!taskNotes) {
			throw new Error("TaskNotes plugin is not enabled");
		}

		const stats = taskNotes.getStats();
		const filterOptions = taskNotes.getFilterOptions();

		const result = {
			stats,
			filterOptions,
		};

		return {
			contents: [
				{
					uri: uri.toString(),
					text: JSON.stringify(result, null, 2),
					mimeType: "application/json",
				},
			],
		};
	}
}
