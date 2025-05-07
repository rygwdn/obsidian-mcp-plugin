import { describe, it, expect, vi, beforeEach } from "vitest";
import { replaceContentTool } from "../tools/replace_content";
import { MockApp } from "./mocks/obsidian";

describe("replace_content tool", () => {
	let mockApp: MockApp;

	beforeEach(() => {
		vi.clearAllMocks();
		mockApp = new MockApp();
		mockApp.setFiles({
			"test.md": "This is a test file with specific content to replace.",
			"multiple.md": "This has multiple matches. This has multiple matches.",
			"empty.md": "",
		});
	});

	it("should replace content in a file", async () => {
		const handler = replaceContentTool.handler(mockApp);
		const result = await handler({
			path: "test.md",
			find: "specific content",
			replace: "replacement text",
		});

		expect(mockApp.vault.adapter.write).toHaveBeenCalled();

		// Verify content was replaced correctly
		const writeCall = vi.mocked(mockApp.vault.adapter).write.mock.calls[0];
		expect(writeCall[0]).toBe("test.md");
		expect(writeCall[1]).toBe("This is a test file with replacement text to replace.");
		expect(result).toBe("Content successfully replaced in test.md");
	});

	it("should throw an error when the file doesn't exist", async () => {
		const handler = replaceContentTool.handler(mockApp);

		await expect(
			handler({
				path: "nonexistent.md",
				find: "content",
				replace: "new content",
			})
		).rejects.toThrow("File not found: nonexistent.md");
	});

	it("should throw an error when content to find is not in the file", async () => {
		const handler = replaceContentTool.handler(mockApp);

		await expect(
			handler({
				path: "test.md",
				find: "nonexistent content",
				replace: "new content",
			})
		).rejects.toThrow("Content not found in file: test.md");
	});

	it("should throw an error when there are multiple matches", async () => {
		const handler = replaceContentTool.handler(mockApp);

		await expect(
			handler({
				path: "multiple.md",
				find: "multiple matches",
				replace: "new content",
			})
		).rejects.toThrow("Multiple matches (2) found in file: multiple.md");
	});

	it("should work with empty replacement string", async () => {
		const handler = replaceContentTool.handler(mockApp);
		const result = await handler({
			path: "test.md",
			find: "specific content",
			replace: "",
		});

		const writeCall = vi.mocked(mockApp.vault.adapter).write.mock.calls[0];
		expect(writeCall[1]).toBe("This is a test file with  to replace.");
		expect(result).toBe("Content successfully replaced in test.md");
	});
});
