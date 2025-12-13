import { describe, it, expect, vi, beforeEach } from "vitest";
import { taskNotesQueryTool, taskNotesTool } from "../tools/tasknotes";
import { generateFileMetadata } from "../tools/file_metadata";
import { MockObsidian, createMockRequest } from "./mock_obsidian";
import type { TaskNotesInterface, TaskInfo, TaskFilter } from "../obsidian/obsidian_interface";
import { TaskInfoSchema } from "../obsidian/obsidian_interface";

describe("tasknotes tool annotations", () => {
	it("should have the correct annotations for the query tool", () => {
		expect(taskNotesQueryTool.annotations).toEqual({
			title: "TaskNotes Query Tool",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		});
	});

	it("should have the correct annotations for the tasknotes tool", () => {
		expect(taskNotesTool.annotations).toEqual({
			title: "TaskNotes Tool",
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: false,
		});
	});
});

class MockTaskNotes implements TaskNotesInterface {
	private tasks: TaskInfo[] = [];

	getTaskByPath(path: string): TaskInfo | null {
		return this.tasks.find((t) => t.path === path) ?? null;
	}

	async queryTasks(filter: TaskFilter): Promise<TaskInfo[]> {
		let filtered = [...this.tasks];

		if (filter.status && filter.status.length > 0) {
			filtered = filtered.filter((t) => filter.status!.includes(t.status));
		}

		if (filter.priority && filter.priority.length > 0) {
			filtered = filtered.filter((t) => filter.priority!.includes(t.priority));
		}

		if (filter.tags && filter.tags.length > 0) {
			filtered = filtered.filter(
				(t) => t.tags && filter.tags!.some((tag) => t.tags!.includes(tag))
			);
		}

		if (filter.archived !== undefined) {
			filtered = filtered.filter((t) => t.archived === filter.archived);
		}

		if (filter.dueBefore) {
			const before = filter.dueBefore;
			filtered = filtered.filter((t) => {
				return (t.due && t.due <= before) || (t.scheduled && t.scheduled <= before);
			});
		}

		if (filter.limit) {
			filtered = filtered.slice(0, filter.limit);
		}

		return filtered;
	}

	async createTask(data: { title: string; [key: string]: unknown }): Promise<TaskInfo> {
		const task: TaskInfo = {
			id: `task-${Date.now()}`,
			title: data.title,
			status: (data.status as string) || "todo",
			priority: (data.priority as string) || "none",
			path: `tasks/${data.title.toLowerCase().replace(/\s+/g, "-")}.md`,
			archived: false,
		};

		if (data.due) task.due = data.due as string;
		if (data.tags) task.tags = data.tags as string[];

		this.tasks.push(task);
		return task;
	}

	async updateTask(id: string, updates: Record<string, unknown>): Promise<TaskInfo> {
		const task = this.tasks.find((t) => t.id === id || t.path === id);
		if (!task) {
			throw new Error(`Task not found: ${id}`);
		}
		Object.assign(task, updates);
		return task;
	}

	async getStats(): Promise<{
		total: number;
		completed: number;
		active: number;
		overdue: number;
		archived: number;
	}> {
		const today = new Date().toISOString().split("T")[0];
		return {
			total: this.tasks.length,
			completed: this.tasks.filter((t) => t.status === "done").length,
			active: this.tasks.filter((t) => t.status !== "done" && !t.archived).length,
			overdue: this.tasks.filter((t) => t.due && t.due < today && t.status !== "done").length,
			archived: this.tasks.filter((t) => t.archived).length,
		};
	}

	getFilterOptions(): { statuses: string[]; priorities: string[] } {
		const statuses = new Set<string>();
		const priorities = new Set<string>();

		for (const task of this.tasks) {
			statuses.add(task.status);
			priorities.add(task.priority);
		}

		return {
			statuses: Array.from(statuses).sort(),
			priorities: Array.from(priorities).sort(),
		};
	}

