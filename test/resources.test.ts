import { describe, it, expect, vi, beforeEach } from "vitest";
import moment from "moment"; // Import moment
import { VaultFileResource } from "../tools/vault_file_resource";
import { MockApp } from "./mocks/obsidian";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getContentsTool } from "../tools/get_contents";
import * as DailyNoteUtils from "../tools/daily_note_utils";

const MOCK_SYSTEM_DATE = "2023-05-09T12:00:00.000Z";

describe("VaultFileResource", () => {
	let mockApp: MockApp;
	let resource: VaultFileResource;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(MOCK_SYSTEM_DATE));
		vi.clearAllMocks();
		mockApp = new MockApp();

		vi.stubGlobal("window", {
			moment: (...args: unknown[]) => {
				if (args.length === 0) {
					return moment(vi.getMockedSystemTime());
				}
				// @ts-expect-error - moment can be called with various arg types
				return moment(...args);
			},
		});

		mockApp.setFiles({
			"test1.md": "Test file 1 contents",
			"test2.md": "Test file 2 contents",
			"folder/test3.md": "Test file 3 contents",
			"readme.txt": "This is not a markdown file",
		});

		mockApp.setFiles({
			"daily_notes/2023-01-01.md": "Daily note content for 2023-01-01",
		});

		// Set up the mockApp to enable daily notes plugin
		mockApp.internalPlugins.plugins["daily-notes"] = {
			enabled: true,
			instance: {
				options: {
					format: "YYYY-MM-DD",
					folder: "daily_notes",
				},
			},
		};

		resource = new VaultFileResource(mockApp);
	});

	describe("constructor", () => {
		it("should initialize correctly", () => {
			const resource = new VaultFileResource(mockApp);
			expect.soft(resource.template).toBeDefined();
			const resourceName = resource["resourceName"]; // Access private property for test validation
			expect(resourceName).toBe("file");
		});
	});

	describe("register", () => {
		it("should register the resource with the server", () => {
			const mockServer = {
				resource: vi.fn(),
			};

			resource.register(mockServer as unknown as McpServer);

			expect(mockServer.resource).toHaveBeenCalledWith(
				"file",
				expect.any(Object),
				{
					description:
						"Provides access to files and directories in the Obsidian vault, including daily notes",
				},
				expect.any(Function)
			);
		});
	});

	describe("template", () => {
		it("should return a ResourceTemplate object", () => {
			const template = resource.template;
			expect(template).toBeDefined();
			// Check the object has the expected instance type
			expect(template.constructor.name).toContain("ResourceTemplate");
		});

		it("should use list method when initialized", () => {
			// Verify the resource is created correctly - we can't directly test .list()
			// since it's actually inside a ResourceTemplate
			const resource = new VaultFileResource(mockApp);
			expect(resource).toBeDefined();

			// Instead, test the list method directly since that's what the template would call
			const listResult = resource.list();
			expect(listResult.resources).toHaveLength(8);
		});

		it("should use completePath in template", () => {
			// Test the underlying method called by the template
			const result = resource.completePath("folder");
			expect(result).toContain("folder/test3.md");
		});
	});

	describe("list", () => {
		it("should return a list of markdown files and daily resources correctly", () => {
			const result = resource.list();

			expect(result.resources.length).toBe(8);

			const markdownFileResources = result.resources.filter((r) => r.mimeType === "text/markdown");
			expect(markdownFileResources.length).toBe(7);

			markdownFileResources.forEach((res) => {
				expect(res.name).toBeDefined();
				expect(res.uri).toContain("file://"); // Changed back from file:///
				expect(res.mimeType).toBe("text/markdown");
			});

			const directoryResources = result.resources.filter((r) => r.mimeType === "text/directory");
			expect(directoryResources.length).toBe(1);
			if (directoryResources[0]) {
				expect(directoryResources[0].name).toBe(DailyNoteUtils.FILE_PREFIX);
				expect(directoryResources[0].uri).toBe(`file://${DailyNoteUtils.FILE_PREFIX}`); // Changed back
			}

			const fileNames = result.resources.map((r) => r.name);
			expect(fileNames).toContain("test1.md");
			expect(fileNames).toContain("test2.md");
			expect(fileNames).toContain("folder/test3.md");
			expect(fileNames).not.toContain("readme.txt");
			expect(fileNames).toContain("daily:today");
		});

		it("should include daily note resources when enabled", () => {
			const result = resource.list();

			const dailyResource = result.resources.find((r) => r.name === DailyNoteUtils.FILE_PREFIX);
			expect(dailyResource).toBeDefined();
			expect(dailyResource?.uri).toBe(`file://${DailyNoteUtils.FILE_PREFIX}`);
		});
	});

	describe("completePath", () => {
		it("should return paths that start with the given value", () => {
			const result = resource.completePath("test");
			expect(result).toContain("test1.md");
			expect(result).toContain("test2.md");
			expect(result).not.toContain("folder/test3.md"); // Doesn't start with 'test'
		});

		it("should return paths that start with folder path", () => {
			const result = resource.completePath("folder");
			expect(result).toContain("folder/test3.md");
			expect(result).not.toContain("test1.md");
		});

		it("should return empty array when no matches found", () => {
			const result = resource.completePath("nonexistent");
			expect(result).toHaveLength(0);
		});

		it("should use daily note completions for daily: paths", () => {
			const completions = resource.completePath("daily:");
			expect(completions).toContain("daily:today");
			expect(completions).toContain("daily:yesterday");
			expect(completions).toContain("daily:tomorrow");
		});
	});

	describe("handler", () => {
		it("should return file contents for a valid path", async () => {
			const result = await resource.handler(new URL("file:///test1.md"), {
				path: "test1.md",
			});

			expect(result.contents).toHaveLength(1);
			expect(result.contents[0].text).toBe("Test file 1 contents");
			expect(result.contents[0].uri).toBe("file:///test1.md");
			expect(result.contents[0].mimeType).toBe("text/markdown");
		});

		it("should throw an error for non-existent files", async () => {
			const handlerCall = resource.handler(new URL("file:///non-existent.md"), {
				path: "non-existent.md",
			});
			await expect(handlerCall).rejects.toThrow(
				/File not found: non-existent.md|No files found in path/
			);
		});

		it("should handle directory listing", async () => {
			const result = await resource.handler(new URL("file:///folder?depth=0"), {
				path: "folder",
				depth: "0",
			});

			expect(result.contents).toHaveLength(1);
			expect(result.contents[0].mimeType).toBe("text/directory");
			expect(result.contents[0].text).toContain("test3.md");
		});

		it("should handle daily note directory", async () => {
			const result = await resource.handler(new URL("file:///daily:"), {
				path: "daily:",
			});

			expect(result.contents).toHaveLength(1);
			expect(result.contents[0].mimeType).toBe("text/directory");
			expect(result.contents[0].text).toContain("daily:today");
		});

		it("should handle daily note path", async () => {
			const todayDateString = moment(vi.getMockedSystemTime()).format("YYYY-MM-DD");
			mockApp.setFiles({
				[`daily_notes/${todayDateString}.md`]: "Today's daily note content",
			});

			const result = await resource.handler(new URL("file:///daily:today"), {
				path: "daily:today",
			});

			expect(result.contents).toHaveLength(1);
			expect(result.contents[0].mimeType).toBe("text/markdown");
			expect(result.contents[0].text).toBe("Today's daily note content");
		});

		it("should throw error for missing daily note when create=false", async () => {
			// Don't set up the file for tomorrow, so it will be missing
			const handlerCall = resource.handler(new URL("file:///daily:tomorrow"), {
				path: "daily:tomorrow",
			});

			await expect(handlerCall).rejects.toThrow("Daily note not found");
		});
	});
});

