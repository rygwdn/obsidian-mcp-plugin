import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDailyNoteTool } from "../tools/daily_notes";
import { MockApp, MockFile } from "./mocks/obsidian";

// Import moment for testing only
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

describe("getDailyNoteTool", () => {
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
		mockApp.internalPlugins.plugins["daily-notes"].enabled = true;
	});

	afterEach(() => {
		// Restore real timers after each test
		vi.useRealTimers();
	});

	describe("handler", () => {
		it("should return info for today's daily note", async () => {
			const handler = getDailyNoteTool.handler(mockApp);
			const result = await handler({ create: false, date: "today" });

			expect(result).toMatchInlineSnapshot(`
				"# Daily Note Information
				- Path: \`daily/2023-05-09.md\`
				- Filename: \`2023-05-09\`
				- Created: No (already existed)
				- Date: today"
			`);
		});

		it("should return info for yesterday's daily note", async () => {
			const handler = getDailyNoteTool.handler(mockApp);
			const result = await handler({ create: false, date: "yesterday" });

			expect(result).toMatchInlineSnapshot(`
				"# Daily Note Information
				- Path: \`daily/2023-05-08.md\`
				- Filename: \`2023-05-08\`
				- Created: No (already existed)
				- Date: yesterday"
			`);
		});

		it("should return info for tomorrow's daily note", async () => {
			const handler = getDailyNoteTool.handler(mockApp);
			const result = await handler({ create: false, date: "tomorrow" });

			expect(result).toMatchInlineSnapshot(`
				"# Daily Note Information
				- Path: \`daily/2023-05-10.md\`
				- Filename: \`2023-05-10\`
				- Created: No (already existed)
				- Date: tomorrow"
			`);
		});

		it("should handle date in YYYY-MM-DD format", async () => {
			const handler = getDailyNoteTool.handler(mockApp);
			const result = await handler({ create: false, date: "2023-05-08" });

			expect(result).toMatchInlineSnapshot(`
				"# Daily Note Information
				- Path: \`daily/2023-05-08.md\`
				- Filename: \`2023-05-08\`
				- Created: No (already existed)
				- Date: 2023-05-08"
			`);
		});

		it("should return 'not found' message when daily note doesn't exist", async () => {
			// Remove today's note
			mockApp.mockVault.files.delete("daily/2023-05-09.md");

			const handler = getDailyNoteTool.handler(mockApp);
			const result = await handler({ create: false, date: "today" });

			expect(result).toMatchInlineSnapshot(`
				"# Daily Note Not Found
				- Date: today
				- Expected Path: \`daily/2023-05-09.md\`
				The daily note for this date does not exist. Use \`create: true\` parameter to create it."
			`);
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

			const handler = getDailyNoteTool.handler(mockApp);
			const result = await handler({ create: true, date: "today" });

			expect(result).toMatchInlineSnapshot(`
				"# Daily Note Information
				- Path: \`daily/2023-05-09.md\`
				- Filename: \`2023-05-09\`
				- Created: Yes (just now)
				- Date: today"
			`);
		});

		it("should verify createFolder is called when necessary", async () => {
			// Clear the vault files
			mockApp.mockVault.files.clear();

			// Setup folder creation mock
			const createFolder = vi.fn(async (path) => {
				const folder = new MockFile(path, "", true);
				mockApp.mockVault.files.set(path, folder);
				return folder;
			});
			mockApp.vault.createFolder = createFolder;

			// Setup file creation mock
			mockApp.vault.create = vi.fn(async (path, content) => {
				const file = new MockFile(path, content);
				mockApp.mockVault.files.set(path, file);
				return file;
			});

			// Setup file existence check
			mockApp.vault.adapter.exists = vi.fn(async (path) => {
				return mockApp.mockVault.files.has(path);
			});

			// Call the handler to create a daily note when the folder doesn't exist
			const handler = getDailyNoteTool.handler(mockApp);
			await handler({ create: true, date: "today" });

			expect(createFolder).toHaveBeenCalledWith("daily");
			expect(mockApp.vault.create).toHaveBeenCalledWith("daily/2023-05-09.md", "");
		});

		it("should throw error when no daily notes plugin is enabled", async () => {
			// Disable the daily notes plugin
			mockApp.internalPlugins.plugins["daily-notes"].enabled = false;

			// Also remove the periodic notes plugin to test the error
			mockApp.plugins.plugins["periodic-notes"] = null as any;

			const handler = getDailyNoteTool.handler(mockApp);
			await expect(handler({ create: false, date: "today" })).rejects.toThrow(
				"No daily notes plugin is enabled"
			);
		});

		it("should use periodic-notes plugin when daily-notes is not enabled", async () => {
			// Disable core daily-notes plugin
			mockApp.internalPlugins.plugins["daily-notes"].enabled = false;

			// The periodic-notes plugin should now be used
			const handler = getDailyNoteTool.handler(mockApp);
			const result = await handler({ create: false, date: "today" });

			expect(result).toContain("# Daily Note Information");
			expect(result).toContain("Path: `daily/2023-05-09.md`");
		});

		it("should handle errors during note creation", async () => {
			// Remove today's note
			mockApp.mockVault.files.delete("daily/2023-05-09.md");

			// Mock the create method to throw an error
			mockApp.vault.create = vi.fn(async () => {
				throw new Error("Failed to create file");
			});

			const handler = getDailyNoteTool.handler(mockApp);
			await expect(handler({ create: true, date: "today" })).rejects.toThrow(
				"Failed to create daily note"
			);
		});
	});
});