	setTasks(tasks: TaskInfo[]): void {
		this.tasks = tasks;
	}
}

describe("tasknotes tools", () => {
	let obsidian: MockObsidian;
	let taskNotesPlugin: MockTaskNotes;
	let request: ReturnType<typeof createMockRequest>;

	beforeEach(() => {
		vi.clearAllMocks();
		obsidian = new MockObsidian();
		request = createMockRequest(obsidian, {
			enabledTools: {
				file_access: true,
				search: true,
				update_content: true,
				dataview_query: false,
				quickadd: false,
				tasknotes: true,
			},
		});

		taskNotesPlugin = new MockTaskNotes();
		obsidian.taskNotes = taskNotesPlugin;

		const testTasks: TaskInfo[] = [
			{
				id: "task-1",
				title: "Complete project proposal",
				status: "todo",
				priority: "high",
				due: "2025-12-15",
				path: "tasks/complete-project-proposal.md",
				archived: false,
				tags: ["work", "urgent"],
				contexts: ["office"],
				projects: ["q4-goals"],
			},
			{
				id: "task-2",
				title: "Review PR #123",
				status: "in-progress",
				priority: "medium",
				scheduled: "2025-12-12",
				path: "tasks/review-pr-123.md",
				archived: false,
				tags: ["code-review"],
			},
			{
				id: "task-3",
				title: "Update documentation",
				status: "done",
				priority: "low",
				completedDate: "2025-12-10",
				path: "tasks/update-documentation.md",
				archived: false,
				tags: ["docs"],
			},
			{
				id: "task-4",
				title: "Old archived task",
				status: "done",
				priority: "low",
				due: "2025-12-10",
				path: "tasks/old-archived-task.md",
				archived: true,
			},
			{
				id: "task-5",
				title: "Overdue task",
				status: "todo",
				priority: "high",
				due: "2025-12-01",
				path: "tasks/overdue-task.md",
				archived: false,
				tags: ["overdue"],
			},
		];

		taskNotesPlugin.setTasks(testTasks);
	});

	describe("taskNotesQueryTool", () => {
		it("should return tasks with default due_before of today", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {});
			const data = JSON.parse(result);

			// Should return tasks due or scheduled on or before today
			expect(data.tasks).toBeDefined();
			expect(data.hasMore).toBeDefined();
			expect(data.returned).toBeDefined();
		});

		it("should include stats and filterOptions when include_stats is true (default)", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				due_before: "2025-12-31", // Far future to get all tasks
			});
			const data = JSON.parse(result);

			expect(data.stats).toBeDefined();
			expect(data.stats.total).toBe(5);
			expect(data.stats.active).toBeDefined();
			expect(data.stats.completed).toBeDefined();
			expect(data.stats.overdue).toBeDefined();
			expect(data.stats.archived).toBeDefined();

			expect(data.filterOptions).toBeDefined();
			expect(data.filterOptions.statuses).toBeInstanceOf(Array);
			expect(data.filterOptions.priorities).toBeInstanceOf(Array);
		});

		it("should not include stats when include_stats is false", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				due_before: "2025-12-31",
				include_stats: false,
			});
			const data = JSON.parse(result);

			expect(data.stats).toBeUndefined();
			expect(data.filterOptions).toBeUndefined();
		});

		it("should indicate hasMore when more tasks exist", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				due_before: "2025-12-31",
				limit: 2,
			});
			const data = JSON.parse(result);

			expect(data.tasks).toHaveLength(2);
			expect(data.hasMore).toBe(true);
			expect(data.returned).toBe(2);
		});

		it("should indicate hasMore=false when all tasks returned", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				due_before: "2025-12-31",
				limit: 10,
			});
			const data = JSON.parse(result);

			expect(data.hasMore).toBe(false);
		});

		it("should filter by status", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				status: ["todo"],
				due_before: "2025-12-31",
			});
			const data = JSON.parse(result);

			expect(data.tasks.every((t: TaskInfo) => t.status === "todo")).toBe(true);
		});

		it("should filter by priority", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				priority: ["high"],
				due_before: "2025-12-31",
			});
			const data = JSON.parse(result);

			expect(data.tasks.every((t: TaskInfo) => t.priority === "high")).toBe(true);
		});

		it("should filter by tags", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				tags: ["work"],
				due_before: "2025-12-31",
			});
			const data = JSON.parse(result);

			expect(data.tasks).toHaveLength(1);
			expect(data.tasks[0].title).toBe("Complete project proposal");
		});

		it("should filter by due_before (includes due and scheduled)", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				due_before: "2025-12-12",
			});
			const data = JSON.parse(result);

			// Should include task-2 (scheduled 2025-12-12), task-5 (due 2025-12-01)
			const ids = data.tasks.map((t: TaskInfo) => t.id);
			expect(ids).toContain("task-2");
			expect(ids).toContain("task-5");
		});

		it("should exclude archived tasks by default", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				due_before: "2025-12-31",
			});
			const data = JSON.parse(result);

			expect(data.tasks.every((t: TaskInfo) => !t.archived)).toBe(true);
		});

		it("should include archived tasks when archived=true", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				archived: true,
				due_before: "2025-12-31",
			});
			const data = JSON.parse(result);

			expect(data.tasks.some((t: TaskInfo) => t.archived)).toBe(true);
		});

		it("should return empty array when no tasks match", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				status: ["nonexistent"],
				due_before: "2025-12-31",
			});
			const data = JSON.parse(result);

			expect(data.tasks).toEqual([]);
			expect(data.hasMore).toBe(false);
		});

		it("should throw error when TaskNotes plugin not enabled", async () => {
			obsidian.taskNotes = null;
			await expect(taskNotesQueryTool.handler(obsidian, request, {})).rejects.toThrow(
				"TaskNotes plugin is not enabled"
			);
		});
	});

	describe("taskNotesTool", () => {
		describe("create task", () => {
			it("should create task with title only", async () => {
				const result = await taskNotesTool.handler(obsidian, request, {
					title: "New task",
				});
				const task = JSON.parse(result);

				expect(task.title).toBe("New task");
				expect(task.status).toBe("todo");
				expect(task.priority).toBe("none");
				expect(task.archived).toBe(false);
			});

			it("should create task with all properties", async () => {
				const mockNow = 1734220800000;
				vi.spyOn(Date, "now").mockReturnValue(mockNow);

				const result = await taskNotesTool.handler(obsidian, request, {
					title: "Complete new feature",
					status: "in-progress",
					priority: "high",
					due: "2025-12-20",
					tags: ["feature", "sprint"],
				});
				const task = JSON.parse(result);

				expect(task.title).toBe("Complete new feature");
				expect(task.status).toBe("in-progress");
				expect(task.priority).toBe("high");
				expect(task.due).toBe("2025-12-20");
				expect(task.tags).toEqual(["feature", "sprint"]);

				vi.restoreAllMocks();
			});

			it("should throw error when title is missing for create", async () => {
				await expect(taskNotesTool.handler(obsidian, request, {})).rejects.toThrow(
					"Title is required when creating a new task"
				);
			});
		});

		describe("update task", () => {
			it("should update task properties", async () => {
				const result = await taskNotesTool.handler(obsidian, request, {
					id: "task-1",
					status: "in-progress",
					priority: "medium",
				});
				const task = JSON.parse(result);

				expect(task.status).toBe("in-progress");
				expect(task.priority).toBe("medium");
			});

			it("should update task status to done", async () => {
				const result = await taskNotesTool.handler(obsidian, request, {
					id: "task-1",
					status: "done",
				});
				const task = JSON.parse(result);

				expect(task.status).toBe("done");
			});

			it("should update multiple properties at once", async () => {
				const result = await taskNotesTool.handler(obsidian, request, {
					id: "task-2",
					status: "done",
					priority: "high",
					tags: ["completed", "reviewed"],
				});
				const task = JSON.parse(result);

				expect(task.status).toBe("done");
				expect(task.priority).toBe("high");
				expect(task.tags).toEqual(["completed", "reviewed"]);
			});

			it("should throw error when task not found", async () => {
				await expect(
					taskNotesTool.handler(obsidian, request, {
						id: "nonexistent",
						status: "done",
					})
				).rejects.toThrow("Task not found: nonexistent");
			});
		});

		it("should throw error when TaskNotes plugin not enabled", async () => {
			obsidian.taskNotes = null;
			await expect(
				taskNotesTool.handler(obsidian, request, {
					title: "New task",
				})
			).rejects.toThrow("TaskNotes plugin is not enabled");
		});
	});

	describe("file_metadata integration", () => {
		it("should include TaskNotes section for task files", async () => {
			obsidian.setFiles({
				"tasks/complete-project-proposal.md": `---
title: Complete project proposal
status: todo
priority: high
---

# Complete project proposal

Task details here.`,
			});

			const result = await generateFileMetadata(
				obsidian,
				"tasks/complete-project-proposal.md",
				request
			);

			expect(result).toContain("## TaskNotes");
			expect(result).toContain("- **id**: task-1");
			expect(result).toContain("- **status**: todo");
			expect(result).toContain("- **priority**: high");
			expect(result).toContain("- **due**: 2025-12-15");
		});

		it("should not include TaskNotes section for non-task files", async () => {
			obsidian.setFiles({
				"notes/random-note.md": `---
title: Random Note
---

# Random Note

This is not a task.`,
			});

			const result = await generateFileMetadata(obsidian, "notes/random-note.md", request);

			expect(result).not.toContain("## TaskNotes");
		});

		it("should not include TaskNotes section when plugin not enabled", async () => {
			obsidian.taskNotes = null;
			obsidian.setFiles({
				"tasks/complete-project-proposal.md": `---
title: Complete project proposal
---

# Complete project proposal`,
			});

			const result = await generateFileMetadata(
				obsidian,
				"tasks/complete-project-proposal.md",
				request
			);

			expect(result).not.toContain("## TaskNotes");
		});

		it("should include blocking/blocked status when available", async () => {
			const blockedTask: TaskInfo = {
				id: "blocked-task",
				title: "Blocked task",
				status: "todo",
				priority: "high",
				path: "tasks/blocked-task.md",
				archived: false,
				isBlocked: true,
				isBlocking: false,
			};
			taskNotesPlugin.setTasks([...(await taskNotesPlugin.queryTasks({})), blockedTask]);

			obsidian.setFiles({
				"tasks/blocked-task.md": `---
title: Blocked task
---

# Blocked task`,
			});

			const result = await generateFileMetadata(obsidian, "tasks/blocked-task.md", request);

			expect(result).toContain("- **isBlocked**: true");
			expect(result).toContain("- **isBlocking**: false");
		});

		it("should include recurrence information when available", async () => {
			const recurringTask: TaskInfo = {
				id: "recurring-task",
				title: "Recurring task",
				status: "todo",
				priority: "medium",
				path: "tasks/recurring-task.md",
				archived: false,
				recurrence: "every week",
			};
			taskNotesPlugin.setTasks([...(await taskNotesPlugin.queryTasks({})), recurringTask]);

			obsidian.setFiles({
				"tasks/recurring-task.md": `---
title: Recurring task
---

# Recurring task`,
			});

			const result = await generateFileMetadata(obsidian, "tasks/recurring-task.md", request);

			expect(result).toContain("- **recurrence**: every week");
		});

		it("should include tracked time when available", async () => {
			const trackedTask: TaskInfo = {
				id: "tracked-task",
				title: "Tracked task",
				status: "in-progress",
				priority: "high",
				path: "tasks/tracked-task.md",
				archived: false,
				totalTrackedTime: 3600000, // 1 hour in ms
			};
			taskNotesPlugin.setTasks([...(await taskNotesPlugin.queryTasks({})), trackedTask]);

			obsidian.setFiles({
				"tasks/tracked-task.md": `---
title: Tracked task
---

# Tracked task`,
			});

			const result = await generateFileMetadata(obsidian, "tasks/tracked-task.md", request);

			expect(result).toContain("- **totalTrackedTime**: 3600000ms");
		});
	});
});

