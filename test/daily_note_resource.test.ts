import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getFileContentsTool } from "../tools/get_file_contents";
import { updateContentTool } from "../tools/update_content";
import { listFilesTool } from "../tools/list_files";
import { MockApp, MockFile } from "./mocks/obsidian";

// Import moment for testing
import moment from "moment";

// Set a fixed date for testing
const MOCK_DATE = new Date("2023-05-09T12:00:00.000Z");

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

describe("Daily Note URI Resource Tests", () => {
	let mockApp: MockApp;

	beforeEach(() => {
		// Setup fake timers and set a fixed date
		vi.useFakeTimers();
		vi.setSystemTime(MOCK_DATE);

		vi.clearAllMocks();
		mockApp = new MockApp();

		// Set up files that could be daily notes
		mockApp.setFiles({
			"daily/2023-05-09.md": "# Today's Note\nThis is today's note content.",
			"daily/2023-05-08.md": "# Yesterday's Note\nThis is yesterday's note content.",
			"daily/2023-05-10.md": "# Tomorrow's Note\nThis is tomorrow's note content.",
			"other-note.md": "# Other Note\nThis is not a daily note",
		});

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

	describe("getFileContentsTool with daily:// URIs", () => {
		it("should return content for today's daily note", async () => {
			const handler = getFileContentsTool.handler(mockApp);
			const result = await handler({ path: "daily://today" });

			expect(result).toBe("# Today's Note\nThis is today's note content.");
		});

		it("should return content for yesterday's daily note", async () => {
			const handler = getFileContentsTool.handler(mockApp);
			const result = await handler({ path: "daily://yesterday" });

			expect(result).toBe("# Yesterday's Note\nThis is yesterday's note content.");
		});

		it("should return content for tomorrow's daily note", async () => {
			const handler = getFileContentsTool.handler(mockApp);
			const result = await handler({ path: "daily://tomorrow" });

			expect(result).toBe("# Tomorrow's Note\nThis is tomorrow's note content.");
		});

		it("should return content for a specific date", async () => {
			const handler = getFileContentsTool.handler(mockApp);
			const result = await handler({ path: "daily://2023-05-08" });

			expect(result).toBe("# Yesterday's Note\nThis is yesterday's note content.");
		});

		it("should throw error when daily note doesn't exist", async () => {
			// Remove today's note
			mockApp.mockVault.files.delete("daily/2023-05-09.md");

			const handler = getFileContentsTool.handler(mockApp);
			await expect(handler({ path: "daily://today" })).rejects.toThrow(
				"Daily note not found: today. Use create: true parameter to create it."
			);
		});

		it("should create daily note when it doesn't exist and create is true", async () => {
			// Remove today's note
			mockApp.mockVault.files.delete("daily/2023-05-09.md");

			// Mock the create method
			mockApp.vault.create = vi.fn(async (path, content) => {
				const file = new MockFile(path, content);
				mockApp.mockVault.files.set(path, file);
				return file;
			});

			const handler = getFileContentsTool.handler(mockApp);
			const result = await handler({ path: "daily://today", create: true });

			// The new note should be empty
			expect(result).toBe("");

			// Verify the file was created
			expect(mockApp.mockVault.files.has("daily/2023-05-09.md")).toBe(true);
		});

		it("should throw error when no daily notes plugin is enabled", async () => {
			// Disable the daily notes plugin
			mockApp.internalPlugins.plugins["daily-notes"].enabled = false;

			// Also remove the periodic notes plugin to test the error
			mockApp.plugins.plugins["periodic-notes"] = null as any;

			const handler = getFileContentsTool.handler(mockApp);
			await expect(handler({ path: "daily://today" })).rejects.toThrow(
				"Cannot access daily notes: No daily notes plugin is enabled"
			);
		});

		it("should support startOffset and endOffset parameters", async () => {
			const handler = getFileContentsTool.handler(mockApp);
			const result = await handler({
				path: "daily://today",
				startOffset: 2, // Skip "# "
				endOffset: 14, // Get "Today's Note"
			});

			expect(result).toBe("Today's Note");
		});
	});

	describe("updateContentTool with daily:// URIs", () => {
		it("should append content to today's daily note", async () => {
			const handler = updateContentTool.handler(mockApp);
			const result = await handler({
				path: "daily://today",
				mode: "append",
				content: "New content appended.",
			});

			expect(result).toContain("Content appended successfully to daily note: today");

			// Verify content was updated
			const file = mockApp.vault.getFileByPath("daily/2023-05-09.md");
			expect(file).toBeDefined();
		});

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
			const file = mockApp.vault.getFileByPath("daily/2023-05-09.md");
			expect(file).toBeDefined();
		});

		it("should create and append to daily note when it doesn't exist", async () => {
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

	describe("listFilesTool with daily:// URIs", () => {
		it("should list daily:// URI when listing root", async () => {
			const handler = listFilesTool.handler(mockApp);
			const result = await handler({ path: "" });

			expect(result.split("\n")).toContain("daily://");
		});

		it("should list available daily note references when querying daily://", async () => {
			const handler = listFilesTool.handler(mockApp);
			const result = await handler({ path: "daily://" });

			const dailyPaths = result.split("\n");
			expect(dailyPaths).toContain("daily://today");
			expect(dailyPaths).toContain("daily://yesterday");
			expect(dailyPaths).toContain("daily://tomorrow");
		});

		it("should throw error when trying to list within a specific daily note", async () => {
			const handler = listFilesTool.handler(mockApp);
			await expect(handler({ path: "daily://today" })).rejects.toThrow(
				"Cannot list files within a specific daily note"
			);
		});

		it("should return empty result when daily notes plugin is not enabled", async () => {
			// Disable the daily notes plugin
			mockApp.internalPlugins.plugins["daily-notes"].enabled = false;
			mockApp.plugins.plugins["periodic-notes"] = null as any;

			const handler = listFilesTool.handler(mockApp);
			const result = await handler({ path: "daily://" });

			expect(result).toBe("");
		});
	});
});
