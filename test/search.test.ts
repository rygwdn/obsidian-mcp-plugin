import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchTool } from "../tools/search";
import { MockApp } from "./mocks/obsidian";

describe("search tool", () => {
	let mockApp: MockApp;

	beforeEach(() => {
		vi.clearAllMocks();
		mockApp = new MockApp();
		mockApp.setFiles({
			"file1.md": "This is the first test file with apple content",
			"file2.md": "Second file has banana content",
			"file3.md": "Third file contains apple and banana",
			"notes.txt": "This is not a markdown file with apple",
		});
	});

	it("should return matching markdown files for a query", async () => {
		const handler = searchTool.handler(mockApp);
		const result = await handler({ query: "apple" });

		expect(mockApp.vault.getMarkdownFiles).toHaveBeenCalled();
		expect(mockApp.vault.cachedRead).toHaveBeenCalled();

		// We should find two markdown files with "apple"
		expect(result).toContain("file1.md");
		expect(result).toContain("file3.md");
		expect(result).not.toContain("file2.md");
		expect(result).not.toContain("notes.txt");
	});

	it("should throw an error when no results are found", async () => {
		const handler = searchTool.handler(mockApp);
		await expect(handler({ query: "nonexistent" })).rejects.toThrow(
			"No results found for query: nonexistent"
		);
	});

	it("should be case-insensitive", async () => {
		const handler = searchTool.handler(mockApp);
		const result = await handler({ query: "APPLE" });

		// Should find the files with "apple" even though the query is uppercase
		expect(result).toContain("file1.md");
		expect(result).toContain("file3.md");
	});
});
