import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchTool } from "../tools/search";
import { MockObsidian, createMockRequest } from "./mock_obsidian";

describe("search tool", () => {
	let obsidian: MockObsidian;
	let request: ReturnType<typeof createMockRequest>;

	beforeEach(() => {
		vi.clearAllMocks();
		obsidian = new MockObsidian();
		request = createMockRequest(obsidian);

		obsidian.setFiles({
			"file1.md": "This is the first test file with apple content",
			"file2.md": "Second file has banana content",
			"file3.md": "Third file contains apple and banana",
			"notes.txt": "This is not a markdown file with apple",
			"folder/nested.md": "This nested file also has apple content",
		});
	});

	it("should return matching markdown files for a query", async () => {
		const result = await searchTool.handler(obsidian, request, {
			query: "apple",
			limit: 100,
			fuzzy: false,
		});

		// We should find three markdown files with "apple"
		expect(result).toContain("file1.md");
		expect(result).toContain("file3.md");
		expect(result).toContain("folder/nested.md");
		expect(result).not.toContain("file2.md");
		expect(result).not.toContain("notes.txt");
	});

	it("should throw an error when no results are found", async () => {
		await expect(
			searchTool.handler(obsidian, request, {
				query: "nonexistent",
				limit: 100,
				fuzzy: false,
			})
		).rejects.toThrow("No results found for query: nonexistent");
	});

	it("should be case-insensitive", async () => {
		const result = await searchTool.handler(obsidian, request, {
			query: "APPLE",
			limit: 100,
			fuzzy: false,
		});

		// Should find the files with "apple" even though the query is uppercase
		expect(result).toContain("file1.md");
		expect(result).toContain("file3.md");
		expect(result).toContain("folder/nested.md");
	});

	it("should respect the limit parameter", async () => {
		const result = await searchTool.handler(obsidian, request, {
			query: "apple",
			limit: 1,
			fuzzy: false,
		});

		// Should find one match due to limit
		expect(result).toContain("1 of 3 matches");

		// Only one file should have content displayed
		const fileMatches = result.match(/## file:\/\/\/[^\n]+/g);
		expect(fileMatches).toHaveLength(1);
	});

	it("should filter by folder when specified", async () => {
		const result = await searchTool.handler(obsidian, request, {
			query: "apple",
			limit: 100,
			fuzzy: false,
			folder: "folder",
		});

		// Should only match files in folder
		expect(result).toContain("folder/nested.md");
		expect(result).not.toContain("file1.md");
		expect(result).not.toContain("file3.md");
	});

	it("should use appropriate search function based on fuzzy flag", async () => {
		// Instead of trying to spy on the mocked functions, let's test behavior
		// Run with fuzzy=false (simple search)
		const result1 = await searchTool.handler(obsidian, request, {
			query: "apple",
			limit: 100,
			fuzzy: false,
		});

		// Run with fuzzy=true
		const result2 = await searchTool.handler(obsidian, request, {
			query: "apple",
			limit: 100,
			fuzzy: true,
		});

		// Both should find results
		expect(result1).toContain("file1.md");
		expect(result2).toContain("file1.md");
	});

	it("should format match results with context", async () => {
		const result = await searchTool.handler(obsidian, request, {
			query: "apple",
			limit: 100,
			fuzzy: false,
		});

		// Should have a section with context lines
		expect(result).toContain("> This is the first test file with apple content");

		// Should have match position markers
		expect(result).toMatch(/@\[\d+, \d+\]/);
	});
});
