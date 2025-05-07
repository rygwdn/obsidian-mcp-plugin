import { describe, it, expect, vi, beforeEach } from "vitest";
import { appendContentTool } from "../tools/append_content";
import { MockApp } from "./mocks/obsidian";

describe("append_content tool", () => {
	let mockApp: MockApp;

	beforeEach(() => {
		vi.clearAllMocks();
		mockApp = new MockApp();
		mockApp.setFiles({
			"test.md": "This is a test file content",
		});
	});

	it("should append content to an existing file", async () => {
		const handler = appendContentTool.handler(mockApp);
		const result = await handler({
			path: "test.md",
			content: "Some additional content",
		});

		expect(mockApp.vault.adapter.write).toHaveBeenCalled();

		// Make sure the content includes both the original and appended content
		const writeCall = mockApp.vault.adapter.write.mock.calls[0];
		expect(writeCall[0]).toBe("test.md");
		expect(writeCall[1]).toBe("This is a test file content\nSome additional content");

		expect(result).toBe("Content appended successfully");
	});

	it("should add a newline if the file doesn't end with one", async () => {
		mockApp.setFiles({
			"test.md": "Content without newline",
		});

		const handler = appendContentTool.handler(mockApp);
		await handler({
			path: "test.md",
			content: "Appended content",
		});

		const writeCall = vi.mocked(mockApp.vault.adapter).write.mock.calls[0];
		expect(writeCall[1]).toBe("Content without newline\nAppended content");
	});
});
