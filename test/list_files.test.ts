import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { listFilesTool } from "../tools/list_files";
import { MockApp } from "./mocks/obsidian";

// Import moment for testing only
import moment from "moment";

// Set a fixed date for testing
const MOCK_DATE = new Date("2023-05-09T12:00:00.000Z");

describe("list_files tool", () => {
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

		// Enable daily notes plugin for testing
		mockApp.internalPlugins.plugins["daily-notes"] = {
			enabled: true,
			instance: {
				options: {
					folder: "daily",
					format: "YYYY-MM-DD",
				},
			},
		};
		mockApp.setFiles({
			"file1.md": "",
			"file2.md": "",
			"dir1/file3.md": "",
			"dir1/file4.md": "",
			"dir2/file5.md": "",
			"dir2/subdir/file6.md": "",
			"dir2/subdir/nested/file7.md": "",
			"daily/2023-05-09.md": "# Today's Note\nThis is today's note content.",
			"daily/2023-05-08.md": "# Yesterday's Note\nThis is yesterday's note content.",
			"daily/2023-05-10.md": "# Tomorrow's Note\nThis is tomorrow's note content.",
		});
	});

	afterEach(() => {
		// Restore real timers after each test
		vi.useRealTimers();
	});

	describe("regular directory listing", () => {
		it("should list files from root when no path is provided", async () => {
			const handler = listFilesTool.handler(mockApp);
			const result = await handler({});

			expect(mockApp.vault.getFiles).toHaveBeenCalled();
			const lines = result.split("\n");
			expect(lines).toContain("file1.md");
			expect(lines).toContain("file2.md");
			expect(lines).toContain("dir1/file3.md");
			expect(lines).toContain("dir1/file4.md");
			expect(lines).toContain("dir2/file5.md");
			expect(lines).toContain("dir2/subdir/");
			expect(lines).toContain("daily://");
		});

		it("should list files from a specific directory", async () => {
			const handler = listFilesTool.handler(mockApp);
			const result = await handler({ path: "dir1/" });

			expect(mockApp.vault.getFiles).toHaveBeenCalled();
			expect(result).toMatchInlineSnapshot(`
				"ile3.md
				ile4.md"
			`);
		});

		it("should respect the depth parameter when set to 0", async () => {
			const handler = listFilesTool.handler(mockApp);
			const result = await handler({ depth: 0 });

			expect(mockApp.vault.getFiles).toHaveBeenCalled();
			const lines = result.split("\n");
			expect(lines).toContain("dir1/");
			expect(lines).toContain("dir2/");
			expect(lines).toContain("file1.md");
			expect(lines).toContain("file2.md");
			expect(lines).toContain("daily://");
		});

		it("should respect the depth parameter when set to 2", async () => {
			const handler = listFilesTool.handler(mockApp);
			const result = await handler({ depth: 2 });

			expect(mockApp.vault.getFiles).toHaveBeenCalled();
			const lines = result.split("\n");
			expect(lines).toContain("dir1/file3.md");
			expect(lines).toContain("dir1/file4.md");
			expect(lines).toContain("dir2/file5.md");
			expect(lines).toContain("dir2/subdir/file6.md");
			expect(lines).toContain("dir2/subdir/nested/");
			expect(lines).toContain("file1.md");
			expect(lines).toContain("file2.md");
			expect(lines).toContain("daily://");
		});

		it("should use depth 1 by default", async () => {
			const handler = listFilesTool.handler(mockApp);
			const result = await handler({});

			expect(mockApp.vault.getFiles).toHaveBeenCalled();
			const lines = result.split("\n");
			expect(lines).toContain("dir1/file3.md");
			expect(lines).toContain("dir1/file4.md");
			expect(lines).toContain("dir2/file5.md");
			expect(lines).toContain("dir2/subdir/");
			expect(lines).toContain("file1.md");
			expect(lines).toContain("file2.md");
			expect(lines).toContain("daily://");
		});

		it("should throw an error when no files are found", async () => {
			mockApp.setFiles({});

			const handler = listFilesTool.handler(mockApp);

			await expect(handler({ path: "nonexistent" })).rejects.toThrow(
				"No files found in path: nonexistent"
			);
		});
	});

	describe("daily:// URI handling", () => {
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

		it("should return empty result if daily notes are not enabled", async () => {
			// Disable the daily notes plugin
			mockApp.internalPlugins.plugins["daily-notes"].enabled = false;
			mockApp.plugins.plugins["periodic-notes"] = null as any;

			const handler = listFilesTool.handler(mockApp);
			const result = await handler({ path: "daily://" });

			expect(result).toBe("");
		});

		it("should not include daily:// in root listing when daily notes are disabled", async () => {
			// Disable the daily notes plugin
			mockApp.internalPlugins.plugins["daily-notes"].enabled = false;
			mockApp.plugins.plugins["periodic-notes"] = null as any;

			const handler = listFilesTool.handler(mockApp);
			const result = await handler({ path: "" });

			const lines = result.split("\n");
			expect(lines).not.toContain("daily://");
		});
	});
});
