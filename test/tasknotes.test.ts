import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	taskNotesQueryTool,
	taskNotesUpdateTool,
	taskNotesCreateTool,
	TaskNotesStatsResource,
} from "../tools/tasknotes";
import { generateFileMetadata } from "../tools/file_metadata";
import { MockObsidian, createMockRequest, createMockExtra } from "./mock_obsidian";
import type { TaskNotesInterface, TaskInfo, TaskFilter } from "../obsidian/obsidian_interface";

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

	it("should have the correct annotations for the update tool", () => {
		expect(taskNotesUpdateTool.annotations).toEqual({
			title: "TaskNotes Update Tool",
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: false,
		});
	});

	it("should have the correct annotations for the create tool", () => {
		expect(taskNotesCreateTool.annotations).toEqual({
			title: "TaskNotes Create Tool",
			readOnlyHint: false,
			destructiveHint: false,
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

		if (filter.due) {
			if (filter.due.before) {
				filtered = filtered.filter((t) => t.due && t.due <= filter.due!.before!);
			}
			if (filter.due.after) {
				filtered = filtered.filter((t) => t.due && t.due >= filter.due!.after!);
			}
		}

		if (filter.scheduled) {
			if (filter.scheduled.before) {
				filtered = filtered.filter((t) => t.scheduled && t.scheduled <= filter.scheduled!.before!);
			}
			if (filter.scheduled.after) {
				filtered = filtered.filter((t) => t.scheduled && t.scheduled >= filter.scheduled!.after!);
			}
		}

		if (filter.archived !== undefined) {
			filtered = filtered.filter((t) => t.archived === filter.archived);
		}

		if (filter.tags && filter.tags.length > 0) {
			filtered = filtered.filter(
				(t) => t.tags && filter.tags!.some((tag) => t.tags!.includes(tag))
			);
		}

		if (filter.contexts && filter.contexts.length > 0) {
			filtered = filtered.filter(
				(t) => t.contexts && filter.contexts!.some((ctx) => t.contexts!.includes(ctx))
			);
		}

		if (filter.projects && filter.projects.length > 0) {
			filtered = filtered.filter(
				(t) => t.projects && filter.projects!.some((proj) => t.projects!.includes(proj))
			);
		}

		// Sorting
		if (filter.sortBy) {
			const direction = filter.sortDirection === "desc" ? -1 : 1;
			filtered.sort((a, b) => {
				const aVal = (a as unknown as Record<string, unknown>)[filter.sortBy!] as string | number;
				const bVal = (b as unknown as Record<string, unknown>)[filter.sortBy!] as string | number;
				if (aVal < bVal) return -1 * direction;
				if (aVal > bVal) return 1 * direction;
				return 0;
			});
		}

		// Pagination
		const offset = filter.offset || 0;
		const limit = filter.limit || 50;
		return filtered.slice(offset, offset + limit);
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
		if (data.scheduled) task.scheduled = data.scheduled as string;
		if (data.tags) task.tags = data.tags as string[];
		if (data.contexts) task.contexts = data.contexts as string[];
		if (data.projects) task.projects = data.projects as string[];

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

	async toggleStatus(id: string): Promise<TaskInfo> {
		const task = this.tasks.find((t) => t.id === id || t.path === id);
		if (!task) {
			throw new Error(`Task not found: ${id}`);
		}
		task.status = task.status === "done" ? "todo" : "done";
		if (task.status === "done") {
			task.completedDate = new Date().toISOString().split("T")[0];
		} else {
			task.completedDate = undefined;
		}
		return task;
	}

	async completeInstance(id: string, date?: string): Promise<TaskInfo> {
		const task = this.tasks.find((t) => t.id === id || t.path === id);
		if (!task) {
			throw new Error(`Task not found: ${id}`);
		}
		task.status = "done";
		task.completedDate = date || new Date().toISOString().split("T")[0];
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

	getFilterOptions(): {
		statuses: string[];
		priorities: string[];
		contexts: string[];
		projects: string[];
	} {
		const statuses = new Set<string>();
		const priorities = new Set<string>();
		const contexts = new Set<string>();
		const projects = new Set<string>();

		for (const task of this.tasks) {
			statuses.add(task.status);
			priorities.add(task.priority);
			if (task.contexts) {
				task.contexts.forEach((c) => contexts.add(c));
			}
			if (task.projects) {
				task.projects.forEach((p) => projects.add(p));
			}
		}

		return {
			statuses: Array.from(statuses).sort(),
			priorities: Array.from(priorities).sort(),
			contexts: Array.from(contexts).sort(),
			projects: Array.from(projects).sort(),
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
				contexts: ["development"],
				projects: ["feature-x"],
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
				contexts: ["writing"],
				projects: ["documentation"],
			},
			{
				id: "task-4",
				title: "Old archived task",
				status: "done",
				priority: "low",
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
		it("should list all tasks with default pagination", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {});
			const tasks = JSON.parse(result);
			expect(tasks).toHaveLength(5);
		});

		it("should filter by status", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				status: ["todo"],
			});
			const tasks = JSON.parse(result);
			expect(tasks).toMatchInlineSnapshot(`
				[
				  {
				    "archived": false,
				    "contexts": [
				      "office",
				    ],
				    "due": "2025-12-15",
				    "id": "task-1",
				    "path": "tasks/complete-project-proposal.md",
				    "priority": "high",
				    "projects": [
				      "q4-goals",
				    ],
				    "status": "todo",
				    "tags": [
				      "work",
				      "urgent",
				    ],
				    "title": "Complete project proposal",
				  },
				  {
				    "archived": false,
				    "due": "2025-12-01",
				    "id": "task-5",
				    "path": "tasks/overdue-task.md",
				    "priority": "high",
				    "status": "todo",
				    "tags": [
				      "overdue",
				    ],
				    "title": "Overdue task",
				  },
				]
			`);
		});

		it("should filter by priority", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				priority: ["high"],
			});
			const tasks = JSON.parse(result);
			expect(tasks).toHaveLength(2);
			expect(tasks.every((t: TaskInfo) => t.priority === "high")).toBe(true);
		});

		it("should filter by due date range", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				due_after: "2025-12-10",
				due_before: "2025-12-20",
			});
			const tasks = JSON.parse(result);
			expect(tasks).toMatchInlineSnapshot(`
				[
				  {
				    "archived": false,
				    "contexts": [
				      "office",
				    ],
				    "due": "2025-12-15",
				    "id": "task-1",
				    "path": "tasks/complete-project-proposal.md",
				    "priority": "high",
				    "projects": [
				      "q4-goals",
				    ],
				    "status": "todo",
				    "tags": [
				      "work",
				      "urgent",
				    ],
				    "title": "Complete project proposal",
				  },
				]
			`);
		});

		it("should filter by tags", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				tags: ["work"],
			});
			const tasks = JSON.parse(result);
			expect(tasks).toHaveLength(1);
			expect(tasks[0].title).toBe("Complete project proposal");
		});

		it("should filter by contexts", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				contexts: ["development"],
			});
			const tasks = JSON.parse(result);
			expect(tasks).toHaveLength(1);
			expect(tasks[0].title).toBe("Review PR #123");
		});

		it("should filter by projects", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				projects: ["q4-goals"],
			});
			const tasks = JSON.parse(result);
			expect(tasks).toHaveLength(1);
			expect(tasks[0].title).toBe("Complete project proposal");
		});

		it("should support pagination with limit and offset", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				limit: 2,
				offset: 1,
			});
			const tasks = JSON.parse(result);
			expect(tasks).toHaveLength(2);
			expect(tasks[0].id).toBe("task-2");
			expect(tasks[1].id).toBe("task-3");
		});

		it("should support sorting", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				sort_by: "priority",
				sort_direction: "desc",
			});
			const tasks = JSON.parse(result);
			expect(tasks[0].priority).toBe("medium");
			expect(tasks[tasks.length - 1].priority).toBe("high");
		});

		it("should filter by archived status", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				archived: true,
			});
			const tasks = JSON.parse(result);
			expect(tasks).toHaveLength(1);
			expect(tasks[0].archived).toBe(true);
		});

		it("should return empty array when no tasks match", async () => {
			const result = await taskNotesQueryTool.handler(obsidian, request, {
				status: ["nonexistent"],
			});
			const tasks = JSON.parse(result);
			expect(tasks).toEqual([]);
		});

		it("should throw error when TaskNotes plugin not enabled", async () => {
			obsidian.taskNotes = null;
			await expect(taskNotesQueryTool.handler(obsidian, request, {})).rejects.toThrow(
				"TaskNotes plugin is not enabled"
			);
		});
	});

	describe("taskNotesUpdateTool", () => {
		it("should update task properties", async () => {
			const result = await taskNotesUpdateTool.handler(obsidian, request, {
				id: "task-1",
				status: "in-progress",
				priority: "medium",
			});
			const task = JSON.parse(result);
			expect(task.status).toBe("in-progress");
			expect(task.priority).toBe("medium");
		});

		it("should toggle task status", async () => {
			const result = await taskNotesUpdateTool.handler(obsidian, request, {
				id: "task-1",
				toggle_status: true,
			});
			const task = JSON.parse(result);
			expect(task.status).toBe("done");
			expect(task.completedDate).toBeDefined();
		});

		it("should complete recurring instance", async () => {
			const result = await taskNotesUpdateTool.handler(obsidian, request, {
				id: "task-1",
				complete_instance: true,
				instance_date: "2025-12-15",
			});
			const task = JSON.parse(result);
			expect(task.status).toBe("done");
			expect(task.completedDate).toBe("2025-12-15");
		});

		it("should update multiple properties at once", async () => {
			const result = await taskNotesUpdateTool.handler(obsidian, request, {
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
				taskNotesUpdateTool.handler(obsidian, request, {
					id: "nonexistent",
					status: "done",
				})
			).rejects.toThrow("Task not found: nonexistent");
		});

		it("should throw error when TaskNotes plugin not enabled", async () => {
			obsidian.taskNotes = null;
			await expect(
				taskNotesUpdateTool.handler(obsidian, request, {
					id: "task-1",
					status: "done",
				})
			).rejects.toThrow("TaskNotes plugin is not enabled");
		});

		it("should throw error when id is missing", async () => {
			await expect(
				taskNotesUpdateTool.handler(obsidian, request, {
					status: "done",
				})
			).rejects.toThrow(); // Zod throws validation error for missing required field
		});
	});

	describe("taskNotesCreateTool", () => {
		it("should create task with title only", async () => {
			const result = await taskNotesCreateTool.handler(obsidian, request, {
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

			const result = await taskNotesCreateTool.handler(obsidian, request, {
				title: "Complete new feature",
				status: "in-progress",
				priority: "high",
				due: "2025-12-20",
				scheduled: "2025-12-15",
				tags: ["feature", "sprint"],
				contexts: ["development"],
				projects: ["new-project"],
			});
			const task = JSON.parse(result);
			expect(task).toMatchInlineSnapshot(`
				{
				  "archived": false,
				  "contexts": [
				    "development",
				  ],
				  "due": "2025-12-20",
				  "id": "task-1734220800000",
				  "path": "tasks/complete-new-feature.md",
				  "priority": "high",
				  "projects": [
				    "new-project",
				  ],
				  "scheduled": "2025-12-15",
				  "status": "in-progress",
				  "tags": [
				    "feature",
				    "sprint",
				  ],
				  "title": "Complete new feature",
				}
			`);

			vi.restoreAllMocks();
		});

		it("should throw error when TaskNotes plugin not enabled", async () => {
			obsidian.taskNotes = null;
			await expect(
				taskNotesCreateTool.handler(obsidian, request, {
					title: "New task",
				})
			).rejects.toThrow("TaskNotes plugin is not enabled");
		});

		it("should throw error when title is missing", async () => {
			await expect(taskNotesCreateTool.handler(obsidian, request, {})).rejects.toThrow(); // Zod throws validation error for missing required field
		});
	});

	describe("TaskNotesStatsResource", () => {
		it("should return stats and filter options", async () => {
			const resource = new TaskNotesStatsResource(obsidian);
			const extra = createMockExtra(request);
			const uri = new URL("tasknotes:///stats");
			const result = await resource.handler(uri, {}, extra);

			expect(result.contents).toHaveLength(1);
			expect(result.contents[0].uri).toBe("tasknotes:///stats");
			expect(result.contents[0].mimeType).toBe("application/json");

			const content = result.contents[0];
			const data = JSON.parse("text" in content ? content.text || "{}" : "{}");
			expect(data).toMatchInlineSnapshot(`
				{
				  "filterOptions": {
				    "contexts": [
				      "development",
				      "office",
				      "writing",
				    ],
				    "priorities": [
				      "high",
				      "low",
				      "medium",
				    ],
				    "projects": [
				      "documentation",
				      "feature-x",
				      "q4-goals",
				    ],
				    "statuses": [
				      "done",
				      "in-progress",
				      "todo",
				    ],
				  },
				  "stats": {
				    "active": 3,
				    "archived": 1,
				    "completed": 2,
				    "overdue": 1,
				    "total": 5,
				  },
				}
			`);
		});

		it("should throw error when TaskNotes plugin not enabled", async () => {
			obsidian.taskNotes = null;
			const resource = new TaskNotesStatsResource(obsidian);
			const extra = createMockExtra(request);
			const uri = new URL("tasknotes:///stats");

			await expect(resource.handler(uri, {}, extra)).rejects.toThrow(
				"TaskNotes plugin is not enabled"
			);
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
			expect(result).toContain("- **contexts**: office");
			expect(result).toContain("- **projects**: q4-goals");
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
