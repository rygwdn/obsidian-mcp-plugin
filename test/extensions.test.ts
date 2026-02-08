import { describe, it, expect, beforeEach } from "vitest";
import { MockObsidian, createMockRequest } from "./mock_obsidian";
import { dataviewExtension } from "../extensions/dataview";
import { tasknotesExtension } from "../extensions/tasknotes";
import { builtinExtensions } from "../extensions/builtin";
import type { Extension } from "../extensions/types";
import type {
	DataviewInterface,
	TaskNotesInterface,
	TaskInfo,
	TaskFilter,
} from "../obsidian/obsidian_interface";

class MockDataview implements DataviewInterface {
	async queryMarkdown(
		_source: string
	): Promise<{ successful: boolean; value?: string; error?: string }> {
		return { successful: true, value: "mock result" };
	}
}

class MockTaskNotes implements TaskNotesInterface {
	getTaskByPath(_path: string): TaskInfo | null {
		return null;
	}
	async queryTasks(_filter: TaskFilter): Promise<TaskInfo[]> {
		return [];
	}
	async createTask(data: { title: string }): Promise<TaskInfo> {
		return {
			title: data.title,
			status: "todo",
			priority: "none",
			path: "tasks/mock.md",
			archived: false,
		};
	}
	async updateTask(_path: string, _updates: Partial<TaskInfo>): Promise<TaskInfo> {
		return {
			title: "mock",
			status: "todo",
			priority: "none",
			path: "tasks/mock.md",
			archived: false,
		};
	}
	async getStats() {
		return { total: 0, completed: 0, active: 0, overdue: 0, archived: 0 };
	}
	getFilterOptions() {
		return { statuses: [], priorities: [] };
	}
}

describe("Extension API", () => {
	describe("dataviewExtension", () => {
		let obsidian: MockObsidian;

		beforeEach(() => {
			obsidian = new MockObsidian();
		});

		it("should have the correct id and name", () => {
			expect(dataviewExtension.id).toBe("dataview_query");
			expect(dataviewExtension.name).toBe("Dataview");
		});

		it("should expose the dataview_query tool", () => {
			expect(dataviewExtension.tools).toHaveLength(1);
			expect(dataviewExtension.tools[0].name).toBe("dataview_query");
		});

		it("should be available when dataview plugin is present and enabled", () => {
			obsidian.dataview = new MockDataview();
			const request = createMockRequest(obsidian, {
				enabledTools: {
					file_access: true,
					search: true,
					update_content: true,
					dataview_query: true,
					quickadd: false,
					tasknotes: false,
					timeblocks: false,
				},
			});

			expect(dataviewExtension.isAvailable(obsidian, request)).toBe(true);
		});

		it("should not be available when dataview plugin is not installed", () => {
			obsidian.dataview = null;
			const request = createMockRequest(obsidian, {
				enabledTools: {
					file_access: true,
					search: true,
					update_content: true,
					dataview_query: true,
					quickadd: false,
					tasknotes: false,
					timeblocks: false,
				},
			});

			expect(dataviewExtension.isAvailable(obsidian, request)).toBe(false);
		});

		it("should not be available when dataview is disabled in token", () => {
			obsidian.dataview = new MockDataview();
			const request = createMockRequest(obsidian, {
				enabledTools: {
					file_access: true,
					search: true,
					update_content: true,
					dataview_query: false,
					quickadd: false,
					tasknotes: false,
					timeblocks: false,
				},
			});

			expect(dataviewExtension.isAvailable(obsidian, request)).toBe(false);
		});
	});

	describe("tasknotesExtension", () => {
		let obsidian: MockObsidian;

		beforeEach(() => {
			obsidian = new MockObsidian();
		});

		it("should have the correct id and name", () => {
			expect(tasknotesExtension.id).toBe("tasknotes");
			expect(tasknotesExtension.name).toBe("TaskNotes");
		});

		it("should expose tasknotes_query and tasknotes tools", () => {
			expect(tasknotesExtension.tools).toHaveLength(2);
			const toolNames = tasknotesExtension.tools.map((t) => t.name);
			expect(toolNames).toContain("tasknotes_query");
			expect(toolNames).toContain("tasknotes");
		});

		it("should be available when tasknotes plugin is present and enabled", () => {
			obsidian.taskNotes = new MockTaskNotes();
			const request = createMockRequest(obsidian, {
				enabledTools: {
					file_access: true,
					search: true,
					update_content: true,
					dataview_query: false,
					quickadd: false,
					tasknotes: true,
					timeblocks: false,
				},
			});

			expect(tasknotesExtension.isAvailable(obsidian, request)).toBe(true);
		});

		it("should not be available when tasknotes plugin is not installed", () => {
			obsidian.taskNotes = null;
			const request = createMockRequest(obsidian, {
				enabledTools: {
					file_access: true,
					search: true,
					update_content: true,
					dataview_query: false,
					quickadd: false,
					tasknotes: true,
					timeblocks: false,
				},
			});

			expect(tasknotesExtension.isAvailable(obsidian, request)).toBe(false);
		});

		it("should not be available when tasknotes is disabled in token", () => {
			obsidian.taskNotes = new MockTaskNotes();
			const request = createMockRequest(obsidian, {
				enabledTools: {
					file_access: true,
					search: true,
					update_content: true,
					dataview_query: false,
					quickadd: false,
					tasknotes: false,
					timeblocks: false,
				},
			});

			expect(tasknotesExtension.isAvailable(obsidian, request)).toBe(false);
		});
	});

	describe("builtinExtensions registry", () => {
		it("should contain dataview and tasknotes extensions", () => {
			expect(builtinExtensions).toHaveLength(2);
			const ids = builtinExtensions.map((e) => e.id);
			expect(ids).toContain("dataview_query");
			expect(ids).toContain("tasknotes");
		});

		it("should have unique extension ids", () => {
			const ids = builtinExtensions.map((e) => e.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		it("every extension should conform to the Extension interface", () => {
			for (const ext of builtinExtensions) {
				expect(typeof ext.id).toBe("string");
				expect(ext.id.length).toBeGreaterThan(0);
				expect(typeof ext.name).toBe("string");
				expect(ext.name.length).toBeGreaterThan(0);
				expect(Array.isArray(ext.tools)).toBe(true);
				expect(ext.tools.length).toBeGreaterThan(0);
				expect(typeof ext.isAvailable).toBe("function");
			}
		});

		it("every extension tool should have required ToolRegistration fields", () => {
			for (const ext of builtinExtensions) {
				for (const tool of ext.tools) {
					expect(typeof tool.name).toBe("string");
					expect(typeof tool.description).toBe("string");
					expect(typeof tool.handler).toBe("function");
					expect(tool.annotations).toBeDefined();
				}
			}
		});
	});

	describe("Extension interface contract", () => {
		it("should allow creating a custom extension", () => {
			const customExtension: Extension = {
				id: "custom_ext",
				name: "Custom Extension",
				tools: [
					{
						name: "custom_tool",
						description: "A custom tool",
						annotations: {
							title: "Custom Tool",
							readOnlyHint: true,
							destructiveHint: false,
							idempotentHint: true,
							openWorldHint: false,
						},
						handler: async () => "result",
					},
				],
				isAvailable: () => true,
			};

			expect(customExtension.id).toBe("custom_ext");
			expect(customExtension.tools).toHaveLength(1);
			expect(customExtension.isAvailable({} as never, {} as never)).toBe(true);
		});
	});
});
