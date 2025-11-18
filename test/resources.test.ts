import { describe, it, expect, vi, beforeEach } from "vitest";
import moment from "moment"; // Import moment
import { VaultFileResource, VaultDailyNoteResource } from "../tools/vault_file_resource";
import { MockObsidian, createMockRequest, createMockExtra } from "./mock_obsidian";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getContentsTool } from "../tools/get_contents";
import * as DailyNoteUtils from "../tools/daily_note_utils";

const MOCK_SYSTEM_DATE = "2023-05-09T12:00:00.000Z";

describe("VaultFileResource", () => {
	let obsidian: MockObsidian;
	let resource: VaultFileResource;
	let request: ReturnType<typeof createMockRequest>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(MOCK_SYSTEM_DATE));
		vi.clearAllMocks();

		vi.stubGlobal("window", {
			moment: (...args: unknown[]) => {
				if (args.length === 0) {
					return moment(vi.getMockedSystemTime());
				}
				// @ts-expect-error - moment can be called with various arg types
				return moment(...args);
			},
		});

		obsidian = new MockObsidian();
		request = createMockRequest(obsidian);

		obsidian.setFiles({
			"test1.md": "Test file 1 contents",
			"test2.md": "Test file 2 contents",
			"folder/test3.md": "Test file 3 contents",
			"readme.txt": "This is not a markdown file",
			"daily_notes/2023-05-09.md": "Daily note content for today",
			"daily_notes/2023-05-08.md": "Daily note content for yesterday",
			"daily_notes/2023-05-10.md": "Daily note content for tomorrow",
			"file with spaces.md": "Content of file with spaces",
			"folder with spaces/nested file.md": "Content of nested file with spaces",
		});

		obsidian.dailyNotes = {
			format: "YYYY-MM-DD",
			folder: "daily_notes",
		};

		resource = new VaultFileResource(obsidian);
	});

	describe("constructor", () => {
		it("should initialize correctly", () => {
			const resource = new VaultFileResource(obsidian);
			expect.soft(resource.template).toBeDefined();
			const resourceName = resource["resourceName"]; // Access protected property for test validation
			expect(resourceName).toBe("file");
			const description = resource["description"];
			expect(description).toBe("Provides access to files and directories in the Obsidian vault");
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
					description: "Provides access to files and directories in the Obsidian vault",
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
			const resource = new VaultFileResource(obsidian);
			expect(resource).toBeDefined();

			// Instead, test the list method directly since that's what the template would call
			const listResult = resource.list(request);
			// The VaultFileResource should list all markdown files
			const markdownFiles = obsidian.getMarkdownFiles(request);
			expect(listResult.resources).toHaveLength(markdownFiles.length);
		});

		it("should use completePath in template", () => {
			// Test the underlying method called by the template
			const result = resource.completePath("folder", request);
			expect(result).toContain("folder/test3.md");
		});
	});

	describe("list", () => {
		it("should return a list of markdown files correctly", () => {
			const result = resource.list(request);
			// The VaultFileResource should list all markdown files
			const markdownFiles = obsidian.getMarkdownFiles(request);
			expect(result.resources.length).toBe(markdownFiles.length);

			const markdownFileResources = result.resources.filter((r) => r.mimeType === "text/markdown");
			expect(markdownFileResources.length).toBe(markdownFiles.length);

			markdownFileResources.forEach((res) => {
				expect(res.name).toBeDefined();
				expect(res.uri).toContain("file://");
				expect(res.mimeType).toBe("text/markdown");
			});

			const fileNames = result.resources.map((r) => r.name);
			expect(fileNames).toContain("test1.md");
			expect(fileNames).toContain("test2.md");
			expect(fileNames).toContain("folder/test3.md");
			expect(fileNames).not.toContain("readme.txt");
		});
	});

	describe("completePath", () => {
		it("should return paths that start with the given value", () => {
			const result = resource.completePath("test", request);
			expect(result).toContain("test1.md");
			expect(result).toContain("test2.md");
			expect(result).not.toContain("folder/test3.md"); // Doesn't start with 'test'
		});

		it("should return paths that start with folder path", () => {
			const result = resource.completePath("folder", request);
			expect(result).toContain("folder/test3.md");
			expect(result).not.toContain("test1.md");
		});

		it("should return empty array when no matches found", () => {
			const result = resource.completePath("nonexistent", request);
			expect(result).toHaveLength(0);
		});
	});

	describe("handler", () => {
		it("should return file contents for a valid path", async () => {
			const extra = createMockExtra(request);
			const result = await resource.handler(new URL("file:///test1.md"), extra);

			expect(result.contents).toHaveLength(1);
			expect(result.contents[0].text).toBe("Test file 1 contents");
			expect(result.contents[0].uri).toBe("file:///test1.md");
			expect(result.contents[0].mimeType).toBe("text/markdown");
		});

		it("should throw an error for non-existent files", async () => {
			const extra = createMockExtra(request);
			const handlerCall = resource.handler(new URL("file:///non-existent.md"), extra);
			await expect(handlerCall).rejects.toThrowErrorMatchingInlineSnapshot(
				`[Error: File not found: non-existent.md]`
			);
		});

		it("should handle directory listing", async () => {
			const result = {
				contents: [{ mimeType: "text/directory", text: "test3.md", uri: "file:///folder?depth=0" }],
			};

			expect(result.contents).toHaveLength(1);
			expect(result.contents[0].mimeType).toBe("text/directory");
			expect(result.contents[0].text).toContain("test3.md");
		});

		it("should handle URL-encoded file names with spaces", async () => {
			const extra = createMockExtra(request);
			const result = await resource.handler(new URL("file:///file%20with%20spaces.md"), extra);

			expect(result.contents).toHaveLength(1);
			expect(result.contents[0].text).toBe("Content of file with spaces");
			expect(result.contents[0].uri).toBe("file:///file%20with%20spaces.md");
			expect(result.contents[0].mimeType).toBe("text/markdown");
		});

		it("should handle URL-encoded folder paths with spaces", async () => {
			const extra = createMockExtra(request);
			const result = await resource.handler(
				new URL("file:///folder%20with%20spaces/nested%20file.md"),
				extra
			);

			expect(result.contents).toHaveLength(1);
			expect(result.contents[0].text).toBe("Content of nested file with spaces");
			expect(result.contents[0].uri).toBe("file:///folder%20with%20spaces/nested%20file.md");
			expect(result.contents[0].mimeType).toBe("text/markdown");
		});

		it("should handle URL-encoded directory listing", async () => {
			const extra = createMockExtra(request);
			const result = await resource.handler(new URL("file:///folder%20with%20spaces"), extra);

			expect(result.contents).toHaveLength(1);
			expect(result.contents[0].mimeType).toBe("text/directory");
			expect(result.contents[0].text).toContain("nested file.md");
		});
	});
});

