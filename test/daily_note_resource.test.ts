import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DailyNoteResource } from "../tools/daily_notes";
import { MockApp } from "./mocks/obsidian";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Import moment for testing only
import moment from "moment";

// Set a fixed date for testing
const MOCK_DATE = new Date("2023-05-09T12:00:00.000Z");

// Mock the window.moment object for consistent date testing
vi.stubGlobal("window", {
  moment: (...args: any[]) => {
    if (args.length === 0) {
      return moment(MOCK_DATE);
    }
    if (args.length === 1) {
      return moment(args[0]);
    }
    return moment(args[0], args[1]);
  }
});

describe("DailyNoteResource", () => {
	let mockApp: MockApp;
	let resource: DailyNoteResource;

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

		resource = new DailyNoteResource(mockApp);
	});
	
	afterEach(() => {
		// Restore real timers after each test
		vi.useRealTimers();
	});

	describe("constructor", () => {
		it("should initialize with default prefix", () => {
			const resource = new DailyNoteResource(mockApp);
			expect(resource.template).toBeDefined();
			const resourceName = resource["resourceName"]; // Access private property
			expect(resourceName).toBe("vault-daily-note");
		});

		it("should initialize with custom prefix", () => {
			const resource = new DailyNoteResource(mockApp, "custom");
			expect(resource.template).toBeDefined();
			const resourceName = resource["resourceName"]; // Access private property
			expect(resourceName).toBe("custom-daily-note");
		});
	});

	describe("register", () => {
		it("should register the resource with the server", () => {
			const mockServer = {
				resource: vi.fn(),
			};

			resource.register(mockServer as unknown as McpServer);

			expect(mockServer.resource).toHaveBeenCalledWith(
				"vault-daily-note",
				expect.any(Object),
				{ description: "Provides access to daily notes in the Obsidian vault" },
				expect.any(Function)
			);
		});
	});

	describe("template", () => {
		it("should be correctly configured", () => {
			expect(resource.template).toBeDefined();
			expect(resource.template).toBeInstanceOf(Object);

			// Test the structure without checking specific properties
			// that might change based on the implementation
			expect(resource.template.constructor.name).toBe("ResourceTemplate");

			// Check if the resource name is correct
			expect(resource["resourceName"]).toBe("vault-daily-note");
		});
	});

	describe("handler", () => {
		it("should return info for today's daily note", async () => {
			const result = await resource.handler(new URL("vault-daily-note:///today"), { date: "today" });

			expect(result.contents).toHaveLength(1);
			expect(result.contents[0].uri).toBe("vault-daily-note:///today");
			expect(result.contents[0].text).toMatchInlineSnapshot(`
				"# Daily Note Information
				- Path: \`daily/2023-05-09.md\`
				- Filename: \`2023-05-09\`
				- Created: No (already existed)
				- Date: today"
			`);
		});

		it("should return info for yesterday's daily note", async () => {
			const result = await resource.handler(new URL("vault-daily-note:///yesterday"), { date: "yesterday" });

			expect(result.contents).toHaveLength(1);
			expect(result.contents[0].text).toMatchInlineSnapshot(`
				"# Daily Note Information
				- Path: \`daily/2023-05-08.md\`
				- Filename: \`2023-05-08\`
				- Created: No (already existed)
				- Date: yesterday"
			`);
		});

		it("should return info for tomorrow's daily note", async () => {
			const result = await resource.handler(new URL("vault-daily-note:///tomorrow"), { date: "tomorrow" });

			expect(result.contents).toHaveLength(1);
			expect(result.contents[0].text).toMatchInlineSnapshot(`
				"# Daily Note Information
				- Path: \`daily/2023-05-10.md\`
				- Filename: \`2023-05-10\`
				- Created: No (already existed)
				- Date: tomorrow"
			`);
		});

		it("should return 'not found' message when daily note doesn't exist", async () => {
			// Remove tomorrow's note to test
			mockApp.mockVault.files.delete("daily/2023-05-10.md");

			const result = await resource.handler(new URL("vault-daily-note:///tomorrow"), { date: "tomorrow" });

			expect(result.contents).toHaveLength(1);
			expect(result.contents[0].text).toMatchInlineSnapshot(`
				"# Daily Note Not Found
				- Date: tomorrow
				- Expected Path: \`daily/2023-05-10.md\`
				The daily note for this date does not exist. Use \`create: true\` parameter to create it."
			`);
		});

		it("should handle correctly when no daily notes plugin is enabled", async () => {
			// Disable the daily notes plugin
			mockApp.internalPlugins.plugins["daily-notes"].enabled = false;
			
			// But leave the periodic notes plugin, since it should be used as a fallback
			// If we want to test the case where both are disabled, we need to remove it
			mockApp.plugins.plugins["periodic-notes"] = null;
			
			await expect(
				resource.handler(new URL("vault-daily-note:///today"), { date: "today" })
			).rejects.toThrow("No daily notes plugin is enabled");
		});
	});
});