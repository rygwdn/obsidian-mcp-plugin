import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getFileContentsTool } from "../tools/get_file_contents";
import { MockApp, MockFile } from "./mocks/obsidian";
import { App } from "obsidian";

// Import moment for testing only
import moment from "moment";

// Set a fixed date for testing
const MOCK_DATE = new Date("2023-05-09T12:00:00.000Z");

describe("get_file_contents tool", () => {
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
			"daily/2023-05-09.md": "# Today's Note\nThis is today's note content.",
			"daily/2023-05-08.md": "# Yesterday's Note\nThis is yesterday's note content.",
			"daily/2023-05-10.md": "# Tomorrow's Note\nThis is tomorrow's note content.",
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

	describe("regular file handling", () => {
		it("should return the content of an existing file", async () => {
			const handler = getFileContentsTool.handler(mockApp as unknown as App);
			const result = await handler({ path: "test.md" });

			// With resolvePath, we don't call getAbstractFileByPath directly anymore
			// but we still use cachedRead to get the file content
			expect(mockApp.vault.cachedRead).toHaveBeenCalled();
			expect(result).toBe("This is a test file content");
		});

		it("should throw an error when the file does not exist", async () => {
			const handler = getFileContentsTool.handler(mockApp as unknown as App);

			await expect(handler({ path: "nonexistent.md" })).rejects.toThrow(
				"File not found: nonexistent.md"
			);
		});

		it("should support startOffset and endOffset parameters", async () => {
			const handler = getFileContentsTool.handler(mockApp as unknown as App);
			const result = await handler({
				path: "test.md",
				startOffset: 5,
				endOffset: 9,
			});

			expect(result).toBe("is a");
		});
	});

	describe("daily:// URI handling", () => {
		it("should return content for today's daily note", async () => {
			const handler = getFileContentsTool.handler(mockApp as unknown as App);
			const result = await handler({ path: "daily://today" });

			expect(result).toBe("# Today's Note\nThis is today's note content.");
		});

		it("should return content for yesterday's daily note", async () => {
			const handler = getFileContentsTool.handler(mockApp as unknown as App);
			const result = await handler({ path: "daily://yesterday" });

			expect(result).toBe("# Yesterday's Note\nThis is yesterday's note content.");
		});

		it("should return content for tomorrow's daily note", async () => {
			const handler = getFileContentsTool.handler(mockApp as unknown as App);
			const result = await handler({ path: "daily://tomorrow" });

			expect(result).toBe("# Tomorrow's Note\nThis is tomorrow's note content.");
		});

		it("should return content for a specific date", async () => {
			const handler = getFileContentsTool.handler(mockApp as unknown as App);
			const result = await handler({ path: "daily://2023-05-08" });

			expect(result).toBe("# Yesterday's Note\nThis is yesterday's note content.");
		});

		it("should throw error when daily note doesn't exist", async () => {
			// Remove today's note
			mockApp.mockVault.files.delete("daily/2023-05-09.md");

			const handler = getFileContentsTool.handler(mockApp as unknown as App);
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

			const handler = getFileContentsTool.handler(mockApp as unknown as App);
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

			const handler = getFileContentsTool.handler(mockApp as unknown as App);
			await expect(handler({ path: "daily://today" })).rejects.toThrow(
				"Cannot access daily notes: No daily notes plugin is enabled"
			);
		});

		it("should support startOffset and endOffset parameters with daily notes", async () => {
			const handler = getFileContentsTool.handler(mockApp as unknown as App);
			const result = await handler({
				path: "daily://today",
				startOffset: 2, // Skip "# "
				endOffset: 14, // Get "Today's Note"
			});

			expect(result).toBe("Today's Note");
		});
	});
});
