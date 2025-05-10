import { describe, it, expect, vi, beforeEach } from "vitest";
import { VaultFileResource } from "../tools/vault_file_resource";
import { MockApp } from "./mocks/obsidian";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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
			"readme.txt": "This is not a markdown file",
		});

		// Silence console.log during tests
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		vi.spyOn(console, "log").mockImplementation(() => {});

		resource = new VaultFileResource(mockApp);
	});

	describe("constructor", () => {
		it("should initialize with default prefix", () => {
			const resource = new VaultFileResource(mockApp);
			// Instead of checking properties directly, check the name
			expect(resource.template).toBeDefined();
			const resourceName = resource["resourceName"]; // Access private property
			expect(resourceName).toBe("vault-file");
		});

		it("should initialize with custom prefix", () => {
			const resource = new VaultFileResource(mockApp, "custom");
			// Instead of checking properties directly, check the name
			expect(resource.template).toBeDefined();
			const resourceName = resource["resourceName"]; // Access private property
			expect(resourceName).toBe("custom-file");
		});
	});

	describe("register", () => {
		it("should register the resource with the server", () => {
			const mockServer = {
				resource: vi.fn(),
			};

			resource.register(mockServer as unknown as McpServer);

			expect(mockServer.resource).toHaveBeenCalledWith(
				"vault-file",
				expect.any(Object),
				{ description: "Provides access to files in the Obsidian vault" },
				expect.any(Function)
			);
		});
	});

	describe("template", () => {
		it("should return a ResourceTemplate object", () => {
			const template = resource.template;
			expect(template).toBeDefined();
			// Check the object has the expected instance type
			expect(template.constructor.name).toContain("ResourceTemplate");
		});

		// These tests need to be modified since we can't directly access the private methods in ResourceTemplate
		// Instead, test the behavior through the public interface
		it("should use list method when initialized", () => {
			// Verify the resource is created correctly - we can't directly test .list()
			// since it's actually inside a ResourceTemplate
			const resource = new VaultFileResource(mockApp);
			expect(resource).toBeDefined();

			// Instead, test the list method directly since that's what the template would call
			const listResult = resource.list();
			expect(listResult.resources).toHaveLength(3);
		});

		it("should use completePath in template", () => {
			// Test the underlying method called by the template
			const result = resource.completePath("folder");
			expect(result).toContain("folder/test3.md");
		});
	});

	describe("list", () => {
		it("should return a list of markdown files as resources", () => {
			const result = resource.list();
			expect(result.resources).toHaveLength(3); // Only markdown files

			// Verify each resource has the correct properties
			result.resources.forEach((resource) => {
				expect(resource.name).toBeDefined();
				expect(resource.uri).toContain("vault-file:///");
				expect(resource.mimeType).toBe("text/markdown");
			});

			// Check that specific files are included
			const fileNames = result.resources.map((r) => r.name);
			expect(fileNames).toContain("test1.md");
			expect(fileNames).toContain("test2.md");
			expect(fileNames).toContain("folder/test3.md");
			expect(fileNames).not.toContain("readme.txt");
		});
	});

	describe("completePath", () => {
		it("should return paths that start with the given value", () => {
			const result = resource.completePath("test");
			expect(result).toContain("test1.md");
			expect(result).toContain("test2.md");
			expect(result).not.toContain("folder/test3.md"); // Doesn't start with 'test'
		});

		it("should return paths that start with folder path", () => {
			const result = resource.completePath("folder");
			expect(result).toContain("folder/test3.md");
			expect(result).not.toContain("test1.md");
		});

		it("should return empty array when no matches found", () => {
			const result = resource.completePath("nonexistent");
			expect(result).toHaveLength(0);
		});
	});

	describe("handler", () => {
		it("should return file contents for a valid path", async () => {
			const result = await resource.handler(new URL("vault-file:///test1.md"), {
				path: "test1.md",
			});

			expect(result.contents).toHaveLength(1);
			expect(result.contents[0].text).toBe("Test file 1 contents");
			expect(result.contents[0].uri).toBe("vault-file:///test1.md");
			expect(result.contents[0].mimeType).toBe("text/markdown");
		});

		it("should throw an error for non-existent files", async () => {
			await expect(
				resource.handler(new URL("vault-file:///non-existent.md"), { path: "non-existent.md" })
			).rejects.toThrow("File not found: non-existent.md");
		});

		it("should throw an error for invalid path type", async () => {
			await expect(
				resource.handler(new URL("vault-file:///test1.md"), { path: ["test1.md", "test2.md"] })
			).rejects.toThrow("Invalid path");
		});
	});
});
