import { z } from "zod";

import type { ObsidianInterface } from "../obsidian/obsidian_interface";
import type { AuthenticatedRequest } from "../server/auth";

import type { ToolRegistration } from "./types";

const querySchema = {
	date: z
		.string()
		.optional()
		.describe("Date in YYYY-MM-DD format or alias (today/yesterday/tomorrow). Defaults to today."),
};
const queryValidator = z.object(querySchema);

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
	schema: querySchema,
	handler: async (
		obsidian: ObsidianInterface,
		request: AuthenticatedRequest,
		args: Record<string, unknown>
	) => {
		const timeblocks = obsidian.getTimeblocks(request);
		if (!timeblocks) {
			throw new Error("Timeblocks feature is not enabled or daily notes plugin is not active");
		}

		const parsed = queryValidator.parse(args);
		const date = parsed.date ?? "today";

		const blocks = await timeblocks.getTimeblocks(date);
		return JSON.stringify({ date, timeblocks: blocks }, null, 2);
	},
};

const manageSchema = {
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
const manageValidator = z.object(manageSchema);

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
	schema: manageSchema,
	handler: async (
		obsidian: ObsidianInterface,
		request: AuthenticatedRequest,
		args: Record<string, unknown>
	) => {
		const timeblocks = obsidian.getTimeblocks(request);
		if (!timeblocks) {
			throw new Error("Timeblocks feature is not enabled or daily notes plugin is not active");
		}

		const parsed = manageValidator.parse(args);
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
