import { describe, it, expect, vi, beforeEach } from "vitest";
import { quickAddListTool, quickAddExecuteTool, isQuickAddEnabled } from "../tools/quickadd";
import { MockApp } from "./mocks/obsidian";

// Create mock for QuickAdd plugin
class MockQuickAddPlugin {
	constructor() {
		this.api = {
			executeChoice: vi.fn(async () => {
				/* empty function */
			}),
			getChoices: vi.fn(() => [
				{
					id: "choice1",
					name: "Test Choice 1",
					type: "template",
					command: {
						name: "Template command",
						templatePath: "templates/template1.md",
					},
				},
				{
					id: "choice2",
					name: "Test Choice 2",
					type: "macro",
					macros: [{ name: "Macro 1" }, { name: "Macro 2" }],
				},
			]),
			format: vi.fn(async (template, variables) => {
				// Simple template formatter that replaces {{variable}} with value
				let result = template;

				if (variables) {
					for (const [key, value] of Object.entries(variables)) {
						const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, "g");
						result = result.replace(placeholder, String(value));
					}
				}

				return result;
			}),
		};
	}

	api: {
		executeChoice: ReturnType<typeof vi.fn>;
		getChoices: ReturnType<typeof vi.fn>;
		format: ReturnType<typeof vi.fn>;
	};
}