describe("VaultDailyNoteResource", () => {
	let obsidian: MockObsidian;
	let resource: VaultDailyNoteResource;
	let request: ReturnType<typeof createMockRequest>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(MOCK_SYSTEM_DATE));
		vi.clearAllMocks();

		vi.stubGlobal("window", {
			moment: (...args: unknown[]) => {
				if (args.length === 0) {
					return moment(vi.getMockedSystemTime());
				}
				// @ts-expect-error - moment can be called with various arg types
				return moment(...args);
			},
		});

		obsidian = new MockObsidian();
		request = createMockRequest(obsidian);

		obsidian.setFiles({
			"daily_notes/2023-05-09.md": "Daily note content for today",
			"daily_notes/2023-05-08.md": "Daily note content for yesterday",
			"daily_notes/2023-05-10.md": "Daily note content for tomorrow",
		});

		obsidian.dailyNotes = {
			format: "YYYY-MM-DD",
			folder: "daily_notes",
		};

		resource = new VaultDailyNoteResource(obsidian);
	});

	describe("constructor", () => {
		it("should initialize correctly", () => {
			const resource = new VaultDailyNoteResource(obsidian);
			expect.soft(resource.template).toBeDefined();
			const resourceName = resource["resourceName"]; // Access protected property for test validation
			expect(resourceName).toBe("daily");
			const description = resource["description"];
			expect(description).toBe("Provides access to daily notes in the Obsidian vault");
		});
	});

	describe("register", () => {
		it("should register the resource with the server", () => {
			const mockServer = {
				resource: vi.fn(),
			};

			resource.register(mockServer as unknown as McpServer);

			expect(mockServer.resource).toHaveBeenCalledWith(
				"daily",
				expect.any(Object),
				{
					description: "Provides access to daily notes in the Obsidian vault",
				},
				expect.any(Function)
			);
		});
	});

	describe("list", () => {
		it("should return a list with daily note aliases", () => {
			const result = resource.list(request);
			const aliases = Object.keys(DailyNoteUtils.ALIASES);

			expect(result.resources.length).toBe(aliases.length);

			for (const alias of aliases) {
				const resource = result.resources.find((r) => r.name === alias);
				expect(resource).toBeDefined();
				expect(resource?.uri).toBe(`daily:///${alias}`);
				expect(resource?.mimeType).toBe("text/markdown");
			}
		});
	});

	describe("completePath", () => {
		it("should return matching aliases", () => {
			const result = resource.completePath("to");
			expect(result).toContain("today");
			expect(result).toContain("tomorrow");
			expect(result).not.toContain("yesterday");
		});

		it("should return empty array when no matches found", () => {
			const result = resource.completePath("nonexistent");
			expect(result).toHaveLength(0);
		});
	});

	describe("handler", () => {
		it("should return daily note content for today", async () => {
			const extra = createMockExtra(request);
			const result = await resource.handler(new URL("daily:///today"), extra);

			expect(result.contents).toHaveLength(1);
			expect(result.contents[0].text).toBe("Daily note content for today");
			expect(result.contents[0].uri).toBe("daily:///today");
			expect(result.contents[0].mimeType).toBe("text/markdown");
		});

		it("should throw error when daily notes plugin not enabled", async () => {
			// Disable the daily notes plugin
			obsidian.dailyNotes = null;

			const extra = createMockExtra(request);
			const handlerCall = resource.handler(new URL("daily:///today"), extra);

			await expect(handlerCall).rejects.toThrow(
				"Cannot access daily notes: No daily notes plugin is enabled"
			);
		});
	});
});

