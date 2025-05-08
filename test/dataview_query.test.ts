import { describe, it, expect, vi, beforeEach } from "vitest";
import { dataviewQueryTool } from "../tools/dataview_query";
import { MockApp } from "./mocks/obsidian";

// Mock Dataview API response
const mockDataviewResult = {
	successful: true,
	value: [
		{ file: { path: "file1.md" }, tags: ["tag1", "tag2"], date: "2023-01-01" },
		{ file: { path: "file3.md" }, tags: ["tag1"], date: "2023-01-03" },
	],
};

// Mock failed query result
const mockFailedResult = {
	successful: false,
	error: "Invalid query syntax",
};

describe("dataview_query tool", () => {
	let mockApp: MockApp;

	beforeEach(() => {
		vi.clearAllMocks();
		mockApp = new MockApp();

		// Set up mock files
		mockApp.setFiles({
			"file1.md": "---\ntags: [tag1, tag2]\ndate: 2023-01-01\n---\nContent 1",
			"file2.md": "---\ntags: [tag3]\ndate: 2023-01-02\n---\nContent 2",
			"file3.md": "---\ntags: [tag1]\ndate: 2023-01-03\n---\nContent 3",
		});

		// Mock Dataview plugin
		mockApp.plugins = {
			enabledPlugins: new Set(["dataview"]),
			plugins: {
				dataview: {
					api: {
						tryQuery: vi.fn(async (query: string) => {
							if (query === "LIST FROM #tag1") {
								return mockDataviewResult;
							} else if (query === "INVALID QUERY") {
								return mockFailedResult;
							} else {
								return {
									successful: true,
									value: [],
								};
							}
						}),
					},
				},
			},
		};
	});

	it("should return markdown results for a successful query", async () => {
		const handler = dataviewQueryTool.handler(mockApp);
		const result = await handler({ query: "LIST FROM #tag1" });

		// Check that the dataview API was called
		expect(mockApp.plugins.plugins.dataview.api.tryQuery).toHaveBeenCalledWith("LIST FROM #tag1");

		// Should return string representation of the value
		expect(result).toEqual(String(mockDataviewResult.value));
	});

	it("should throw an error when query execution fails", async () => {
		const handler = dataviewQueryTool.handler(mockApp);

		await expect(handler({ query: "INVALID QUERY" })).rejects.toThrow(
			"Query execution failed: Invalid query syntax"
		);
	});

	it("should throw an error when Dataview plugin is not enabled", async () => {
		// Mock app with dataview plugin not available
		mockApp.plugins.plugins = {};

		const handler = dataviewQueryTool.handler(mockApp);

		await expect(handler({ query: "LIST FROM #tag1" })).rejects.toThrow(
			"Dataview plugin is not enabled. Please enable it in your Obsidian settings."
		);
	});

	it("should throw an error when Dataview API is not available", async () => {
		// Mock app with dataview plugin enabled but no API
		mockApp.plugins.plugins = {
			dataview: {},
		};

		const handler = dataviewQueryTool.handler(mockApp);

		await expect(handler({ query: "LIST FROM #tag1" })).rejects.toThrow(
			"Dataview API is not available. Make sure the Dataview plugin is correctly loaded."
		);
	});
});
