import { describe, it, expect, vi, beforeEach } from "vitest";
import { dataviewQueryTool } from "../tools/dataview_query";
import { MockApp } from "./mocks/obsidian";
import { getAPI, isPluginEnabled, mockDataviewApi } from "./mocks/obsidian-dataview";
import type * as DataView from "obsidian-dataview/lib/api/result.d.ts";

const mockDataviewResult = {
	successful: true,
	value: "Parsed markdown content result",
} satisfies Partial<DataView.Success<string, string>>;

const mockFailedResult = {
	successful: false,
	error: "Invalid query syntax",
} satisfies Partial<DataView.Failure<string, string>>;

describe("dataview_query tool", () => {
	let mockApp: MockApp;

	beforeEach(() => {
		vi.clearAllMocks();
		mockApp = new MockApp();

		mockApp.setFiles({
			"file1.md": "---\ntags: [tag1, tag2]\ndate: 2023-01-01\n---\nContent 1",
			"file2.md": "---\ntags: [tag3]\ndate: 2023-01-02\n---\nContent 2",
			"file3.md": "---\ntags: [tag1]\ndate: 2023-01-03\n---\nContent 3",
		});
	});

	it("should return markdown results for a successful query", async () => {
		const handler = dataviewQueryTool.handler(mockApp, mockApp.settings);
		const result = await handler({ query: "LIST FROM #tag1" });

		expect(mockDataviewApi.queryMarkdown).toHaveBeenCalledWith("LIST FROM #tag1");
		expect(result).toEqual(mockDataviewResult.value);
	});

	it("should throw an error when query execution fails", async () => {
		mockDataviewApi.queryMarkdown.mockResolvedValue(mockFailedResult);
		const handler = dataviewQueryTool.handler(mockApp, mockApp.settings);

		await expect(handler({ query: "INVALID QUERY" })).rejects.toThrow(/Invalid query syntax/);
	});

	it("should throw an error when Dataview plugin is not enabled", async () => {
		isPluginEnabled.mockReturnValue(false);
		const handler = dataviewQueryTool.handler(mockApp, mockApp.settings);

		await expect(handler({ query: "LIST FROM #tag1" })).rejects.toThrow(
			/Dataview plugin is not enabled/
		);
	});

	it("should throw an error when Dataview API is not available", async () => {
		isPluginEnabled.mockReturnValue(true);
		getAPI.mockReturnValue(undefined);

		const handler = dataviewQueryTool.handler(mockApp, mockApp.settings);

		await expect(handler({ query: "LIST FROM #tag1" })).rejects.toThrow(
			/Dataview API is not available/
		);
	});
});