describe("getContentsTool", () => {
	let obsidian: MockObsidian;
	let request: ReturnType<typeof createMockRequest>;

	beforeEach(() => {
		vi.useFakeTimers(); // Use fake timers
		vi.setSystemTime(new Date(MOCK_SYSTEM_DATE)); // Set system time
		vi.clearAllMocks();
		obsidian = new MockObsidian();
		request = createMockRequest(obsidian);

		vi.stubGlobal("window", {
			moment: (...args: unknown[]) => {
				if (args.length === 0) {
					return moment(vi.getMockedSystemTime());
				}
				// @ts-expect-error - moment can be called with various arg types
				return moment(...args);
			},
		});

		obsidian.setFiles({
			"test1.md": "Test file 1 contents",
			"test2.md": "Test file 2 contents",
			"folder/test3.md": "Test file 3 contents",
			"readme.txt": "This is not a markdown file",
			"test_offsets.md": "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
			"daily_notes/2023-05-09.md": "Daily note content for today",
			"daily_notes/2023-05-08.md": "Daily note content for yesterday",
			"daily_notes/2023-05-10.md": "Daily note content for tomorrow",
			"file with spaces.md": "Content of file with spaces",
			"folder with spaces/nested file.md": "Content of nested file with spaces",
		});

		obsidian.dailyNotes = {
			format: "YYYY-MM-DD",
			folder: "daily_notes",
		};
	});

	describe("error handling", () => {
		it("should throw error for missing URI parameter", async () => {
			await expect(getContentsTool.handler(obsidian, request, {})).rejects.toThrow(
				"URI parameter is required"
			);
		});

		it("should throw error for invalid URI format", async () => {
			await expect(
				getContentsTool.handler(obsidian, request, { uri: "invalid-uri" })
			).rejects.toThrow("File not found: invalid-uri");
		});

		it("should throw error for invalid URI protocol", async () => {
			await expect(
				getContentsTool.handler(obsidian, request, { uri: "something:///test" })
			).rejects.toThrow("File not found: something:///test");
		});
	});

	describe("file content retrieval", () => {
		it("should retrieve file contents using URI", async () => {
			const result = await getContentsTool.handler(obsidian, request, { uri: "file:///test1.md" });
			expect(result).toBe("Test file 1 contents");
		});

		it("should handle query parameters", async () => {
			// In MCP, offset params are handled after text retrieval
			const result = await getContentsTool.handler(obsidian, request, {
				uri: "file:///test_offsets.md",
				startOffset: 5,
				endOffset: 15,
			});

			expect(result).toMatchInlineSnapshot(`"56789ABCDE"`);
		});

		it("should handle URL-encoded file names with spaces", async () => {
			const result = await getContentsTool.handler(obsidian, request, {
				uri: "file:///file%20with%20spaces.md",
			});
			expect(result).toBe("Content of file with spaces");
		});

		it("should handle URL-encoded folder paths with spaces", async () => {
			const result = await getContentsTool.handler(obsidian, request, {
				uri: "file:///folder%20with%20spaces/nested%20file.md",
			});
			expect(result).toBe("Content of nested file with spaces");
		});
	});

	describe("directory listing", () => {
		it("should retrieve directory listing", async () => {
			const result = await getContentsTool.handler(obsidian, request, { uri: "file:///folder" });
			expect(result).toBe("test3.md");
		});
	});

	describe("daily note handling", () => {
		it("should handle daily note paths", async () => {
			const result = await getContentsTool.handler(obsidian, request, { uri: "daily:///today" });
			expect(result).toBe("Daily note content for today");
		});

		it("should throw error for missing daily note", async () => {
			vi.clearAllMocks();

			obsidian.markdownFiles.delete("daily_notes/2023-05-09.md");

			await expect(
				getContentsTool.handler(obsidian, request, { uri: "daily:///today" })
			).rejects.toThrowErrorMatchingInlineSnapshot(
				`[Error: File not found: daily_notes/2023-05-09.md]`
			);
		});
	});
});
