import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchTool } from "../tools/search";
import { App, TFile } from "obsidian";

describe("search tool", () => {
	const mockApp = new App();

	beforeEach(() => {
		vi.clearAllMocks();

		// Clear previous file data
		mockApp.vault.files = [];
		mockApp.vault.adapter.files.clear();

		// Set up test files with different content
		mockApp.vault.files = [
			new TFile("file1.md", "This is the first test file with apple content"),
			new TFile("file2.md", "Second file has banana content"),
			new TFile("file3.md", "Third file contains apple and banana"),
			new TFile("notes.txt", "This is not a markdown file with apple"), // Not markdown
		];
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
