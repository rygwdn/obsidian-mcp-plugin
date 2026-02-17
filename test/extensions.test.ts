import { describe, it, expect, beforeEach } from "vitest";
import { dataviewExtension } from "../extensions/dataview";
import { quickaddExtension } from "../extensions/quickadd";
import { tasknotesExtension } from "../extensions/tasknotes";
import { builtinExtensions } from "../extensions/builtin";
import { ExtensionRegistry } from "../extensions/registry";
import type { Extension } from "../extensions/types";

describe("Extension API", () => {
	describe("dataviewExtension", () => {
		it("should have the correct id and name", () => {
			expect(dataviewExtension.id).toBe("dataview");
			expect(dataviewExtension.name).toBe("Dataview");
		});

		it("should expose the dataview_query tool", () => {
			expect(dataviewExtension.tools).toHaveLength(1);
			expect(dataviewExtension.tools[0].name).toBe("dataview_query");
		});
	});

	describe("quickaddExtension", () => {
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
	});

	describe("tasknotesExtension", () => {
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
	});

	describe("builtinExtensions registry", () => {
		it("should contain dataview, quickadd, and tasknotes extensions", () => {
			expect(builtinExtensions).toHaveLength(3);
			const ids = builtinExtensions.map((e) => e.id);
			expect(ids).toContain("dataview");
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
			}
		});

		it("every extension tool should have required ExtensionTool fields", () => {
			for (const ext of builtinExtensions) {
				for (const tool of ext.tools) {
					expect(typeof tool.name).toBe("string");
					expect(typeof tool.description).toBe("string");
					expect(typeof tool.handler).toBe("function");
					expect(tool.hints).toBeDefined();
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
					title: "Test Tool",
					description: "A test tool",
					hints: {
						readOnly: true,
						idempotent: true,
					},
					handler: async () => "test result",
				},
			],
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
						title: "Custom Tool",
						description: "A custom tool",
						hints: {
							readOnly: true,
							idempotent: true,
						},
						handler: async () => "result",
					},
				],
			};

			expect(customExtension.id).toBe("custom_ext");
			expect(customExtension.tools).toHaveLength(1);
		});
	});
});