describe("quickadd tools", () => {
	let mockApp: MockApp;
	let mockQuickAdd: MockQuickAddPlugin;

	beforeEach(() => {
		vi.clearAllMocks();
		mockApp = new MockApp();
		mockQuickAdd = new MockQuickAddPlugin();

		// Set up the QuickAdd plugin in the mock app
		mockApp.plugins.enabledPlugins.add("quickadd");
		mockApp.plugins.plugins.quickadd = mockQuickAdd;
	});

	describe("isQuickAddEnabled", () => {
		it("should check if QuickAdd is enabled", () => {
			expect(isQuickAddEnabled(mockApp)).toBe(true);

			// Remove the plugin and test again
			delete mockApp.plugins.plugins.quickadd;
			expect(isQuickAddEnabled(mockApp)).toBe(false);

			// Add it back for other tests
			mockApp.plugins.plugins.quickadd = mockQuickAdd;
		});
	});

	describe("quickAddListTool", () => {
		it("should list all available QuickAdd choices", async () => {
			const handler = quickAddListTool.handler(mockApp);
			const result = await handler({});

			expect(result).toMatchInlineSnapshot(`
              "# Available QuickAdd Choices

              ## template Choices

              ### Test Choice 1
              - **ID**: \`choice1\`
              - **Command**:
                - name: Template command
                - templatePath: templates/template1.md

              ## macro Choices

              ### Test Choice 2
              - **ID**: \`choice2\`
              - **Macros**: 2 defined

              ## Usage

              To execute a choice:
              \`\`\`json
              {
                "choice": "My Choice Name"
              }
              \`\`\`

              You can also pass variables to the choice:
              \`\`\`json
              {
                "choice": "My Choice Name",
                "variables": {
                  "title": "My Document",
                  "tags": "tag1, tag2"
                }
              }
              \`\`\`

              To format a template:
              \`\`\`json
              {
                "template": "Hello {{name}}!",
                "variables": {
                  "name": "World"
                }
              }
              \`\`\`
              "
            `);
		});

		it("should return a message when no choices are found", async () => {
			mockQuickAdd.api.getChoices.mockReturnValueOnce([]);

			const handler = quickAddListTool.handler(mockApp);
			const result = await handler({});

			expect(result).toMatchInlineSnapshot(`"No QuickAdd choices found"`);
		});

		it("should throw an error if QuickAdd plugin is not enabled", async () => {
			delete mockApp.plugins.plugins.quickadd;

			const handler = quickAddListTool.handler(mockApp);

			await expect(handler({})).rejects.toThrow("QuickAdd plugin is not enabled");
		});

		it("should throw an error if the API is not available", async () => {
			// Remove the API from the mock
			mockApp.plugins.plugins.quickadd = {} as unknown;

			const handler = quickAddListTool.handler(mockApp);

			await expect(handler({})).rejects.toThrow("QuickAdd API is not available");
		});
	});

	describe("quickAddExecuteTool", () => {
		describe("choice mode", () => {
			it("should execute a choice by ID", async () => {
				const handler = quickAddExecuteTool.handler(mockApp);
				const result = await handler({
					choice: "choice1",
				});

				expect(mockQuickAdd.api.executeChoice).toHaveBeenCalledWith("choice1", undefined);
				expect(result).toMatchInlineSnapshot(
					`"Successfully executed QuickAdd choice: **Test Choice 1**"`
				);
			});

			it("should execute a choice by name", async () => {
				const handler = quickAddExecuteTool.handler(mockApp);
				const result = await handler({
					choice: "Test Choice 2",
				});

				expect(mockQuickAdd.api.executeChoice).toHaveBeenCalledWith("choice2", undefined);
				expect(result).toMatchInlineSnapshot(
					`"Successfully executed QuickAdd choice: **Test Choice 2**"`
				);
			});

			it("should pass variables to the choice execution", async () => {
				const handler = quickAddExecuteTool.handler(mockApp);
				const variables = {
					title: "Test Title",
					content: "Test Content",
				};

				const result = await handler({
					choice: "choice1",
					variables,
				});

				expect(mockQuickAdd.api.executeChoice).toHaveBeenCalledWith("choice1", variables);
				expect(result).toMatchInlineSnapshot(
					`"Successfully executed QuickAdd choice: **Test Choice 1**"`
				);
			});

			it("should throw an error if the choice is not found", async () => {
				const handler = quickAddExecuteTool.handler(mockApp);

				await expect(
					handler({
						choice: "nonexistent",
					})
				).rejects.toThrow(/QuickAdd choice not found: nonexistent/);

				expect(mockQuickAdd.api.executeChoice).not.toHaveBeenCalled();
			});

			it("should handle errors from executeChoice", async () => {
				const errorMessage = "Error executing choice";
				mockQuickAdd.api.executeChoice.mockRejectedValueOnce(new Error(errorMessage));

				const handler = quickAddExecuteTool.handler(mockApp);

				await expect(
					handler({
						choice: "choice1",
					})
				).rejects.toThrow(`Error executing QuickAdd choice: ${errorMessage}`);
			});
		});

		describe("template mode", () => {
			it("should format a template with variables", async () => {
				const handler = quickAddExecuteTool.handler(mockApp);
				const template = "Hello {{name}}!";
				const variables = { name: "World" };

				const result = await handler({
					template,
					variables,
				});

				expect(mockQuickAdd.api.format).toHaveBeenCalledWith(template, variables, true);
				expect(result).toMatchInlineSnapshot(`"Hello World!"`);
			});

			it("should format a complex template with multiple variables", async () => {
				const handler = quickAddExecuteTool.handler(mockApp);
				const template = "# {{title}}\n\nCreated by: {{author}}\nDate: {{date}}";
				const variables = {
					title: "My Document",
					author: "Test User",
					date: "2025-05-10",
				};

				const result = await handler({
					template,
					variables,
				});

				expect(mockQuickAdd.api.format).toHaveBeenCalledWith(template, variables, true);
				expect(result).toMatchInlineSnapshot(
					`"# My Document\n\nCreated by: Test User\nDate: 2025-05-10"`
				);
			});

			it("should support variables of different types", async () => {
				const handler = quickAddExecuteTool.handler(mockApp);
				const template = "Count: {{count}}\nActive: {{active}}";
				const variables = {
					count: 42,
					active: true,
				};

				const result = await handler({
					template,
					variables,
				});

				expect(mockQuickAdd.api.format).toHaveBeenCalledWith(template, variables, true);
				expect(result).toMatchInlineSnapshot(`"Count: 42\nActive: true"`);
			});

			it("should handle errors from format", async () => {
				const errorMessage = "Error formatting template";
				mockQuickAdd.api.format.mockRejectedValueOnce(new Error(errorMessage));

				const handler = quickAddExecuteTool.handler(mockApp);

				await expect(
					handler({
						template: "Hello {{name}}!",
					})
				).rejects.toThrow(`Error formatting template: ${errorMessage}`);
			});
		});

		describe("error handling", () => {
			it("should throw an error if neither choice nor template is provided", async () => {
				const handler = quickAddExecuteTool.handler(mockApp);

				await expect(handler({})).rejects.toThrow(
					"You must provide exactly one of 'choice' or 'template' parameters"
				);
			});

			it("should throw an error if both choice and template are provided", async () => {
				const handler = quickAddExecuteTool.handler(mockApp);

				await expect(
					handler({
						choice: "choice1",
						template: "Hello {{name}}!",
					})
				).rejects.toThrow("You must provide exactly one of 'choice' or 'template' parameters");
			});

			it("should throw an error if QuickAdd plugin is not enabled", async () => {
				delete mockApp.plugins.plugins.quickadd;

				const handler = quickAddExecuteTool.handler(mockApp);

				await expect(
					handler({
						choice: "choice1",
					})
				).rejects.toThrow("QuickAdd plugin is not enabled");
			});

			it("should throw an error if the API is not available", async () => {
				// Remove the API from the mock
				mockApp.plugins.plugins.quickadd = {} as unknown;

				const handler = quickAddExecuteTool.handler(mockApp);

				await expect(
					handler({
						choice: "choice1",
					})
				).rejects.toThrow("QuickAdd API is not available");
			});
		});
	});
});
