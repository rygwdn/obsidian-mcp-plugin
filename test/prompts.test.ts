import { describe, it, expect, vi, beforeEach } from "vitest";
import { MockObsidian } from "./mock_obsidian";
import { getPrompts, registerPrompts, VaultPrompt } from "../tools/prompts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("prompt tools", () => {
	let obsidian: MockObsidian;

	beforeEach(() => {
		vi.clearAllMocks();
		obsidian = new MockObsidian({
			promptsFolder: "prompts",
		});

		obsidian.setFiles({
			"prompts/test-prompt.md":
				"---\ndescription: Test Prompt Description\nargs: [param1, param2]\n---\n\nThis is a {{param1}} prompt with a {{param2}} parameter.",
			"prompts/no-args-prompt.md":
				"---\ndescription: Prompt with no args\n---\n\nThis is a prompt with no parameters.",
			"prompts/string-args-prompt.md":
				'---\ndescription: Prompt with string args\nargs: "[\\"stringArg1\\", \\"stringArg2\\"]"\n---\n\nThis is a {{stringArg1}} with {{stringArg2}}.',
		});
	});

	describe("VaultPrompt", () => {
		it("should properly initialize with correct name", async () => {
			const file = await obsidian.getFileByPath("prompts/test-prompt.md", "read");
			const prompt = new VaultPrompt(file, obsidian);

			expect(prompt.name).toBe("test-prompt");
		});

		it("should correctly get description from frontmatter", async () => {
			const file = await obsidian.getFileByPath("prompts/test-prompt.md", "read");
			const prompt = new VaultPrompt(file, obsidian);

			expect(prompt.description).toBe("Test Prompt Description");
		});

		it("should return empty string for missing description", async () => {
			const file = await obsidian.getFileByPath("prompts/test-prompt.md", "read");
			// Mock the getFileCache to return an empty frontmatter
			vi.spyOn(obsidian, "getFileCache").mockReturnValue({ frontmatter: {} });

			const prompt = new VaultPrompt(file, obsidian);
			expect(prompt.description).toBe("");
		});

		it("should correctly parse args from frontmatter", async () => {
			const file = await obsidian.getFileByPath("prompts/test-prompt.md", "read");
			const prompt = new VaultPrompt(file, obsidian);

			const args = prompt.args;
			expect(Object.keys(args)).toContain("param1");
			expect(Object.keys(args)).toContain("param2");
		});

		it("should handle string JSON args from frontmatter", async () => {
			const file = await obsidian.getFileByPath("prompts/string-args-prompt.md", "read");
			const prompt = new VaultPrompt(file, obsidian);

			const args = prompt.args;
			expect(Object.keys(args)).toContain("stringArg1");
			expect(Object.keys(args)).toContain("stringArg2");
		});

		it("should handle empty args", async () => {
			const file = await obsidian.getFileByPath("prompts/no-args-prompt.md", "read");
			const prompt = new VaultPrompt(file, obsidian);

			const args = prompt.args;
			expect(Object.keys(args)).toHaveLength(0);
		});

		it("should replace placeholder values in handler", async () => {
			const prompt = new VaultPrompt(
				await obsidian.getFileByPath("prompts/test-prompt.md", "read"),
				obsidian
			);

			const result = await prompt.handler({ param1: "test", param2: "value" });

			expect(result.messages[0].content.text).toBe("This is a test prompt with a value parameter.");
		});

		it("should register with MCP server", async () => {
			const file = await obsidian.getFileByPath("prompts/test-prompt.md", "read");
			const prompt = new VaultPrompt(file, obsidian);

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
			const file = await obsidian.getFileByPath("prompts/test-prompt.md", "read");
			const prompt = new VaultPrompt(file, obsidian);

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
		it("should return prompts from the prompts folder", async () => {
			const prompts = await getPrompts(obsidian);

			expect(prompts).toHaveLength(3);
			expect(prompts[0].name).toContain("test-prompt");
		});

		it("should return empty array when no prompts are found", async () => {
			vi.spyOn(obsidian, "getMarkdownFiles").mockReturnValue([]);

			const prompts = await getPrompts(obsidian);

			expect(prompts).toHaveLength(0);
		});
	});

	describe("registerPrompts", () => {
		it("should register all prompts with the server", async () => {
			const mockServer = {
				prompt: vi.fn(() => ({ update: vi.fn() })),
			};

			// Force getMarkdownFiles to return exactly 3 files for deterministic test
			vi.spyOn(obsidian, "getMarkdownFiles").mockReturnValue([
				await obsidian.getFileByPath("prompts/test-prompt.md", "read"),
				await obsidian.getFileByPath("prompts/no-args-prompt.md", "read"),
				await obsidian.getFileByPath("prompts/string-args-prompt.md", "read"),
			]);

			// Use valid JSON for string args to avoid errors
			vi.spyOn(obsidian, "getFileCache").mockImplementation((file: any) => {
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

			registerPrompts(obsidian, mockServer as unknown as McpServer);

			// Should register 3 prompts
			expect(mockServer.prompt).toHaveBeenCalledTimes(3);
		});

		it("should set up file modification event handler", () => {
			const mockServer = {
				prompt: vi.fn(() => ({ update: vi.fn() })),
			};

			vi.spyOn(obsidian, "onFileModified");

			registerPrompts(obsidian, mockServer as unknown as McpServer);

			expect(obsidian.onFileModified).toHaveBeenCalledWith(expect.any(Function));
		});
	});
});
