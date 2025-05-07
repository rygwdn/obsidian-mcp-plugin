import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFileContentsTool } from "../tools/get_file_contents";
import { App, TFile } from "obsidian";

describe("get_file_contents tool", () => {
	const mockApp = new App();

	beforeEach(() => {
		vi.clearAllMocks();

		// Clear previous file data
		mockApp.vault.files = [];
		mockApp.vault.adapter.files.clear();

		// Set up test files
		const testFilePath = "test.md";
		const testFileContent = "This is a test file content";

		// Add file to vault
		mockApp.vault.files.push(new TFile(testFilePath, testFileContent));

		// Add file to adapter
		mockApp.vault.adapter.files.set(testFilePath, {
			content: testFileContent,
			isFolder: false,
		});
	});

	it("should return the content of an existing file", async () => {
		const handler = getFileContentsTool.handler(mockApp);
		const result = await handler({ path: "test.md" });

		expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith("test.md");
		expect(mockApp.vault.cachedRead).toHaveBeenCalled();
		expect(result).toBe("This is a test file content");
	});

	it("should throw an error when the file does not exist", async () => {
		const handler = getFileContentsTool.handler(mockApp);

		await expect(handler({ path: "nonexistent.md" })).rejects.toThrow(
			"File not found: nonexistent.md"
		);
	});

	it("should normalize file paths", async () => {
		const handler = getFileContentsTool.handler(mockApp);
		await handler({ path: "test.md" });

		// Check that normalizePath was used by checking the path
		expect(mockApp.vault.getAbstractFileByPath).toHaveBeenCalledWith("test.md");
	});
});
