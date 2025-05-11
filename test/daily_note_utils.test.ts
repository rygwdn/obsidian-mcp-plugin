import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MockApp, MockFile } from "./mocks/obsidian";
import * as DailyNoteUtils from "../tools/daily_note_utils";

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

describe("DailyNoteUtils", () => {
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

	describe("isDailyNotesEnabled", () => {
		it("should return true when core daily-notes plugin is enabled", () => {
			mockApp.internalPlugins.plugins["daily-notes"].enabled = true;
			mockApp.plugins.plugins["periodic-notes"] = null as any;

			expect(DailyNoteUtils.isDailyNotesEnabled(mockApp)).toBe(true);
		});

		it("should return true when periodic-notes plugin is enabled", () => {
			mockApp.internalPlugins.plugins["daily-notes"].enabled = false;
			mockApp.plugins.plugins["periodic-notes"] = {} as any;

			expect(DailyNoteUtils.isDailyNotesEnabled(mockApp)).toBe(true);
		});

		it("should return false when no daily notes plugin is enabled", () => {
			mockApp.internalPlugins.plugins["daily-notes"].enabled = false;
			mockApp.plugins.plugins["periodic-notes"] = null as any;

			expect(DailyNoteUtils.isDailyNotesEnabled(mockApp)).toBe(false);
		});
	});

	describe("getDailyNoteSettings", () => {
		it("should return correct settings from core daily-notes plugin", () => {
			mockApp.internalPlugins.plugins["daily-notes"].enabled = true;

			const settings = DailyNoteUtils.getDailyNoteSettings(mockApp);
			expect(settings).toEqual({
				folder: "daily",
				format: "YYYY-MM-DD",
			});
		});

		it("should return correct settings from periodic-notes plugin", () => {
			mockApp.internalPlugins.plugins["daily-notes"].enabled = false;
			mockApp.plugins.plugins["periodic-notes"] = {
				settings: {
					daily: {
						folder: "dailies",
						format: "YYYY/MM/DD",
					},
				},
			} as any;

			const settings = DailyNoteUtils.getDailyNoteSettings(mockApp);
			expect(settings).toEqual({
				folder: "dailies",
				format: "YYYY/MM/DD",
			});
		});

		it("should return default settings when no plugins are enabled", () => {
			mockApp.internalPlugins.plugins["daily-notes"].enabled = false;
			mockApp.plugins.plugins["periodic-notes"] = null as any;

			const settings = DailyNoteUtils.getDailyNoteSettings(mockApp);
			expect(settings).toEqual({
				folder: "",
				format: "YYYY-MM-DD",
			});
		});
	});

	describe("parseDate", () => {
		it("should return today's date for 'today'", () => {
			const date = DailyNoteUtils.parseDate("today", mockApp);
			expect(date.format("YYYY-MM-DD")).toBe("2023-05-09");
		});

		it("should return yesterday's date for 'yesterday'", () => {
			const date = DailyNoteUtils.parseDate("yesterday", mockApp);
			expect(date.format("YYYY-MM-DD")).toBe("2023-05-08");
		});

		it("should return tomorrow's date for 'tomorrow'", () => {
			const date = DailyNoteUtils.parseDate("tomorrow", mockApp);
			expect(date.format("YYYY-MM-DD")).toBe("2023-05-10");
		});

		it("should parse a date string using the configured format", () => {
			const date = DailyNoteUtils.parseDate("2023-05-08", mockApp);
			expect(date.format("YYYY-MM-DD")).toBe("2023-05-08");
		});
	});

	describe("getDailyNotePath", () => {
		it("should return the correct path for a given date", () => {
			const date = DailyNoteUtils.parseDate("today", mockApp);
			const path = DailyNoteUtils.getDailyNotePath(mockApp, date);
			expect(path).toBe("daily/2023-05-09.md");
		});

		it("should respect custom folder and format settings", () => {
			mockApp.internalPlugins.plugins["daily-notes"].instance.options = {
				folder: "journal",
				format: "YYYY_MM_DD",
			};

			const date = DailyNoteUtils.parseDate("today", mockApp);
			const path = DailyNoteUtils.getDailyNotePath(mockApp, date);
			expect(path).toBe("journal/2023_05_09.md");
		});
	});

	describe("getDailyNoteFile", () => {
		it("should return file for today's daily note", async () => {
			const file = await DailyNoteUtils.getDailyNoteFile(mockApp, "today", false);

			expect(file).toBeDefined();
			expect(file?.path).toBe("daily/2023-05-09.md");
		});

		it("should return file for yesterday's daily note", async () => {
			const file = await DailyNoteUtils.getDailyNoteFile(mockApp, "yesterday", false);

			expect(file).toBeDefined();
			expect(file?.path).toBe("daily/2023-05-08.md");
		});

		it("should return file for tomorrow's daily note", async () => {
			const file = await DailyNoteUtils.getDailyNoteFile(mockApp, "tomorrow", false);

			expect(file).toBeDefined();
			expect(file?.path).toBe("daily/2023-05-10.md");
		});

		it("should return null when daily note doesn't exist", async () => {
			// Remove today's note
			mockApp.mockVault.files.delete("daily/2023-05-09.md");

			const file = await DailyNoteUtils.getDailyNoteFile(mockApp, "today", false);
			expect(file).toBeNull();
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

			const file = await DailyNoteUtils.getDailyNoteFile(mockApp, "today", true);

			expect(file).toBeDefined();
			expect(file?.path).toBe("daily/2023-05-09.md");
			expect(mockApp.vault.create).toHaveBeenCalledWith("daily/2023-05-09.md", "");
		});

		it("should create folder when it doesn't exist", async () => {
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

			// Call the function to create a daily note when the folder doesn't exist
			await DailyNoteUtils.getDailyNoteFile(mockApp, "today", true);

			expect(createFolder).toHaveBeenCalledWith("daily");
			expect(mockApp.vault.create).toHaveBeenCalledWith("daily/2023-05-09.md", "");
		});

		it("should throw error when no daily notes plugin is enabled", async () => {
			// Disable the daily notes plugin
			mockApp.internalPlugins.plugins["daily-notes"].enabled = false;

			// Also remove the periodic notes plugin to test the error
			mockApp.plugins.plugins["periodic-notes"] = null as any;

			await expect(DailyNoteUtils.getDailyNoteFile(mockApp, "today", false)).rejects.toThrow(
				"No daily notes plugin is enabled"
			);
		});
	});

	describe("isDailyNotePath", () => {
		it("should return true for daily:// paths", () => {
			expect(DailyNoteUtils.isDailyNotePath("daily://today")).toBe(true);
			expect(DailyNoteUtils.isDailyNotePath("daily://yesterday")).toBe(true);
			expect(DailyNoteUtils.isDailyNotePath("daily://2023-05-08")).toBe(true);
		});

		it("should return false for non-daily:// paths", () => {
			expect(DailyNoteUtils.isDailyNotePath("notes/daily.md")).toBe(false);
			expect(DailyNoteUtils.isDailyNotePath("daily/2023-05-09.md")).toBe(false);
			expect(DailyNoteUtils.isDailyNotePath("not-daily://anything")).toBe(false);
		});
	});

	describe("extractDateFromPath", () => {
		it("should extract date part from daily:// paths", () => {
			expect(DailyNoteUtils.extractDateFromPath("daily://today")).toBe("today");
			expect(DailyNoteUtils.extractDateFromPath("daily://yesterday")).toBe("yesterday");
			expect(DailyNoteUtils.extractDateFromPath("daily://2023-05-08")).toBe("2023-05-08");
		});

		it("should throw error for non-daily:// paths", () => {
			expect(() => DailyNoteUtils.extractDateFromPath("notes/daily.md")).toThrow(
				"Not a daily note path"
			);
			expect(() => DailyNoteUtils.extractDateFromPath("daily/2023-05-09.md")).toThrow(
				"Not a daily note path"
			);
		});
	});

	describe("getAvailableDailyPaths", () => {
		it("should return the expected daily note references", () => {
			const paths = DailyNoteUtils.getAvailableDailyPaths();
			expect(paths).toEqual(["daily://today", "daily://yesterday", "daily://tomorrow"]);
		});
	});

	describe("resolvePath", () => {
		it("should resolve a regular file path", async () => {
			const resolved = await DailyNoteUtils.resolvePath(mockApp, "other-note.md");

			expect(resolved.isDailyNote).toBe(false);
			expect(resolved.exists).toBe(true);
			expect(resolved.file).toBeDefined();
			expect(resolved.path).toBe("other-note.md");
			expect(resolved.dateStr).toBe("");
		});

		it("should resolve a daily:// path that exists", async () => {
			const resolved = await DailyNoteUtils.resolvePath(mockApp, "daily://today");

			expect(resolved.isDailyNote).toBe(true);
			expect(resolved.exists).toBe(true);
			expect(resolved.file).toBeDefined();
			expect(resolved.path).toBe("daily/2023-05-09.md");
			expect(resolved.dateStr).toBe("today");
		});

		it("should resolve a daily:// path that doesn't exist", async () => {
			// Remove today's note
			mockApp.mockVault.files.delete("daily/2023-05-09.md");

			const resolved = await DailyNoteUtils.resolvePath(mockApp, "daily://today");

			expect(resolved.isDailyNote).toBe(true);
			expect(resolved.exists).toBe(false);
			expect(resolved.file).toBeNull();
			expect(resolved.path).toBe("daily/2023-05-09.md");
			expect(resolved.dateStr).toBe("today");
		});

		it("should create a daily note if create is true", async () => {
			// Remove today's note
			mockApp.mockVault.files.delete("daily/2023-05-09.md");

			// Mock the create method
			mockApp.vault.create = vi.fn(async (path, content) => {
				const file = new MockFile(path, content);
				mockApp.mockVault.files.set(path, file);
				return file;
			});

			const resolved = await DailyNoteUtils.resolvePath(mockApp, "daily://today", { create: true });

			expect(resolved.isDailyNote).toBe(true);
			expect(resolved.exists).toBe(true);
			expect(resolved.file).toBeDefined();
			expect(resolved.path).toBe("daily/2023-05-09.md");
			expect(resolved.dateStr).toBe("today");
			expect(mockApp.vault.create).toHaveBeenCalled();
		});

		it("should return empty result for daily notes when plugin not enabled and errorOnMissingDailyNotePlugin is false", async () => {
			// Disable the daily notes plugin
			mockApp.internalPlugins.plugins["daily-notes"].enabled = false;
			mockApp.plugins.plugins["periodic-notes"] = null as any;

			const resolved = await DailyNoteUtils.resolvePath(mockApp, "daily://today", {
				errorOnMissingDailyNotePlugin: false,
			});

			expect(resolved.isDailyNote).toBe(true);
			expect(resolved.exists).toBe(false);
			expect(resolved.file).toBeNull();
			expect(resolved.path).toBe("");
			expect(resolved.dateStr).toBe("");
		});

		it("should throw an error when daily notes plugin is not enabled and errorOnMissingDailyNotePlugin is true", async () => {
			// Disable the daily notes plugin
			mockApp.internalPlugins.plugins["daily-notes"].enabled = false;
			mockApp.plugins.plugins["periodic-notes"] = null as any;

			await expect(DailyNoteUtils.resolvePath(mockApp, "daily://today")).rejects.toThrow(
				"Cannot access daily notes: No daily notes plugin is enabled"
			);
		});
	});
});
