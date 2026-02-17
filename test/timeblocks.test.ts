import { describe, it, expect, vi, beforeEach } from "vitest";
import { timeblocksQueryTool, timeblocksTool } from "../extensions/tasknotes";
import {
	MockObsidian,
	MockTimeblocks,
	createMockRequest,
	createMockContext,
} from "./mock_obsidian";
import type { TimeBlock } from "../obsidian/obsidian_interface";
import type { ToolContext } from "../extensions/types";

describe("timeblocks tool hints", () => {
	it("should have the correct hints for the query tool", () => {
		expect(timeblocksQueryTool.hints).toEqual({
			readOnly: true,
			idempotent: true,
		});
	});

	it("should have the correct hints for the timeblocks tool", () => {
		expect(timeblocksTool.hints).toEqual({
			destructive: true,
		});
	});
});

describe("timeblocks tools", () => {
	let obsidian: MockObsidian;
	let timeblocksPlugin: MockTimeblocks;
	let context: ToolContext;

	beforeEach(() => {
		vi.clearAllMocks();
		obsidian = new MockObsidian();
		const request = createMockRequest(obsidian, {
			enabledTools: {
				file_access: true,
				update_content: true,
				dataview: false,
				quickadd: false,
				tasknotes: true,
			},
		});
		context = createMockContext(obsidian, request);

		timeblocksPlugin = new MockTimeblocks();
		obsidian.timeblocks = timeblocksPlugin;
	});

	describe("timeblocksQueryTool", () => {
		it("should return empty array when no timeblocks exist", async () => {
			const result = await timeblocksQueryTool.handler(
				{
					date: "2025-12-12",
				},
				context
			);
			const data = JSON.parse(result);

			expect(data.date).toBe("2025-12-12");
			expect(data.timeblocks).toEqual([]);
		});

		it("should return timeblocks for the requested date", async () => {
			const testBlocks: TimeBlock[] = [
				{
					id: "tb-1",
					title: "Morning standup",
					startTime: "09:00",
					endTime: "09:30",
					color: "#6366f1",
				},
				{
					id: "tb-2",
					title: "Deep work session",
					startTime: "10:00",
					endTime: "12:00",
					description: "Focus on critical tasks",
					attachments: ["[[Project A]]", "[[Task 123]]"],
				},
			];

			timeblocksPlugin.addTestTimeblock("2025-12-12", testBlocks[0]);
			timeblocksPlugin.addTestTimeblock("2025-12-12", testBlocks[1]);

			const result = await timeblocksQueryTool.handler(
				{
					date: "2025-12-12",
				},
				context
			);
			const data = JSON.parse(result);

			expect(data.date).toBe("2025-12-12");
			expect(data.timeblocks).toHaveLength(2);
			expect(data.timeblocks[0]).toMatchObject({
				id: "tb-1",
				title: "Morning standup",
				startTime: "09:00",
				endTime: "09:30",
			});
			expect(data.timeblocks[1]).toMatchObject({
				id: "tb-2",
				title: "Deep work session",
				startTime: "10:00",
				endTime: "12:00",
			});
		});

		it("should default to 'today' when no date provided", async () => {
			const testBlock: TimeBlock = {
				id: "tb-today",
				title: "Today's block",
				startTime: "14:00",
				endTime: "15:00",
			};

			timeblocksPlugin.addTestTimeblock("today", testBlock);

			const result = await timeblocksQueryTool.handler({}, context);
			const data = JSON.parse(result);

			expect(data.date).toBe("today");
			expect(data.timeblocks).toHaveLength(1);
			expect(data.timeblocks[0].title).toBe("Today's block");
		});

		it("should throw error when timeblocks feature not enabled", async () => {
			obsidian.timeblocks = null;
			await expect(timeblocksQueryTool.handler({ date: "2025-12-12" }, context)).rejects.toThrow(
				"Timeblocks feature is not enabled or daily notes plugin is not active"
			);
		});
	});

	describe("timeblocksTool", () => {
		describe("create timeblock", () => {
			it("should create a new timeblock with required fields", async () => {
				const result = await timeblocksTool.handler(
					{
						date: "2025-12-12",
						title: "Team meeting",
						startTime: "14:00",
						endTime: "15:00",
					},
					context
				);
				const timeblock = JSON.parse(result);

				expect(timeblock.id).toBeDefined();
				expect(timeblock.title).toBe("Team meeting");
				expect(timeblock.startTime).toBe("14:00");
				expect(timeblock.endTime).toBe("15:00");
			});

			it("should create timeblock with optional fields", async () => {
				const result = await timeblocksTool.handler(
					{
						date: "2025-12-12",
						title: "Code review",
						startTime: "10:00",
						endTime: "11:00",
						color: "#ef4444",
						description: "Review PR #456",
						attachments: ["[[PR 456]]", "[[Codebase notes]]"],
					},
					context
				);
				const timeblock = JSON.parse(result);

				expect(timeblock.title).toBe("Code review");
				expect(timeblock.color).toBe("#ef4444");
				expect(timeblock.description).toBe("Review PR #456");
				expect(timeblock.attachments).toEqual(["[[PR 456]]", "[[Codebase notes]]"]);
			});

			it("should throw error when creating without title", async () => {
				await expect(
					timeblocksTool.handler(
						{
							date: "2025-12-12",
							startTime: "14:00",
							endTime: "15:00",
						},
						context
					)
				).rejects.toThrow(
					"title, startTime, and endTime are required when creating a new timeblock"
				);
			});

			it("should throw error when creating without startTime", async () => {
				await expect(
					timeblocksTool.handler(
						{
							date: "2025-12-12",
							title: "Meeting",
							endTime: "15:00",
						},
						context
					)
				).rejects.toThrow(
					"title, startTime, and endTime are required when creating a new timeblock"
				);
			});

			it("should throw error when creating without endTime", async () => {
				await expect(
					timeblocksTool.handler(
						{
							date: "2025-12-12",
							title: "Meeting",
							startTime: "14:00",
						},
						context
					)
				).rejects.toThrow(
					"title, startTime, and endTime are required when creating a new timeblock"
				);
			});
		});

		describe("update timeblock", () => {
			beforeEach(() => {
				timeblocksPlugin.addTestTimeblock("2025-12-12", {
					id: "tb-existing",
					title: "Original title",
					startTime: "09:00",
					endTime: "10:00",
				});
			});

			it("should update existing timeblock", async () => {
				const result = await timeblocksTool.handler(
					{
						date: "2025-12-12",
						id: "tb-existing",
						title: "Updated title",
						color: "#10b981",
					},
					context
				);
				const timeblock = JSON.parse(result);

				expect(timeblock.id).toBe("tb-existing");
				expect(timeblock.title).toBe("Updated title");
				expect(timeblock.color).toBe("#10b981");
				expect(timeblock.startTime).toBe("09:00");
				expect(timeblock.endTime).toBe("10:00");
			});

			it("should update time fields", async () => {
				const result = await timeblocksTool.handler(
					{
						date: "2025-12-12",
						id: "tb-existing",
						startTime: "10:00",
						endTime: "11:30",
					},
					context
				);
				const timeblock = JSON.parse(result);

				expect(timeblock.startTime).toBe("10:00");
				expect(timeblock.endTime).toBe("11:30");
			});

			it("should throw error when timeblock not found", async () => {
				await expect(
					timeblocksTool.handler(
						{
							date: "2025-12-12",
							id: "nonexistent",
							title: "Updated",
						},
						context
					)
				).rejects.toThrow("Timeblock not found: nonexistent");
			});
		});

		describe("delete timeblock", () => {
			beforeEach(() => {
				timeblocksPlugin.addTestTimeblock("2025-12-12", {
					id: "tb-to-delete",
					title: "Will be deleted",
					startTime: "09:00",
					endTime: "10:00",
				});
			});

			it("should delete timeblock when delete=true", async () => {
				const result = await timeblocksTool.handler(
					{
						date: "2025-12-12",
						id: "tb-to-delete",
						delete: true,
					},
					context
				);
				const data = JSON.parse(result);

				expect(data.success).toBe(true);
				expect(data.deleted).toBe("tb-to-delete");

				const blocks = await timeblocksPlugin.getTimeblocks("2025-12-12");
				expect(blocks).toHaveLength(0);
			});

			it("should throw error when deleting without id", async () => {
				await expect(
					timeblocksTool.handler(
						{
							date: "2025-12-12",
							delete: true,
						},
						context
					)
				).rejects.toThrow("ID is required for delete");
			});

			it("should throw error when deleting nonexistent timeblock", async () => {
				await expect(
					timeblocksTool.handler(
						{
							date: "2025-12-12",
							id: "nonexistent",
							delete: true,
						},
						context
					)
				).rejects.toThrow("Timeblock not found: nonexistent");
			});
		});

		it("should throw error when Timeblocks plugin not enabled", async () => {
			obsidian.timeblocks = null;
			await expect(
				timeblocksTool.handler(
					{
						date: "2025-12-12",
						title: "New block",
						startTime: "14:00",
						endTime: "15:00",
					},
					context
				)
			).rejects.toThrow("Timeblocks feature is not enabled or daily notes plugin is not active");
		});
	});
});