describe("getContentsTool", () => {
	let mockApp: MockApp;
	let handler: (args: Record<string, unknown>) => Promise<string>;

	beforeEach(() => {
		vi.useFakeTimers(); // Use fake timers
		vi.setSystemTime(new Date(MOCK_SYSTEM_DATE)); // Set system time
		vi.clearAllMocks();
		mockApp = new MockApp();

		vi.stubGlobal("window", {
			moment: (...args: unknown[]) => {
				if (args.length === 0) {
					return moment(vi.getMockedSystemTime());
				}
				// @ts-expect-error - moment can be called with various arg types
				return moment(...args);
			},
		});

		mockApp.setFiles({
			"test1.md": "Test file 1 contents",
			"test2.md": "Test file 2 contents",
			"folder/test3.md": "Test file 3 contents",
			"readme.txt": "This is not a markdown file",
		});

		mockApp.setFiles({
			"daily_notes/2023-01-01.md": "Daily note content for 2023-01-01",
		});

		mockApp.internalPlugins.plugins["daily-notes"] = {
			enabled: true,
			instance: {
				options: {
					format: "YYYY-MM-DD",
					folder: "daily_notes",
				},
			},
		};

		handler = getContentsTool.handler(mockApp);
	});

	describe("file content retrieval", () => {
		it("should retrieve file contents using URI", async () => {
			const result = await handler({ uri: "file:///test1.md" });
			expect(result).toBe("Test file 1 contents");
		});

		it("should handle query parameters", async () => {
			mockApp.setFiles({
				"test_offsets.md": "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
			});

			const result = await handler({
				uri: "file:///test_offsets.md",
				startOffset: 5,
				endOffset: 15,
			});

			expect(result).toBe("56789ABCDE");
		});
	});

	describe("directory listing", () => {
		it("should retrieve directory listing", async () => {
			const result = await handler({ uri: "file:///folder" });
			expect(result).toBe("test3.md");
		});
	});

	describe("daily note handling", () => {
		it("should handle daily note paths", async () => {
			const todayDateString = moment(vi.getMockedSystemTime()).format("YYYY-MM-DD");
			mockApp.setFiles({
				[`daily_notes/${todayDateString}.md`]: "Today's daily note content",
			});

			const result = await handler({ uri: "file:///daily:today" });
			expect(result).toBe("Today's daily note content");
		});

		it("should handle daily note directory", async () => {
			const result = await handler({ uri: "file:///daily:" });
			expect(result).toContain("daily:today");
			expect(result).toContain("daily:yesterday");
			expect(result).toContain("daily:tomorrow");
		});
	});

	describe("error handling", () => {
		it("should throw error for missing URI parameter", async () => {
			await expect(handler({})).rejects.toThrow("URI parameter is required");
		});

		it("should throw error for invalid URI format", async () => {
			await expect(handler({ uri: "invalid-uri" })).rejects.toThrow("Invalid URI format");
		});
	});
});
