import { describe, it, expect, beforeEach } from "vitest";
import { MockObsidian, MockTimeblocks, createMockRequest } from "./mock_obsidian";
import { dataviewExtension } from "../extensions/dataview";
import { quickaddExtension } from "../extensions/quickadd";
import { tasknotesExtension } from "../extensions/tasknotes";
import { builtinExtensions } from "../extensions/builtin";
import { ExtensionRegistry } from "../extensions/registry";
import type { Extension } from "../extensions/types";
import type {
	DataviewInterface,
	QuickAddInterface,
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

class MockQuickAdd implements QuickAddInterface {
	getChoices() {
		return [];
	}
	async executeChoice(_choice: string) {
		// no-op
	}
	async formatTemplate(template: string) {
		return template;
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

	describe("quickaddExtension", () => {
		let obsidian: MockObsidian;

		beforeEach(() => {
			obsidian = new MockObsidian();
		});

		it("should have the correct id and name", () => {
			expect(quickaddExtension.id).toBe("quickadd");
			expect(quickaddExtension.name).toBe("QuickAdd");
		});

		it("should expose quickadd_list and quickadd_execute tools", () => {
			expect(quickaddExtension.tools).toHaveLength(2);
			const toolNames = quickaddExtension.tools.map((t) => t.name);
			expect(toolNames).toContain("quickadd_list");
			expect(toolNames).toContain("quickadd_execute");
		});

		it("should be available when quickadd plugin is present and enabled", () => {
			obsidian.quickAdd = new MockQuickAdd();
			const request = createMockRequest(obsidian, {
				enabledTools: {
					file_access: true,
					search: true,
					update_content: true,
					dataview_query: false,
					quickadd: true,
					tasknotes: false,
					timeblocks: false,
				},
			});

			expect(quickaddExtension.isAvailable(obsidian, request)).toBe(true);
		});

		it("should not be available when quickadd plugin is not installed", () => {
			obsidian.quickAdd = null;
			const request = createMockRequest(obsidian, {
				enabledTools: {
					file_access: true,
					search: true,
					update_content: true,
					dataview_query: false,
					quickadd: true,
					tasknotes: false,
					timeblocks: false,
				},
			});

			expect(quickaddExtension.isAvailable(obsidian, request)).toBe(false);
		});

		it("should not be available when quickadd is disabled in token", () => {
			obsidian.quickAdd = new MockQuickAdd();
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

			expect(quickaddExtension.isAvailable(obsidian, request)).toBe(false);
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

		it("should expose tasknotes and timeblocks tools", () => {
			expect(tasknotesExtension.tools).toHaveLength(4);
			const toolNames = tasknotesExtension.tools.map((t) => t.name);
			expect(toolNames).toContain("tasknotes_query");
			expect(toolNames).toContain("tasknotes");
			expect(toolNames).toContain("timeblocks_query");
			expect(toolNames).toContain("timeblocks");
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

		it("should be available when only timeblocks is enabled", () => {
			obsidian.timeblocks = new MockTimeblocks();
			const request = createMockRequest(obsidian, {
				enabledTools: {
					file_access: true,
					search: true,
					update_content: true,
					dataview_query: false,
					quickadd: false,
					tasknotes: false,
					timeblocks: true,
				},
			});

			expect(tasknotesExtension.isAvailable(obsidian, request)).toBe(true);
		});

		it("should not be available when neither tasknotes nor timeblocks is available", () => {
			obsidian.taskNotes = null;
			obsidian.timeblocks = null;
			const request = createMockRequest(obsidian, {
				enabledTools: {
					file_access: true,
					search: true,
					update_content: true,
					dataview_query: false,
					quickadd: false,
					tasknotes: true,
					timeblocks: true,
				},
			});

			expect(tasknotesExtension.isAvailable(obsidian, request)).toBe(false);
		});

		it("should not be available when both are disabled in token", () => {
			obsidian.taskNotes = new MockTaskNotes();
			obsidian.timeblocks = new MockTimeblocks();
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
		it("should contain dataview, quickadd, and tasknotes extensions", () => {
			expect(builtinExtensions).toHaveLength(3);
			const ids = builtinExtensions.map((e) => e.id);
			expect(ids).toContain("dataview_query");
			expect(ids).toContain("quickadd");
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

	describe("ExtensionRegistry", () => {
		let registry: ExtensionRegistry;

		const testExtension: Extension = {
			id: "test_ext",
			name: "Test Extension",
			tools: [
				{
					name: "test_tool",
					description: "A test tool",
					annotations: {
						title: "Test Tool",
						readOnlyHint: true,
						destructiveHint: false,
						idempotentHint: true,
						openWorldHint: false,
					},
					handler: async () => "test result",
				},
			],
			isAvailable: () => true,
		};

		beforeEach(() => {
			registry = new ExtensionRegistry();
		});

		it("should start empty", () => {
			expect(registry.getAll()).toEqual([]);
		});

		it("should register an extension", () => {
			registry.register(testExtension);
			expect(registry.getAll()).toHaveLength(1);
			expect(registry.getAll()[0].id).toBe("test_ext");
		});

		it("should register multiple extensions", () => {
			registry.register(testExtension);
			registry.register({
				...testExtension,
				id: "another_ext",
				name: "Another Extension",
			});
			expect(registry.getAll()).toHaveLength(2);
		});

		it("should replace extension with same id on re-register", () => {
			registry.register(testExtension);
			const updated = { ...testExtension, name: "Updated Extension" };
			registry.register(updated);

			expect(registry.getAll()).toHaveLength(1);
			expect(registry.getAll()[0].name).toBe("Updated Extension");
		});

		it("should unregister an extension by id", () => {
			registry.register(testExtension);
			registry.unregister("test_ext");
			expect(registry.getAll()).toEqual([]);
		});

		it("should handle unregister of non-existent id gracefully", () => {
			registry.unregister("nonexistent");
			expect(registry.getAll()).toEqual([]);
		});

		it("should preserve other extensions when unregistering one", () => {
			registry.register(testExtension);
			registry.register({
				...testExtension,
				id: "another_ext",
				name: "Another Extension",
			});
			registry.unregister("test_ext");

			expect(registry.getAll()).toHaveLength(1);
			expect(registry.getAll()[0].id).toBe("another_ext");
		});

		it("should allow registering built-in extensions", () => {
			for (const ext of builtinExtensions) {
				registry.register(ext);
			}
			expect(registry.getAll()).toHaveLength(builtinExtensions.length);
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
