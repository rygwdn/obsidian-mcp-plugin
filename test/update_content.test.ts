import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { updateContentTool } from "../tools/update_content";
import { MockObsidian, createMockRequest } from "./mock_obsidian";
import moment from "moment";

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
	let obsidian: MockObsidian;
	let request: ReturnType<typeof createMockRequest>;

	beforeEach(() => {
		// Setup fake timers and set a fixed date
		vi.useFakeTimers();
		vi.setSystemTime(MOCK_DATE);

		vi.clearAllMocks();
		obsidian = new MockObsidian();
		request = createMockRequest(obsidian);

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

		obsidian.setFiles({
			"test.md": "This is a test file content",
			"replace.md": "This is a file with specific content to replace.",
			"multiple.md": "This has multiple matches. This has multiple matches.",
			"empty.md": "",
			"daily/2023-05-09.md": "# Today's Note\nThis is today's note content.",
			"daily/2023-05-08.md": "# Yesterday's Note\nThis is yesterday's note content.",
			"daily/2023-05-10.md": "# Tomorrow's Note\nThis is tomorrow's note content.",
		});

		obsidian.dailyNotes = {
			format: "YYYY-MM-DD",
			folder: "daily",
		};
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("regular file handling", () => {
		describe("append mode", () => {
			it("should append content to an existing file", async () => {
				const result = await updateContentTool.handler(obsidian, request, {
					uri: "file:///test.md",
					mode: "append",
					content: "Some additional content",
				});

				const file = obsidian.markdownFiles.get("test.md")!.contents;
				expect(file).toContain("Some additional content");
				expect(result).toContain("Content appended successfully");
			});

			it("should add a newline if the file doesn't end with one", async () => {
				obsidian.setFiles({
					"test.md": "Content without newline",
				});

				await updateContentTool.handler(obsidian, request, {
					uri: "file:///test.md",
					mode: "append",
					content: "Appended content",
				});

				const file = obsidian.markdownFiles.get("test.md")!.contents;
				expect(file).toMatchInlineSnapshot(`
					"Content without newline
					Appended content"
				`);
			});

			it("should throw an error if the file doesn't exist and create_if_missing is false", async () => {
				await expect(
					updateContentTool.handler(obsidian, request, {
						uri: "file:///nonexistent.md",
						mode: "append",
						content: "Some content",
					})
				).rejects.toThrow("File not found: nonexistent.md");
			});

			it("should create a new file if it doesn't exist and create_if_missing is true", async () => {
				const result = await updateContentTool.handler(obsidian, request, {
					uri: "file:///new_file.md",
					mode: "append",
					content: "New file content",
					create_if_missing: true,
				});

				expect(result).toContain("Content appended successfully to new_file.md");

				const file = obsidian.markdownFiles.get("new_file.md")!.contents;
				expect(file).toMatchInlineSnapshot(`
					"
					New file content"
				`);
			});
		});

		describe("replace mode", () => {
			it("should replace content in a file", async () => {
				const result = await updateContentTool.handler(obsidian, request, {
					uri: "file:///replace.md",
					mode: "replace",
					find: "specific content",
					content: "replacement text",
				});

				const file = obsidian.markdownFiles.get("replace.md")!.contents;
				expect(file).toBe("This is a file with replacement text to replace.");
				expect(result).toContain("Content successfully replaced");
			});

			it("should throw an error when the find parameter is not provided", async () => {
				await expect(
					updateContentTool.handler(obsidian, request, {
						uri: "file:///replace.md",
						mode: "replace",
						content: "new content",
					})
				).rejects.toThrow("'find' parameter is required for replace mode");
			});

			it("should throw an error when content to find is not in the file", async () => {
				await expect(
					updateContentTool.handler(obsidian, request, {
						uri: "file:///replace.md",
						mode: "replace",
						find: "nonexistent content",
						content: "new content",
					})
				).rejects.toThrow("Content not found in file: replace.md");
			});

			it("should throw an error when there are multiple matches", async () => {
				await expect(
					updateContentTool.handler(obsidian, request, {
						uri: "file:///multiple.md",
						mode: "replace",
						find: "multiple matches",
						content: "new content",
					})
				).rejects.toThrow("Multiple matches found in file: multiple.md");
			});

			it("should work with empty replacement string", async () => {
				const result = await updateContentTool.handler(obsidian, request, {
					uri: "file:///replace.md",
					mode: "replace",
					find: "specific content",
					content: "",
				});

				const file = obsidian.markdownFiles.get("replace.md")!.contents;
				expect(file).toBe("This is a file with  to replace.");
				expect(result).toContain("Content successfully replaced");
			});
		});
	});

	describe("daily:// URI handling", () => {
		describe("append mode", () => {
			it("should append content to today's daily note", async () => {
				const result = await updateContentTool.handler(obsidian, request, {
					uri: "daily:///today",
					mode: "append",
					content: "New content appended.",
				});

				expect(result).toContain("Content appended successfully");

				// Verify content was updated
				const file = obsidian.markdownFiles.get("daily/2023-05-09.md")!.contents;
				expect(file).toContain("New content appended.");
			});

			it("should throw error when daily note doesn't exist and create_if_missing is false", async () => {
				// Remove today's note
				obsidian.markdownFiles.delete("daily/2023-05-09.md");

				await expect(
					updateContentTool.handler(obsidian, request, {
						uri: "daily:///today",
						mode: "append",
						content: "New content.",
					})
				).rejects.toThrow("File not found:");
			});

			it("should create and append to daily note when it doesn't exist and create_if_missing is true", async () => {
				obsidian.markdownFiles.delete("daily/2023-05-09.md");

				const result = await updateContentTool.handler(obsidian, request, {
					uri: "daily:///today",
					mode: "append",
					content: "New daily note content.",
					create_if_missing: true,
				});

				expect(result).toContain("Content appended successfully");

				// Verify the file was created with content
				const file = obsidian.markdownFiles.get("daily/2023-05-09.md")!.contents;
				expect(file).toContain("New daily note content.");
			});

			it("should throw error when no daily notes plugin is enabled", async () => {
				// Disable the daily notes plugin
				obsidian.dailyNotes = null;

				await expect(
					updateContentTool.handler(obsidian, request, {
						uri: "daily:///today",
						mode: "append",
						content: "New content.",
					})
				).rejects.toThrow("Cannot access daily notes: No daily notes plugin is enabled");
			});
		});

		describe("replace mode", () => {
			it("should replace content in today's daily note", async () => {
				const result = await updateContentTool.handler(obsidian, request, {
					uri: "daily:///today",
					mode: "replace",
					find: "This is today's note content.",
					content: "This content has been replaced.",
				});

				expect(result).toContain("Content successfully replaced");

				// Verify content was updated
				const file = obsidian.markdownFiles.get("daily/2023-05-09.md")!.contents;
				expect(file).toContain("This content has been replaced.");
			});

			it("should throw error when using replace mode without find parameter", async () => {
				await expect(
					updateContentTool.handler(obsidian, request, {
						uri: "daily:///today",
						mode: "replace",
						content: "Replacement content.",
					})
				).rejects.toThrow("'find' parameter is required for replace mode");
			});

			it("should throw error when content to find is not in the daily note", async () => {
				await expect(
					updateContentTool.handler(obsidian, request, {
						uri: "daily:///today",
						mode: "replace",
						find: "nonexistent content",
						content: "new content",
					})
				).rejects.toThrow("Content not found in file");
			});

			it("should throw error when there are multiple matches in the daily note", async () => {
				// Set up a note with multiple matches
				obsidian.setFiles({
					"daily/2023-05-09.md": "This has duplicate content. This has duplicate content.",
				});

				await expect(
					updateContentTool.handler(obsidian, request, {
						uri: "daily:///today",
						mode: "replace",
						find: "duplicate content",
						content: "new content",
					})
				).rejects.toThrow("Multiple matches found in file");
			});
		});
	});
});
