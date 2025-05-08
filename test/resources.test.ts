import { describe, it, expect, vi, beforeEach } from "vitest";
import { VaultFileResource } from "../tools/resources";
import { MockApp } from "./mocks/obsidian";

describe("VaultFileResource", () => {
	let mockApp: MockApp;
	let resource: VaultFileResource;

	beforeEach(() => {
		vi.clearAllMocks();
		mockApp = new MockApp();

		// Set up files
		mockApp.setFiles({
			"test1.md": "Test file 1 contents",
			"test2.md": "Test file 2 contents",
			"folder/test3.md": "Test file 3 contents",
		});

		resource = new VaultFileResource(mockApp);
	});

	describe("handler", () => {
		it("should register a file as a resource", async () => {
			const result = await resource.handler(new URL("vault-file://test1.md"), { path: "test1.md" });

			expect(result).toMatchInlineSnapshot(`
				{
				  "contents": [
				    {
				      "mimeType": "text/markdown",
				      "text": "Test file 1 contents",
				      "uri": "vault-file://test1.md",
				    },
				  ],
				}
			`);
		});

		it("should register a file with a custom resource ID", async () => {
			const result = await resource.handler(new URL("vault-file://test1.md"), {
				path: "test1.md",
				resource_id: "custom-id",
			});

			expect(result).toMatchInlineSnapshot(`
				{
				  "contents": [
				    {
				      "mimeType": "text/markdown",
				      "text": "Test file 1 contents",
				      "uri": "vault-file://test1.md",
				    },
				  ],
				}
			`);
		});

		it("should throw an error for non-existent files", async () => {
			await expect(
				resource.handler(new URL("vault-file://non-existent.md"), { path: "non-existent.md" })
			).rejects.toThrow("File not found");
		});
	});
});