describe("TaskInfoSchema null value handling", () => {
	it("should accept null values for optional string fields", () => {
		const taskWithNulls = {
			id: "task-1",
			title: "Test task",
			status: "todo",
			priority: "high",
			path: "tasks/test.md",
			archived: false,
			due: null,
			scheduled: null,
			recurrence: null,
			completedDate: null,
			dateCreated: null,
			dateModified: null,
		};

		const parsed = TaskInfoSchema.parse(taskWithNulls);
		expect(parsed.id).toBe("task-1");
		expect(parsed.due).toBeNull();
		expect(parsed.scheduled).toBeNull();
		expect(parsed.recurrence).toBeNull();
	});

	it("should accept null values for optional array fields", () => {
		const taskWithNullArrays = {
			id: "task-2",
			title: "Test task with null arrays",
			status: "todo",
			priority: "medium",
			path: "tasks/test2.md",
			archived: false,
			tags: null,
			contexts: null,
			projects: null,
		};

		const parsed = TaskInfoSchema.parse(taskWithNullArrays);
		expect(parsed.tags).toBeNull();
		expect(parsed.contexts).toBeNull();
		expect(parsed.projects).toBeNull();
	});

	it("should accept null values for optional number fields", () => {
		const taskWithNullNumbers = {
			id: "task-3",
			title: "Test task with null numbers",
			status: "in-progress",
			priority: "low",
			path: "tasks/test3.md",
			archived: false,
			timeEstimate: null,
			totalTrackedTime: null,
		};

		const parsed = TaskInfoSchema.parse(taskWithNullNumbers);
		expect(parsed.timeEstimate).toBeNull();
		expect(parsed.totalTrackedTime).toBeNull();
	});

	it("should accept null values for optional boolean fields", () => {
		const taskWithNullBooleans = {
			id: "task-4",
			title: "Test task with null booleans",
			status: "todo",
			priority: "high",
			path: "tasks/test4.md",
			archived: false,
			isBlocked: null,
			isBlocking: null,
		};

		const parsed = TaskInfoSchema.parse(taskWithNullBooleans);
		expect(parsed.isBlocked).toBeNull();
		expect(parsed.isBlocking).toBeNull();
	});

	it("should accept undefined values for optional fields", () => {
		const taskWithUndefined = {
			id: "task-5",
			title: "Test task with undefined",
			status: "done",
			priority: "none",
			path: "tasks/test5.md",
			archived: true,
		};

		const parsed = TaskInfoSchema.parse(taskWithUndefined);
		expect(parsed.due).toBeUndefined();
		expect(parsed.scheduled).toBeUndefined();
		expect(parsed.tags).toBeUndefined();
	});

	it("should accept a mix of null, undefined, and defined values", () => {
		const taskWithMixed = {
			id: "task-6",
			title: "Mixed values task",
			status: "todo",
			priority: "high",
			path: "tasks/test6.md",
			archived: false,
			due: "2025-12-25",
			scheduled: null,
			tags: ["important"],
			contexts: null,
			projects: undefined,
		};

		const parsed = TaskInfoSchema.parse(taskWithMixed);
		expect(parsed.due).toBe("2025-12-25");
		expect(parsed.scheduled).toBeNull();
		expect(parsed.tags).toEqual(["important"]);
		expect(parsed.contexts).toBeNull();
		expect(parsed.projects).toBeUndefined();
	});
});
