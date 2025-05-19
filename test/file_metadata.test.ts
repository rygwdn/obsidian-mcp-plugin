import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	generateFileMetadata,
	getFileMetadataTool,
	FileMetadataResource,
} from "../tools/file_metadata";
import { MockObsidian } from "./mock_obsidian";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("file_metadata tool annotations", () => {
	it("should have the correct annotations for the tool", () => {
		expect(getFileMetadataTool.annotations).toEqual({
			title: "Get File Metadata",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		});
	});
});

describe("File metadata functionality", () => {
	let obsidian: MockObsidian;

	beforeEach(() => {
		// Setup fake timers and set a fixed date
		vi.useFakeTimers();
		vi.setSystemTime("2025-02-02");

		vi.clearAllMocks();
		obsidian = new MockObsidian();

		// Add test files
		obsidian.setFiles({
			"simple.md": "# Simple File\nBasic content with no frontmatter.",
			"with-frontmatter.md":
				"---\ntitle: Test Document\ntags: ['test', 'metadata']\ncreated: 2023-05-09\n---\n\n# Document with Frontmatter\nThis document has YAML frontmatter.",
			"with-tags.md": "# Document with Tags\nContent with #inline-tag and #another-tag.",
			"with-headings.md":
				"# Top Level Heading\n## Second Level\n### Third Level\nContent with multiple heading levels.",
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("generateFileMetadata function", () => {
		it("should return basic metadata for a simple file", async () => {
			const result = await generateFileMetadata(obsidian, "simple.md");

			expect(result).toMatchInlineSnapshot(`
				"# File Metadata: simple.md

				- **path**: simple.md
				- **size**: 48 bytes
				- **created**: 2025-01-01T00:00:00.000Z
				- **modified**: 2025-02-01T00:00:00.000Z

				## Headings

				- (offset: 0, line: 0): # Simple File"
			`);
		});

		it("should include frontmatter and tags in metadata", async () => {
			const result = await generateFileMetadata(obsidian, "with-frontmatter.md");

			expect(result).toMatchInlineSnapshot(`
				"# File Metadata: with-frontmatter.md

				- **path**: with-frontmatter.md
				- **size**: 140 bytes
				- **created**: 2025-01-01T00:00:00.000Z
				- **modified**: 2025-02-01T00:00:00.000Z

				## Frontmatter

				- **title**: Test Document
				- **tags**: test,metadata
				- **created**: 2023-05-09

				## Tags

				- test
				- metadata

				## Headings

				- (offset: 77, line: 0): # Document with Frontmatter"
			`);
		});

		it("should include headings with proper formatting", async () => {
			const result = await generateFileMetadata(obsidian, "with-headings.md");

			expect(result).toMatchInlineSnapshot(`
				"# File Metadata: with-headings.md

				- **path**: with-headings.md
				- **size**: 89 bytes
				- **created**: 2025-01-01T00:00:00.000Z
				- **modified**: 2025-02-01T00:00:00.000Z

				## Headings

				- (offset: 0, line: 0): # Top Level Heading
				- (offset: 20, line: 1): ## Second Level
				- (offset: 36, line: 2): ### Third Level"
			`);
		});

		it("should throw an error for a non-existent file", async () => {
			await expect(generateFileMetadata(obsidian, "nonexistent.md")).rejects.toThrow(
				"File not found: nonexistent.md"
			);
		});
	});

	describe("getFileMetadataTool", () => {
		it("should have the correct name and description", () => {
			expect(getFileMetadataTool.name).toBe("get_file_metadata");
			expect(getFileMetadataTool.description).toMatchInlineSnapshot(
				'"Retrieve metadata for a specified file"'
			);
			expect(getFileMetadataTool.schema).toHaveProperty("path");
		});

		it("should return metadata for an existing file", async () => {
			const handler = getFileMetadataTool.handler(obsidian);
			const result = await handler({ path: "file:///with-frontmatter.md" });

			expect(result).toMatchInlineSnapshot(`
				"# File Metadata: with-frontmatter.md

				- **path**: with-frontmatter.md
				- **size**: 140 bytes
				- **created**: 2025-01-01T00:00:00.000Z
				- **modified**: 2025-02-01T00:00:00.000Z

				## Frontmatter

				- **title**: Test Document
				- **tags**: test,metadata
				- **created**: 2023-05-09

				## Tags

				- test
				- metadata

				## Headings

				- (offset: 77, line: 0): # Document with Frontmatter"
			`);
		});

		it("should throw an error for a non-existent file", async () => {
			const handler = getFileMetadataTool.handler(obsidian);

			await expect(handler({ path: "file:///nonexistent.md" })).rejects.toThrow(
				"File not found: nonexistent.md"
			);
		});
	});

	describe("FileMetadataResource", () => {
		let resource: FileMetadataResource;

		beforeEach(() => {
			resource = new FileMetadataResource(obsidian);
		});

		describe("constructor", () => {
			it("should initialize correctly", () => {
				const resource = new FileMetadataResource(obsidian);
				expect(resource.template).toBeDefined();
			});
		});

		describe("register", () => {
			it("should register the resource with the server", () => {
				const mockServer = {
					resource: vi.fn(),
				};

				resource.register(mockServer as unknown as McpServer);

				expect(mockServer.resource).toHaveBeenCalledWith(
					"metadata",
					expect.any(Object),
					{ description: "Provides access to file metadata in the Obsidian vault" },
					expect.any(Function)
				);
			});
		});

		describe("list", () => {
			it("should return a list of all markdown files", () => {
				const result = resource.list();

				expect(result.resources).toHaveLength(4); // Based on our test setup
				expect(result.resources[0]).toHaveProperty("uri");
				expect(result.resources[0]).toHaveProperty("name");
				expect(result.resources[0]).toHaveProperty("mimeType", "text/markdown");

				// Verify at least one of our test files is included
				const paths = result.resources.map((r) => r.name);
				expect(paths).toContain("simple.md");
				expect(paths).toContain("with-frontmatter.md");
			});
		});

		describe("completePath", () => {
			it("should filter paths starting with the given prefix", () => {
				const result = resource.completePath("with-");

				expect(result).toContain("with-frontmatter.md");
				expect(result).toContain("with-tags.md");
				expect(result).toContain("with-headings.md");
				expect(result).not.toContain("simple.md");
			});
		});

		describe("handler", () => {
			it("should return metadata for a valid file", async () => {
				const result = await resource.handler(new URL("metadata:///with-frontmatter.md"), {
					path: "with-frontmatter.md",
				});

				expect(result.contents).toHaveLength(1);
				expect(result.contents[0].uri).toBe("metadata:///with-frontmatter.md");
				expect(result.contents[0].mimeType).toBe("text/markdown");

				expect(result.contents[0].text).toMatchInlineSnapshot(`
					"# File Metadata: with-frontmatter.md

					- **path**: with-frontmatter.md
					- **size**: 140 bytes
					- **created**: 2025-01-01T00:00:00.000Z
					- **modified**: 2025-02-01T00:00:00.000Z

					## Frontmatter

					- **title**: Test Document
					- **tags**: test,metadata
					- **created**: 2023-05-09

					## Tags

					- test
					- metadata

					## Headings

					- (offset: 77, line: 0): # Document with Frontmatter"
				`);
			});

			it("should throw an error for an invalid path format", async () => {
				await expect(
					resource.handler(new URL("metadata:///path"), {
						path: ["invalid", "array"] as unknown as string,
					})
				).rejects.toThrow("Invalid path:");
			});

			it("should throw an error for a non-existent file", async () => {
				await expect(
					resource.handler(new URL("metadata:///nonexistent.md"), { path: "nonexistent.md" })
				).rejects.toThrow("File not found: nonexistent.md");
			});
		});
	});
});
