import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { updateContentTool } from "../tools/update_content";
import { MockApp, MockFile } from "./mocks/obsidian";

// Import moment for testing only
import moment from "moment";

// Set a fixed date for testing
const MOCK_DATE = new Date("2023-05-09T12:00:00.000Z");

describe("update_content tool annotations", () => {
	it("should have the correct annotations for the tool", () => {
		expect(updateContentTool.annotations).toEqual({
			title: "Update File Content",
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: false,
		});
	});
});

describe("update_content tool", () => {
	let mockApp: MockApp;

	beforeEach(() => {
		// Setup fake timers and set a fixed date
		vi.useFakeTimers();
		vi.setSystemTime(MOCK_DATE);

		vi.clearAllMocks();
		mockApp = new MockApp();

		// Mock the window.moment object for consistent date testing
		vi.stubGlobal("window", {
			moment: (...args: unknown[]) => {
				if (args.length === 0) {
					return moment(MOCK_DATE);
				}
				if (args.length === 1) {
					return moment(args[0] as moment.MomentInput);
				}
				return moment(args[0] as moment.MomentInput, args[1] as string);
			},
		});

		mockApp.setFiles({
			"test.md": "This is a test file content",
			"replace.md": "This is a file with specific content to replace.",
			"multiple.md": "This has multiple matches. This has multiple matches.",
			"empty.md": "",
			"daily/2023-05-09.md": "# Today's Note\nThis is today's note content.",
			"daily/2023-05-08.md": "# Yesterday's Note\nThis is yesterday's note content.",
			"daily/2023-05-10.md": "# Tomorrow's Note\nThis is tomorrow's note content.",
		});

		// Replace functions with vi.fn() to properly capture calls
		mockApp.vault.adapter.write = vi.fn(mockApp.vault.adapter.write);
		mockApp.vault.create = vi.fn(mockApp.vault.create);
		mockApp.vault.modify = vi.fn(mockApp.vault.modify);

		// Enable daily notes plugin
		mockApp.internalPlugins.plugins["daily-notes"] = {
			enabled: true,
			instance: {
				options: {
					folder: "daily",
					format: "YYYY-MM-DD",
				},
			},
		};
	});

	afterEach(() => {
		// Restore real timers after each test
		vi.useRealTimers();
	});

	describe("regular file handling", () => {
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

	describe("daily:// URI handling", () => {
		describe("append mode", () => {
			it("should append content to today's daily note", async () => {
				const handler = updateContentTool.handler(mockApp);
				const result = await handler({
					path: "daily://today",
					mode: "append",
					content: "New content appended.",
				});

				expect(result).toContain("Content appended successfully to daily note: today");

				// Verify content was updated
				expect(mockApp.vault.modify).toHaveBeenCalled();
				const file = mockApp.vault.getFileByPath("daily/2023-05-09.md");
				expect(file).toBeDefined();
			});

			it("should throw error when daily note doesn't exist and create_if_missing is false", async () => {
				// Remove today's note
				mockApp.mockVault.files.delete("daily/2023-05-09.md");

				const handler = updateContentTool.handler(mockApp);
				await expect(
					handler({
						path: "daily://today",
						mode: "append",
						content: "New content.",
					})
				).rejects.toThrow(
					"Daily note not found: today. Use create_if_missing: true parameter to create it."
				);
			});

			it("should create and append to daily note when it doesn't exist and create_if_missing is true", async () => {
				// Remove today's note
				mockApp.mockVault.files.delete("daily/2023-05-09.md");

				// Mock the create method
				mockApp.vault.create = vi.fn(async (path, content) => {
					const file = new MockFile(path, content);
					mockApp.mockVault.files.set(path, file);
					return file;
				});

				const handler = updateContentTool.handler(mockApp);
				const result = await handler({
					path: "daily://today",
					mode: "append",
					content: "New daily note content.",
					create_if_missing: true,
				});

				// When first creating a daily note using updateContentTool with append mode
				expect(result).toContain("Content appended successfully");

				// Verify the file was created with content
				const file = mockApp.mockVault.files.get("daily/2023-05-09.md");
				expect(file).toBeDefined();
				// Use contains instead of exact match due to possible whitespace differences
				expect(file?.contents).toContain("New daily note content.");
			});

			it("should throw error when no daily notes plugin is enabled", async () => {
				// Disable the daily notes plugin
				mockApp.internalPlugins.plugins["daily-notes"].enabled = false;
				mockApp.plugins.plugins["periodic-notes"] = null as any;

				const handler = updateContentTool.handler(mockApp);
				await expect(
					handler({
						path: "daily://today",
						mode: "append",
						content: "New content.",
					})
				).rejects.toThrow("Cannot access daily notes: No daily notes plugin is enabled");
			});
		});

		describe("replace mode", () => {
			it("should replace content in today's daily note", async () => {
				const handler = updateContentTool.handler(mockApp);
				const result = await handler({
					path: "daily://today",
					mode: "replace",
					find: "This is today's note content.",
					content: "This content has been replaced.",
				});

				expect(result).toContain("Content successfully replaced in daily note: today");

				// Verify content was updated
				expect(mockApp.vault.modify).toHaveBeenCalled();
				const file = mockApp.vault.getFileByPath("daily/2023-05-09.md");
				expect(file).toBeDefined();
			});

			it("should throw error when using replace mode without find parameter", async () => {
				const handler = updateContentTool.handler(mockApp);
				await expect(
					handler({
						path: "daily://today",
						mode: "replace",
						content: "Replacement content.",
					})
				).rejects.toThrow("'find' parameter is required for replace mode");
			});

			it("should throw error when content to find is not in the daily note", async () => {
				const handler = updateContentTool.handler(mockApp);
				await expect(
					handler({
						path: "daily://today",
						mode: "replace",
						find: "nonexistent content",
						content: "new content",
					})
				).rejects.toThrow("Content not found in daily note: today");
			});

			it("should throw error when there are multiple matches in the daily note", async () => {
				// Set up a note with multiple matches
				mockApp.mockVault.files.set(
					"daily/2023-05-09.md",
					new MockFile(
						"daily/2023-05-09.md",
						"This has duplicate content. This has duplicate content."
					)
				);

				const handler = updateContentTool.handler(mockApp);
				await expect(
					handler({
						path: "daily://today",
						mode: "replace",
						find: "duplicate content",
						content: "new content",
					})
				).rejects.toThrow("Multiple matches (2) found in daily note: today");
			});
		});
	});
});
