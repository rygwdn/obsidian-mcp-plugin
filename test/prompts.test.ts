import { describe, it, expect, vi, beforeEach } from "vitest";
import { MockApp, MockFile } from "./mocks/obsidian";
import { getPrompts, registerPrompts, VaultPrompt } from "../tools/prompts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DEFAULT_SETTINGS } from "../settings";

describe("prompt tools", () => {
	let mockApp: MockApp;

	beforeEach(() => {
		vi.clearAllMocks();
		mockApp = new MockApp();

		mockApp.setFiles({
			"prompts/test-prompt.md":
				"---\ndescription: Test Prompt Description\nargs: [param1, param2]\n---\n\nThis is a {{param1}} prompt with a {{param2}} parameter.",
			"prompts/no-args-prompt.md":
				"---\ndescription: Prompt with no args\n---\n\nThis is a prompt with no parameters.",
			"prompts/string-args-prompt.md":
				'---\ndescription: Prompt with string args\nargs: "[\\"stringArg1\\", \\"stringArg2\\"]"\n---\n\nThis is a {{stringArg1}} with {{stringArg2}}.',
		});
	});

	describe("VaultPrompt", () => {
		it("should properly initialize with correct name", () => {
			const file = mockApp.vault.getFileByPath("prompts/test-prompt.md") as MockFile;
			const prompt = new VaultPrompt(file, mockApp);

			expect(prompt.name).toBe("test-prompt");
		});

		it("should correctly get description from frontmatter", () => {
			const file = mockApp.vault.getFileByPath("prompts/test-prompt.md") as MockFile;
			const prompt = new VaultPrompt(file, mockApp);

			expect(prompt.description).toBe("Test Prompt Description");
		});

		it("should return empty string for missing description", () => {
			const file = mockApp.vault.getFileByPath("prompts/test-prompt.md") as MockFile;
			mockApp.metadataCache.getFileCache = vi.fn(() => ({ frontmatter: {} }));

			const prompt = new VaultPrompt(file, mockApp);
			expect(prompt.description).toBe("");
		});

		it("should correctly parse args from frontmatter", () => {
			const file = mockApp.vault.getFileByPath("prompts/test-prompt.md") as MockFile;
			const prompt = new VaultPrompt(file, mockApp);

			const args = prompt.args;
			expect(Object.keys(args)).toContain("param1");
			expect(Object.keys(args)).toContain("param2");
		});

		it("should handle string JSON args from frontmatter", () => {
			const file = mockApp.vault.getFileByPath("prompts/string-args-prompt.md") as MockFile;
			const prompt = new VaultPrompt(file, mockApp);

			const args = prompt.args;
			expect(Object.keys(args)).toContain("stringArg1");
			expect(Object.keys(args)).toContain("stringArg2");
		});

		it("should handle empty args", () => {
			const file = mockApp.vault.getFileByPath("prompts/no-args-prompt.md") as MockFile;
			const prompt = new VaultPrompt(file, mockApp);

			const args = prompt.args;
			expect(Object.keys(args)).toHaveLength(0);
		});

		it("should replace placeholder values in handler", async () => {
			const prompt = new VaultPrompt(
				mockApp.vault.getFileByPath("prompts/test-prompt.md") as MockFile,
				mockApp
			);

			const result = await prompt.handler({ param1: "test", param2: "value" });

			expect(result.messages[0].content.text).toBe("This is a test prompt with a value parameter.");
		});

		it("should register with MCP server", async () => {
			const file = mockApp.vault.getFileByPath("prompts/test-prompt.md") as MockFile;
			const prompt = new VaultPrompt(file, mockApp);

			const mockServer = {
				prompt: vi.fn(() => ({ update: vi.fn() })),
			};

			await prompt.register(mockServer as unknown as McpServer);

			expect(mockServer.prompt).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String),
				expect.any(Object),
				expect.any(Function)
			);
			expect(prompt.registration).toBeDefined();
		});

		it("should update registration when called", async () => {
			const file = mockApp.vault.getFileByPath("prompts/test-prompt.md") as MockFile;
			const prompt = new VaultPrompt(file, mockApp);

			const mockUpdate = vi.fn();
			const mockServer = {
				prompt: vi.fn(() => ({ update: mockUpdate })),
			};

			await prompt.register(mockServer as unknown as McpServer);
			prompt.update();

			expect(mockUpdate).toHaveBeenCalledWith({
				description: "Test Prompt Description",
				argsSchema: expect.any(Object),
			});
		});
	});

	describe("getPrompts", () => {
		it("should return prompts from the prompts folder", () => {
			const prompts = getPrompts(mockApp, DEFAULT_SETTINGS);

			expect(prompts).toHaveLength(3);
			expect(prompts[0].name).toContain("test-prompt");
		});

		it("should return empty array when no prompts are found", () => {
			mockApp.vault.getMarkdownFiles = vi.fn().mockReturnValue([]);

			const prompts = getPrompts(mockApp, DEFAULT_SETTINGS);

			expect(prompts).toHaveLength(0);
		});
	});

	describe("registerPrompts", () => {
		it("should register all prompts with the server", () => {
			const mockServer = {
				prompt: vi.fn(() => ({ update: vi.fn() })),
			};

			// Force getMarkdownFiles to return exactly 3 files for deterministic test
			mockApp.vault.getMarkdownFiles = vi
				.fn()
				.mockReturnValue([
					mockApp.vault.getFileByPath("prompts/test-prompt.md"),
					mockApp.vault.getFileByPath("prompts/no-args-prompt.md"),
					mockApp.vault.getFileByPath("prompts/string-args-prompt.md"),
				]);

			// Use valid JSON for string args to avoid errors
			mockApp.metadataCache.getFileCache = vi.fn((file) => {
				if (file.path === "prompts/string-args-prompt.md") {
					return {
						frontmatter: {
							description: "Prompt with string args",
							args: '["stringArg1", "stringArg2"]',
						},
					};
				}
				return {
					frontmatter: {
						description: "Test description",
						args: ["param1"],
					},
				};
			});

			registerPrompts(mockApp, mockServer as unknown as McpServer, DEFAULT_SETTINGS);

			// Should register 3 prompts
			expect(mockServer.prompt).toHaveBeenCalledTimes(3);
		});

		it("should set up vault modify event handler", () => {
			const mockServer = {
				prompt: vi.fn(() => ({ update: vi.fn() })),
			};

			registerPrompts(mockApp, mockServer as unknown as McpServer, DEFAULT_SETTINGS);

			expect(mockApp.vault.on).toHaveBeenCalledWith("modify", expect.any(Function));
		});
	});
});
