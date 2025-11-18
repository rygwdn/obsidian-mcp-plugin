import { describe, it, expect, vi, beforeEach } from "vitest";
import { quickAddListTool, quickAddExecuteTool } from "../tools/quickadd";
import { MockObsidian, createMockRequest } from "./mock_obsidian";
import type { QuickAddChoice, QuickAddInterface } from "../obsidian/obsidian_interface";

describe("quickadd tool annotations", () => {
	it("should have the correct annotations for the list tool", () => {
		expect(quickAddListTool.annotations).toEqual({
			title: "QuickAdd List Tool",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		});
	});

	it("should have the correct annotations for the execute tool", () => {
		expect(quickAddExecuteTool.annotations).toEqual({
			title: "QuickAdd Execute Tool",
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: false,
		});
	});
});

class MockQuickAdd implements QuickAddInterface {
	private choices: QuickAddChoice[] = [];
	private templateResults: Map<string, string> = new Map();
	private templateErrors: Map<string, string> = new Map();

	getChoices(): QuickAddChoice[] {
		return this.choices;
	}

	setChoices(choices: QuickAddChoice[]): void {
		this.choices = choices;
	}

	async executeChoice(choiceNameOrId: string, _variables?: Record<string, string>): Promise<void> {
		const choice = this.choices.find((c) => c.id === choiceNameOrId || c.name === choiceNameOrId);
		if (!choice) {
			throw new Error(`Choice not found: ${choiceNameOrId}`);
		}
	}

	async formatTemplate(
		template: string,
		_variables?: Record<string, unknown>,
		_clearVariables?: boolean
	): Promise<string> {
		if (this.templateErrors.has(template)) {
			throw new Error(this.templateErrors.get(template));
		}
		if (this.templateResults.has(template)) {
			return this.templateResults.get(template)!;
		}
		throw new Error(`No mock result for template: ${template}`);
	}

	setTemplateResult(template: string, result: string): void {
		this.templateResults.set(template, result);
	}

	setTemplateError(template: string, error: string): void {
		this.templateErrors.set(template, error);
	}
}

