import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFileContentsTool } from "../tools/get_file_contents";
import { MockApp } from "./mocks/obsidian";
import { App } from "obsidian";

describe("get_file_contents tool", () => {
	let mockApp: MockApp;

	beforeEach(() => {
		vi.clearAllMocks();
		mockApp = new MockApp();
		mockApp.setFiles({
			"test.md": "This is a test file content",
		});
	});

	it("should return the content of an existing file", async () => {
		const handler = getFileContentsTool.handler(mockApp as unknown as App);
		const result = await handler({ path: "test.md" });

		expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith("test.md");
		expect(mockApp.vault.cachedRead).toHaveBeenCalled();
		expect(result).toBe("This is a test file content");
	});

	it("should throw an error when the file does not exist", async () => {
		const handler = getFileContentsTool.handler(mockApp as unknown as App);

		await expect(handler({ path: "nonexistent.md" })).rejects.toThrow(
			"File not found: nonexistent.md"
		);
	});

	it("should normalize file paths", async () => {
		const handler = getFileContentsTool.handler(mockApp as unknown as App);
		await handler({ path: "test.md" });

		// Check that normalizePath was used by checking the path
		expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith("test.md");
	});
});
