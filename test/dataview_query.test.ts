import { describe, it, expect, vi, beforeEach } from "vitest";
import { dataviewQueryTool } from "../tools/dataview_query";
import { MockObsidian, createMockRequest } from "./mock_obsidian";
import type * as DataView from "obsidian-dataview/lib/api/result.d.ts";
import type { DataviewInterface } from "../obsidian/obsidian_interface";

const mockDataviewResult = {
	successful: true,
	value: "Parsed markdown content result",
} satisfies Partial<DataView.Success<string, string>>;

class MockDataview implements DataviewInterface {
	private queryResults: Map<string, string> = new Map();
	private queryErrors: Map<string, string> = new Map();

	setQueryMarkdownResult(query: string, result: string): void {
		this.queryResults.set(query, result);
	}

	setQueryMarkdownError(query: string, error: string): void {
		this.queryErrors.set(query, error);
	}

	async queryMarkdown(
		query: string
	): Promise<{ successful: boolean; value?: string; error?: string }> {
		if (this.queryErrors.has(query)) {
			return {
				successful: false,
				error: this.queryErrors.get(query),
			};
		}
		if (this.queryResults.has(query)) {
			return {
				successful: true,
				value: this.queryResults.get(query),
			};
		}
		throw new Error(`No mock result for query: ${query}`);
	}
}

describe("dataview_query tool", () => {
	let obsidian: MockObsidian;
	let dataviewPlugin: MockDataview;

	beforeEach(() => {
		vi.clearAllMocks();
		obsidian = new MockObsidian();

		// Add test files
		obsidian.setFiles({
			"file1.md": "---\ntags: [tag1, tag2]\ndate: 2023-01-01\n---\nContent 1",
			"file2.md": "---\ntags: [tag3]\ndate: 2023-01-02\n---\nContent 2",
			"file3.md": "---\ntags: [tag1]\ndate: 2023-01-03\n---\nContent 3",
		});

		dataviewPlugin = new MockDataview();
		obsidian.dataview = dataviewPlugin;

		dataviewPlugin.setQueryMarkdownResult("LIST FROM #tag1", mockDataviewResult.value);
		dataviewPlugin.setQueryMarkdownError("INVALID QUERY", "Invalid query syntax");
	});

	it("should return markdown results for a successful query", async () => {
		const queryMarkdownSpy = vi.spyOn(dataviewPlugin, "queryMarkdown");
		const mockRequest = createMockRequest(obsidian);

		const result = await dataviewQueryTool.handler(obsidian, mockRequest, {
			query: "LIST FROM #tag1",
		});

		expect(queryMarkdownSpy).toHaveBeenCalledWith("LIST FROM #tag1");
		expect(result).toEqual(mockDataviewResult.value);
	});

	it("should throw an error when query execution fails", async () => {
		const queryMarkdownSpy = vi.spyOn(dataviewPlugin, "queryMarkdown");
		const mockRequest = createMockRequest(obsidian);

		await expect(
			dataviewQueryTool.handler(obsidian, mockRequest, { query: "INVALID QUERY" })
		).rejects.toThrow(/Invalid query syntax/);
		expect(queryMarkdownSpy).toHaveBeenCalledWith("INVALID QUERY");
	});

	it("should throw an error when Dataview plugin is not enabled", async () => {
		obsidian.dataview = null;
		const mockRequest = createMockRequest(obsidian);

		await expect(
			dataviewQueryTool.handler(obsidian, mockRequest, { query: "LIST FROM #tag1" })
		).rejects.toThrow(/Dataview plugin is not enabled/);
	});

	it("should throw an error when Dataview API is not available", async () => {
		obsidian.dataview = null;
		const mockRequest = createMockRequest(obsidian);

		await expect(
			dataviewQueryTool.handler(obsidian, mockRequest, { query: "LIST FROM #tag1" })
		).rejects.toThrow(/Dataview plugin is not enabled/);
	});
});
