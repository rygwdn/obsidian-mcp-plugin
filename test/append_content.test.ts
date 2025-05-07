import { describe, it, expect, vi, beforeEach } from "vitest";
import { appendContentTool } from "../tools/append_content";
import { App, TFile } from "obsidian";

describe("append_content tool", () => {
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

	it("should create a new file when the file does not exist", async () => {
		const handler = appendContentTool.handler(mockApp);
		const result = await handler({
			path: "new.md",
			content: "New file content",
		});

		expect(mockApp.vault.adapter.write).toHaveBeenCalled();

		// Check that the file was created with the correct content
		const writeCall = mockApp.vault.adapter.write.mock.calls[0];
		expect(writeCall[0]).toBe("new.md");
		expect(writeCall[1]).toBe("New file content");

		expect(result).toBe("Content appended successfully");
	});

	it("should attempt to create parent folders", async () => {
		const handler = appendContentTool.handler(mockApp);
		await handler({
			path: "folder/new.md",
			content: "New file content",
		});

		expect(mockApp.vault.createFolder).toHaveBeenCalledWith("folder");
	});

	it("should add a newline if the file doesn't end with one", async () => {
		// Change the content to not end with a newline
		mockApp.vault.files[0].contents = "Content without newline";

		const handler = appendContentTool.handler(mockApp);
		await handler({
			path: "test.md",
			content: "Appended content",
		});

		const writeCall = mockApp.vault.adapter.write.mock.calls[0];
		expect(writeCall[1]).toBe("Content without newline\nAppended content");
	});
});
