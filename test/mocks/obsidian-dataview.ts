import { vi } from "vitest";
import type * as DataViewResult from "obsidian-dataview/lib/api/result.d.ts";

export const mockDataviewApi = {
	queryMarkdown: vi.fn(
		() =>
			({
				successful: true,
				value: "Parsed markdown content result",
			}) as Partial<DataViewResult.Result<string, string>>
	),
};

export const getAPI = vi.fn(() => mockDataviewApi as typeof mockDataviewApi | undefined);

export const isPluginEnabled = vi.fn(() => true);
