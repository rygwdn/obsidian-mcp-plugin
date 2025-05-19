import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { MockObsidian } from "./mock_obsidian";
import { registerPrompts, VaultPrompt } from "../tools/prompts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("prompt tools", () => {
	let obsidian: MockObsidian;
	let mockServer: McpServer;
	let updateFn: Mock;

	beforeEach(() => {
		vi.clearAllMocks();
		obsidian = new MockObsidian({
			promptsFolder: "prompts",
		});
		updateFn = vi.fn();
		mockServer = {
			prompt: vi.fn(() => ({
				update: updateFn,
			})),
		} as unknown as McpServer;

		obsidian.setFiles({
			"prompts/test-prompt.md": [
				"---",
				"description: Test Prompt Description",
				"args: [param1, param2]",
				"---",
				"This is a {{param1}} prompt with a {{param2}} parameter.",
			].join("\n"),

			"prompts/no-args-prompt.md": [
				"---",
				"description: Prompt with no args",
				"---",
				"This is a prompt with no parameters.",
			].join("\n"),

			"prompts/string-args-prompt.md": [
				"---",
				"description: Prompt with string args",
				'args: "[\\"stringArg1\\", \\"stringArg2\\"]"',
				"---",
				"This is a {{stringArg1}} with {{stringArg2}}.",
			].join("\n"),
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

			await prompt.register(mockServer);

			expect(mockServer.prompt).toHaveBeenCalledWith(
				"test-prompt",
				"Test Prompt Description",
				expect.objectContaining({ param1: expect.anything(), param2: expect.anything() }),
				expect.any(Function)
			);
			expect(prompt.registration).toBeDefined();
		});

		it("should update registration when called", async () => {
			const file = await obsidian.getFileByPath("prompts/test-prompt.md", "read");
			const prompt = new VaultPrompt(file, obsidian);

			await prompt.register(mockServer);
			prompt.update();

			expect(updateFn).toHaveBeenCalledWith(
				expect.objectContaining({
					description: "Test Prompt Description",
					argsSchema: expect.any(Object),
				})
			);
		});
	});

	describe("registerPrompts", () => {
		beforeEach(() => {
			obsidian.clearFiles();
			obsidian.setFiles({
				"prompts/initial1.md": "---\nname: initial1\ndescription: Initial1 desc\n---\nContent1",
				"prompts/initial2.md": "---\nname: initial2\ndescription: Initial2 desc\n---\nContent2",
			});
			vi.spyOn(obsidian, "onFileModified");
		});

		it("should register all initial prompts with the server", () => {
			registerPrompts(obsidian, mockServer as unknown as McpServer);
			expect(mockServer.prompt).toHaveBeenCalledTimes(2);
			expect(mockServer.prompt).toHaveBeenCalledWith(
				"initial1",
				"Initial1 desc",
				expect.any(Object),
				expect.any(Function)
			);
			expect(mockServer.prompt).toHaveBeenCalledWith(
				"initial2",
				"Initial2 desc",
				expect.any(Object),
				expect.any(Function)
			);
		});

		it("should set up file modification event handler and react to changes", async () => {
			registerPrompts(obsidian, mockServer);
			expect(obsidian.onFileModified).toHaveBeenCalledWith(expect.any(Function));
			expect(obsidian.modifiedCallback).toBeDefined();

			const file = obsidian.markdownFiles.get("prompts/initial1.md")!;
			file.contents = "---\nname: initial1\ndescription: UPDATED Initial1 desc\n---\nContent1";

			obsidian.modifiedCallback?.("modify", file);
			expect(updateFn).toHaveBeenCalledWith(
				expect.objectContaining({ description: "UPDATED Initial1 desc" })
			);
		});

		it("should handle delete operation", async () => {
			registerPrompts(obsidian, mockServer);
			expect(obsidian.onFileModified).toHaveBeenCalledWith(expect.any(Function));
			expect(obsidian.modifiedCallback).toBeDefined();

			const file = obsidian.markdownFiles.get("prompts/initial1.md")!;

			vi.mocked(mockServer.prompt).mockClear();
			obsidian.modifiedCallback?.("delete", file);
			expect(updateFn).not.toHaveBeenCalled();
			expect(mockServer.prompt).not.toHaveBeenCalled();
		});

		it("should handle create operation", async () => {
			registerPrompts(obsidian, mockServer);
			expect(obsidian.onFileModified).toHaveBeenCalledWith(expect.any(Function));
			expect(obsidian.modifiedCallback).toBeDefined();

			const newFilePath = "prompts/created-prompt.md";
			obsidian.setFiles({
				[newFilePath]: "---\nname: created-prompt\ndescription: Created Prompt\n---\nNew content",
			});
			vi.mocked(mockServer.prompt).mockClear();

			obsidian.modifiedCallback?.("create", obsidian.markdownFiles.get(newFilePath)!);

			expect(mockServer.prompt).toHaveBeenCalledTimes(1);
			expect(mockServer.prompt).toHaveBeenCalledWith(
				"created-prompt",
				"Created Prompt",
				expect.any(Object),
				expect.any(Function)
			);
		});

		it("should handle rename operation", async () => {
			registerPrompts(obsidian, mockServer);
			expect(obsidian.onFileModified).toHaveBeenCalledWith(expect.any(Function));
			expect(obsidian.modifiedCallback).toBeDefined();

			const oldRenamedPath = "prompts/initial1.md";
			const newRenamedPath = "prompts/renamed-prompt.md";

			obsidian.deleteFile(oldRenamedPath);
			obsidian.setFiles({
				[newRenamedPath]:
					"---\nname: renamed-prompt\ndescription: Renamed Prompt\n---\nRenamed content",
			});

			vi.mocked(mockServer.prompt).mockClear();
			obsidian.modifiedCallback?.("rename", obsidian.markdownFiles.get(newRenamedPath)!);

			expect(mockServer.prompt).toHaveBeenCalledTimes(1);
			expect(mockServer.prompt).toHaveBeenCalledWith(
				"renamed-prompt",
				"Renamed Prompt",
				expect.any(Object),
				expect.any(Function)
			);

			expect(updateFn).toHaveBeenCalledWith(
				expect.objectContaining({ description: "Renamed Prompt" })
			);
		});
	});
});