describe("quickadd tools", () => {
	let obsidian: MockObsidian;
	let quickAddPlugin: MockQuickAdd;
	let request: ReturnType<typeof createMockRequest>;

	beforeEach(() => {
		vi.clearAllMocks();
		obsidian = new MockObsidian();
		request = createMockRequest(obsidian);

		quickAddPlugin = new MockQuickAdd();
		obsidian.quickAdd = quickAddPlugin;

		const testChoices: QuickAddChoice[] = [
			{
				id: "choice1",
				name: "Test Choice 1",
				type: "template",
				format: {
					enabled: true,
					format:
						"Title: {{VALUE:title}}\nTags: {{VALUE:tags}}\nDue Date: {{VDATE:dueDate, YYYY-MM-DD}}\nContent: {{VALUE}}",
				},
			},
			{
				id: "choice2",
				name: "Test Choice 2",
				type: "macro",
			},
			{
				id: "choice3",
				name: "Test Choice 3",
				type: "template",
			},
		];

		quickAddPlugin.setChoices(testChoices);

		quickAddPlugin.setTemplateResult("Hello {{name}}!", "Hello World!");
		quickAddPlugin.setTemplateResult(
			"# {{title}}\n\nCreated by: {{author}}\nDate: {{date}}",
			"# My Document\n\nCreated by: Test User\nDate: 2025-05-10"
		);
		quickAddPlugin.setTemplateResult(
			"Count: {{count}}\nActive: {{active}}",
			"Count: 42\nActive: true"
		);
	});

	describe("quickAddListTool", () => {
		it("should list all available QuickAdd choices with variables", async () => {
			const result = await quickAddListTool.handler(obsidian, request, {});

			// Use inline snapshot for the entire output
			expect(result).toMatchInlineSnapshot(`
				"# Available QuickAdd Choices

				- "Test Choice 1" with variables: ["title","tags","dueDate"]
				- "Test Choice 2"
				- "Test Choice 3"
				"
			`);
		});

		it("should return a message when no choices are found", async () => {
			quickAddPlugin.setChoices([]);

			const result = await quickAddListTool.handler(obsidian, request, {});

			expect(result).toBe("No QuickAdd choices found");
		});

		it("should throw an error if QuickAdd plugin is not enabled", async () => {
			obsidian.quickAdd = null;

			await expect(quickAddListTool.handler(obsidian, request, {})).rejects.toThrow(
				"QuickAdd plugin is not enabled"
			);
		});

		it("should throw an error if the API is not available", async () => {
			// This is harder to test with the new interface, but we can disable the plugin
			// which should have the same effect
			obsidian.quickAdd = null;

			await expect(quickAddListTool.handler(obsidian, request, {})).rejects.toThrow(
				"QuickAdd plugin is not enabled"
			);
		});
	});

	describe("quickAddExecuteTool", () => {
		describe("choice mode", () => {
			it("should execute a choice by ID", async () => {
				const executeChoiceSpy = vi.spyOn(quickAddPlugin, "executeChoice");

				const result = await quickAddExecuteTool.handler(obsidian, request, {
					choice: "choice1",
				});

				expect(executeChoiceSpy).toHaveBeenCalledWith("Test Choice 1", undefined);
				expect(result).toBe("Successfully executed QuickAdd choice: **Test Choice 1**");
			});

			it("should execute a choice by name", async () => {
				const executeChoiceSpy = vi.spyOn(quickAddPlugin, "executeChoice");

				const result = await quickAddExecuteTool.handler(obsidian, request, {
					choice: "Test Choice 2",
				});

				expect(executeChoiceSpy).toHaveBeenCalledWith("Test Choice 2", undefined);
				expect(result).toBe("Successfully executed QuickAdd choice: **Test Choice 2**");
			});

			it("should pass variables to the choice execution", async () => {
				const executeChoiceSpy = vi.spyOn(quickAddPlugin, "executeChoice");

				const variables = {
					title: "Test Title",
					content: "Test Content",
				};

				const result = await quickAddExecuteTool.handler(obsidian, request, {
					choice: "choice1",
					variables,
				});

				expect(executeChoiceSpy).toHaveBeenCalledWith("Test Choice 1", variables);
				expect(result).toBe("Successfully executed QuickAdd choice: **Test Choice 1**");
			});

			it("should throw an error if the choice is not found", async () => {
				await expect(
					quickAddExecuteTool.handler(obsidian, request, {
						choice: "nonexistent",
					})
				).rejects.toThrow(/QuickAdd choice not found: nonexistent/);
			});

			it("should handle errors from executeChoice", async () => {
				const errorMessage = "Error executing choice";
				const executeChoiceSpy = vi.spyOn(quickAddPlugin, "executeChoice");
				executeChoiceSpy.mockRejectedValueOnce(new Error(errorMessage));

				await expect(
					quickAddExecuteTool.handler(obsidian, request, {
						choice: "choice1",
					})
				).rejects.toThrow(`Error executing QuickAdd choice: ${errorMessage}`);
			});
		});

		describe("template mode", () => {
			it("should format a template with variables", async () => {
				const formatTemplateSpy = vi.spyOn(quickAddPlugin, "formatTemplate");

				const template = "Hello {{name}}!";
				const variables = { name: "World" };

				const result = await quickAddExecuteTool.handler(obsidian, request, {
					template,
					variables,
				});

				expect(formatTemplateSpy).toHaveBeenCalledWith(template, variables, true);
				expect(result).toBe("Hello World!");
			});

			it("should format a complex template with multiple variables", async () => {
				const formatTemplateSpy = vi.spyOn(quickAddPlugin, "formatTemplate");

				const template = "# {{title}}\n\nCreated by: {{author}}\nDate: {{date}}";
				const variables = {
					title: "My Document",
					author: "Test User",
					date: "2025-05-10",
				};

				const result = await quickAddExecuteTool.handler(obsidian, request, {
					template,
					variables,
				});

				expect(formatTemplateSpy).toHaveBeenCalledWith(template, variables, true);
				expect(result).toBe("# My Document\n\nCreated by: Test User\nDate: 2025-05-10");
			});

			it("should support variables of different types", async () => {
				const formatTemplateSpy = vi.spyOn(quickAddPlugin, "formatTemplate");

				const template = "Count: {{count}}\nActive: {{active}}";
				const variables = {
					count: 42,
					active: true,
				};

				const result = await quickAddExecuteTool.handler(obsidian, request, {
					template,
					variables,
				});

				expect(formatTemplateSpy).toHaveBeenCalledWith(template, variables, true);
				expect(result).toBe("Count: 42\nActive: true");
			});

			it("should handle errors from format", async () => {
				const errorMessage = "Error formatting template";
				const formatTemplateSpy = vi.spyOn(quickAddPlugin, "formatTemplate");
				formatTemplateSpy.mockRejectedValueOnce(new Error(errorMessage));

				await expect(
					quickAddExecuteTool.handler(obsidian, request, {
						template: "Hello {{name}}!",
					})
				).rejects.toThrow(`Error formatting template: ${errorMessage}`);
			});
		});

		describe("error handling", () => {
			it("should throw an error if neither choice nor template is provided", async () => {
				await expect(quickAddExecuteTool.handler(obsidian, request, {})).rejects.toThrow(
					"You must provide exactly one of 'choice' or 'template' parameters"
				);
			});

			it("should throw an error if both choice and template are provided", async () => {
				await expect(
					quickAddExecuteTool.handler(obsidian, request, {
						choice: "choice1",
						template: "Hello {{name}}!",
					})
				).rejects.toThrow("You must provide exactly one of 'choice' or 'template' parameters");
			});

			it("should throw an error if QuickAdd plugin is not enabled", async () => {
				obsidian.quickAdd = null;

				await expect(
					quickAddExecuteTool.handler(obsidian, request, {
						choice: "choice1",
					})
				).rejects.toThrow("QuickAdd plugin is not enabled");
			});

			it("should throw an error if the API is not available", async () => {
				obsidian.quickAdd = null;

				await expect(
					quickAddExecuteTool.handler(obsidian, request, {
						choice: "choice1",
					})
				).rejects.toThrow("QuickAdd plugin is not enabled");
			});
		});
	});
});
