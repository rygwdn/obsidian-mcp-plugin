import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateContentTool } from "../tools/update_content";
import { MockApp } from "./mocks/obsidian";

describe("update_content tool", () => {
	let mockApp: MockApp;

	beforeEach(() => {
		vi.clearAllMocks();
		mockApp = new MockApp();
		mockApp.setFiles({
			"test.md": "This is a test file content",
			"replace.md": "This is a file with specific content to replace.",
			"multiple.md": "This has multiple matches. This has multiple matches.",
			"empty.md": "",
		});

		// Replace functions with vi.fn() to properly capture calls
		mockApp.vault.adapter.write = vi.fn(mockApp.vault.adapter.write);
		mockApp.vault.create = vi.fn(mockApp.vault.create);
	});

	describe("append mode", () => {
		it("should append content to an existing file", async () => {
			const handler = updateContentTool.handler(mockApp);
			const result = await handler({
				path: "test.md",
				mode: "append",
				content: "Some additional content",
			});

			expect(mockApp.vault.adapter.write).toHaveBeenCalled();
			expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
				"test.md",
				"This is a test file content\nSome additional content"
			);

			expect(result).toBe("Content appended successfully");
		});

		it("should add a newline if the file doesn't end with one", async () => {
			mockApp.setFiles({
				"test.md": "Content without newline",
			});

			const handler = updateContentTool.handler(mockApp);
			await handler({
				path: "test.md",
				mode: "append",
				content: "Appended content",
			});

			expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
				"test.md",
				"Content without newline\nAppended content"
			);
		});

		it("should throw an error if the file doesn't exist and create_if_missing is false", async () => {
			const handler = updateContentTool.handler(mockApp);

			await expect(
				handler({
					path: "nonexistent.md",
					mode: "append",
					content: "Some content",
				})
			).rejects.toThrow("File not found: nonexistent.md");

			expect(mockApp.vault.adapter.write).not.toHaveBeenCalled();
		});

		it("should create a new file if it doesn't exist and create_if_missing is true", async () => {
			const handler = updateContentTool.handler(mockApp);
			const result = await handler({
				path: "new_file.md",
				mode: "append",
				content: "New file content",
				create_if_missing: true,
			});

			expect(mockApp.vault.create).toHaveBeenCalled();
			expect(mockApp.vault.create).toHaveBeenCalledWith("new_file.md", "New file content");
			expect(result).toBe("File created with content");
		});
	});

	describe("replace mode", () => {
		it("should replace content in a file", async () => {
			const handler = updateContentTool.handler(mockApp);
			const result = await handler({
				path: "replace.md",
				mode: "replace",
				find: "specific content",
				content: "replacement text",
			});

			expect(mockApp.vault.adapter.write).toHaveBeenCalled();
			expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
				"replace.md",
				"This is a file with replacement text to replace."
			);
			expect(result).toBe("Content successfully replaced in replace.md");
		});

		it("should throw an error when the find parameter is not provided", async () => {
			const handler = updateContentTool.handler(mockApp);

			await expect(
				handler({
					path: "replace.md",
					mode: "replace",
					content: "new content",
				})
			).rejects.toThrow("'find' parameter is required for replace mode");
		});

		it("should throw an error when content to find is not in the file", async () => {
			const handler = updateContentTool.handler(mockApp);

			await expect(
				handler({
					path: "replace.md",
					mode: "replace",
					find: "nonexistent content",
					content: "new content",
				})
			).rejects.toThrow("Content not found in file: replace.md");
		});

		it("should throw an error when there are multiple matches", async () => {
			const handler = updateContentTool.handler(mockApp);

			await expect(
				handler({
					path: "multiple.md",
					mode: "replace",
					find: "multiple matches",
					content: "new content",
				})
			).rejects.toThrow("Multiple matches (2) found in file: multiple.md");
		});

		it("should work with empty replacement string", async () => {
			const handler = updateContentTool.handler(mockApp);
			const result = await handler({
				path: "replace.md",
				mode: "replace",
				find: "specific content",
				content: "",
			});

			expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
				"replace.md",
				"This is a file with  to replace."
			);
			expect(result).toBe("Content successfully replaced in replace.md");
		});
	});
});
