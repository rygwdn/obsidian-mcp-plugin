import { describe, it, expect, vi, beforeEach } from "vitest";
import { listFilesTool } from "../tools/list_files";
import { MockApp } from "./mocks/obsidian";

describe("list_files tool", () => {
	let mockApp: MockApp;

	beforeEach(() => {
		vi.clearAllMocks();
		mockApp = new MockApp();
		mockApp.setFiles({
			"file1.md": "",
			"file2.md": "",
			"dir1/file3.md": "",
			"dir1/file4.md": "",
			"dir2/file5.md": "",
			"dir2/subdir/file6.md": "",
			"dir2/subdir/nested/file7.md": "",
		});
	});

	it("should list files from root when no path is provided", async () => {
		const handler = listFilesTool.handler(mockApp);
		const result = await handler({});

		expect(mockApp.vault.getFiles).toHaveBeenCalled();
		expect(result).toMatchInlineSnapshot(`
			"dir1/file3.md
			dir1/file4.md
			dir2/file5.md
			dir2/subdir/
			file1.md
			file2.md"
		`);
	});

	it("should list files from a specific directory", async () => {
		const handler = listFilesTool.handler(mockApp);
		const result = await handler({ path: "dir1/" });

		expect(mockApp.vault.getFiles).toHaveBeenCalled();
		expect(result).toMatchInlineSnapshot(`
			"ile3.md
			ile4.md"
		`);
	});

	it("should respect the depth parameter when set to 0", async () => {
		const handler = listFilesTool.handler(mockApp);
		const result = await handler({ depth: 0 });

		expect(mockApp.vault.getFiles).toHaveBeenCalled();
		expect(result).toMatchInlineSnapshot(`
			"dir1/
			dir2/
			file1.md
			file2.md"
		`);
	});

	it("should respect the depth parameter when set to 2", async () => {
		const handler = listFilesTool.handler(mockApp);
		const result = await handler({ depth: 2 });

		expect(mockApp.vault.getFiles).toHaveBeenCalled();
		expect(result).toMatchInlineSnapshot(`
			"dir1/file3.md
			dir1/file4.md
			dir2/file5.md
			dir2/subdir/file6.md
			dir2/subdir/nested/
			file1.md
			file2.md"
		`);
	});

	it("should use depth 1 by default", async () => {
		const handler = listFilesTool.handler(mockApp);
		const result = await handler({});

		expect(mockApp.vault.getFiles).toHaveBeenCalled();
		expect(result).toMatchInlineSnapshot(`
			"dir1/file3.md
			dir1/file4.md
			dir2/file5.md
			dir2/subdir/
			file1.md
			file2.md"
		`);
	});

	it("should throw an error when no files are found", async () => {
		mockApp.setFiles({});

		const handler = listFilesTool.handler(mockApp);

		await expect(handler({ path: "nonexistent" })).rejects.toThrow(
			"No files found in path: nonexistent"
		);
	});
});
