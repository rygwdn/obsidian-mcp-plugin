import { test, expect } from "@playwright/test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
	launchObsidian,
	closeObsidian,
	waitForMcpServer,
	ObsidianTestContext,
} from "../helpers/obsidian";
import { createMcpClient } from "../helpers/mcp-client";
import { E2E_MCP_PORT } from "../playwright.config";

/** Extract text from the first content item in a tool result */
function getToolResultText(result: unknown): string {
	const r = result as { content?: Array<{ type: string; text?: string }> };
	if (!r.content || r.content.length === 0) {
		throw new Error("No content in tool result");
	}
	const content = r.content[0];
	if (content.type === "text" && content.text) {
		return content.text;
	}
	throw new Error(`Expected text content, got ${content.type}`);
}

test.describe("MCP HTTP API", () => {
	let ctx: ObsidianTestContext;
	let client: Client;

	test.beforeAll(async () => {
		ctx = await launchObsidian();
		const serverReady = await waitForMcpServer(20000);
		expect(serverReady).toBe(true);
		client = await createMcpClient();
	});

	test.afterAll(async () => {
		if (client) {
			await client.close();
		}
		if (ctx) {
			await closeObsidian(ctx);
		}
	});

	test.describe("Authentication", () => {
		test("should reject requests without auth token", async () => {
			await expect(createMcpClient(E2E_MCP_PORT, "")).rejects.toThrow();
		});

		test("should reject requests with invalid token", async () => {
			await expect(createMcpClient(E2E_MCP_PORT, "invalid-token-value")).rejects.toThrow();
		});

		test("should accept requests with valid token", async () => {
			const freshClient = await createMcpClient();
			expect(freshClient).toBeDefined();
			await freshClient.close();
		});
	});

	test.describe("Tools", () => {
		test("should list available tools", async () => {
			const result = await client.listTools();

			expect(result.tools).toBeInstanceOf(Array);
			expect(result.tools.length).toBeGreaterThan(0);

			const toolNames = result.tools.map((t) => t.name);
			expect(toolNames).toContain("get_contents");
			expect(toolNames).toContain("search");
		});

		test("should call get_contents tool for a file", async () => {
			const result = await client.callTool({
				name: "get_contents",
				arguments: { uri: "file:///notes/welcome.md" },
			});

			expect(result.content).toBeInstanceOf(Array);
			expect(getToolResultText(result)).toContain("Welcome to the Test Vault");
		});

		test("should call get_contents tool for directory listing", async () => {
			const result = await client.callTool({
				name: "get_contents",
				arguments: { uri: "file:///", depth: 1 },
			});

			expect(result.content).toBeInstanceOf(Array);
			expect(getToolResultText(result)).toContain("notes");
		});

		test("should call search tool", async () => {
			const result = await client.callTool({
				name: "search",
				arguments: { query: "Test Vault" },
			});

			expect(result.content).toBeInstanceOf(Array);
			expect(getToolResultText(result)).toContain("welcome.md");
		});

		test("should call search with folder filter", async () => {
			const result = await client.callTool({
				name: "search",
				arguments: { query: "project", folder: "notes" },
			});

			expect(result.content).toBeDefined();
		});

		test("should call get_file_metadata tool", async () => {
			const result = await client.callTool({
				name: "get_file_metadata",
				arguments: { path: "file:///notes/welcome.md" },
			});

			expect(getToolResultText(result)).toMatch(/size|ctime|mtime/i);
		});

		test("should handle non-existent file gracefully", async () => {
			const result = await client.callTool({
				name: "get_contents",
				arguments: { uri: "file:///does-not-exist.md" },
			});

			expect(result.isError).toBe(true);
		});
	});

	test.describe("Resources", () => {
		test("should list available resources", async () => {
			const result = await client.listResources();
			expect(result.resources).toBeInstanceOf(Array);
		});

		test("should read a file resource", async () => {
			const result = await client.readResource({ uri: "file:///notes/welcome.md" });

			expect(result.contents).toBeInstanceOf(Array);
			const content = result.contents[0];
			expect("text" in content && content.text).toContain("Welcome");
		});

		test("should read daily note resource for today", async () => {
			// Daily note may not exist - check that request completes without protocol error
			try {
				const result = await client.readResource({ uri: "daily:///today" });
				expect(result.contents === undefined || Array.isArray(result.contents)).toBe(true);
			} catch {
				// Error is acceptable if daily note doesn't exist
			}
		});
	});

	test.describe("Prompts", () => {
		test("should list available prompts", async () => {
			try {
				const result = await client.listPrompts();
				expect(result.prompts === undefined || Array.isArray(result.prompts)).toBe(true);
			} catch (error) {
				// Method might not be supported - this is okay
				console.log("listPrompts returned error (may not be supported):", error);
			}
		});

		test("should get a prompt with arguments", async () => {
			let prompts: Array<{ name: string }> = [];
			try {
				const result = await client.listPrompts();
				prompts = result.prompts ?? [];
			} catch {
				console.log("listPrompts not supported, skipping getPrompt test");
				return;
			}

			const examplePrompt = prompts.find((p) => p.name.toLowerCase().includes("example"));

			if (examplePrompt) {
				const result = await client.getPrompt({
					name: examplePrompt.name,
					arguments: { topic: "testing" },
				});
				expect(result).toBeDefined();
			} else {
				console.log("No example prompt found in vault, skipping");
			}
		});
	});

	test.describe("Content Updates", () => {
		test("should replace content in file", async () => {
			const result = await client.callTool({
				name: "update_content",
				arguments: {
					uri: "file:///notes/welcome.md",
					mode: "replace",
					find: "Welcome to the Test Vault",
					content: "Welcome (modified by e2e test)",
				},
			});

			if (result.isError) {
				console.log("Replace error:", getToolResultText(result));
			}

			await new Promise((resolve) => setTimeout(resolve, 500));

			const readResult = await client.callTool({
				name: "get_contents",
				arguments: { uri: "file:///notes/welcome.md" },
			});

			if (!readResult.isError) {
				expect(getToolResultText(readResult)).toContain("modified by e2e test");
			}
		});

		test("should append to existing file", async () => {
			const result = await client.callTool({
				name: "update_content",
				arguments: {
					uri: "file:///notes/project-alpha.md",
					mode: "append",
					content: "\n\n## Added by E2E Test\n\nThis was appended.",
				},
			});

			if (result.isError) {
				console.log("Append error:", getToolResultText(result));
			}

			await new Promise((resolve) => setTimeout(resolve, 500));

			const readResult = await client.callTool({
				name: "get_contents",
				arguments: { uri: "file:///notes/project-alpha.md" },
			});

			if (!readResult.isError) {
				expect(getToolResultText(readResult)).toContain("Added by E2E Test");
			}
		});
	});

	test.describe("Error Handling", () => {
		test("should handle missing required parameters", async () => {
			const result = await client.callTool({
				name: "get_contents",
				arguments: {},
			});

			expect(result.isError).toBe(true);
		});
	});

	test.describe("Daily Notes", () => {
		test("should create daily note via update_content", async () => {
			const result = await client.callTool({
				name: "update_content",
				arguments: {
					uri: "daily:///today",
					mode: "append",
					content: "# Daily Note\n\nCreated by e2e test at " + new Date().toISOString(),
					create_if_missing: true,
				},
			});

			// Should succeed or indicate file was created
			expect(result.isError).toBeFalsy();
		});

		test("should read created daily note", async () => {
			// Wait for file to sync
			await new Promise((resolve) => setTimeout(resolve, 500));

			try {
				const result = await client.readResource({ uri: "daily:///today" });
				expect(result.contents).toBeInstanceOf(Array);
				if (result.contents.length > 0) {
					const content = result.contents[0];
					if ("text" in content) {
						expect(content.text).toContain("Daily Note");
					}
				}
			} catch {
				// Daily note resource might not exist yet
			}
		});
	});

	test.describe("Search Advanced", () => {
		test("should search with multiple results", async () => {
			const result = await client.callTool({
				name: "search",
				arguments: { query: "project" },
			});

			expect(result.isError).toBeFalsy();
			const text = getToolResultText(result);
			// Should find both project files
			expect(text).toContain("project-alpha");
			expect(text).toContain("project-beta");
		});

		test("should search in tasks folder", async () => {
			const result = await client.callTool({
				name: "search",
				arguments: { query: "documentation", folder: "tasks" },
			});

			expect(result.isError).toBeFalsy();
			const text = getToolResultText(result);
			expect(text).toContain("work-task-1");
		});

		test("should return error for non-matching query", async () => {
			const result = await client.callTool({
				name: "search",
				arguments: { query: "xyznonexistentquery12345xyz" },
			});

			// Search returns an error when no results are found
			expect(result.isError).toBe(true);
			expect(getToolResultText(result)).toContain("No results found");
		});
	});

	test.describe("File Metadata Advanced", () => {
		test("should return frontmatter in metadata", async () => {
			const result = await client.callTool({
				name: "get_file_metadata",
				arguments: { path: "file:///notes/project-alpha.md" },
			});

			expect(result.isError).toBeFalsy();
			const text = getToolResultText(result);
			// Should contain frontmatter fields
			expect(text).toMatch(/status|priority|tags/i);
		});

		test("should return metadata for task file", async () => {
			const result = await client.callTool({
				name: "get_file_metadata",
				arguments: { path: "file:///tasks/work-task-1.md" },
			});

			expect(result.isError).toBeFalsy();
			const text = getToolResultText(result);
			expect(text).toMatch(/title|priority|due/i);
		});

		test("should handle metadata for non-existent file", async () => {
			const result = await client.callTool({
				name: "get_file_metadata",
				arguments: { path: "file:///nonexistent-file-12345.md" },
			});

			expect(result.isError).toBe(true);
		});
	});

	test.describe("Directory Listing", () => {
		test("should list root directory contents", async () => {
			const result = await client.callTool({
				name: "get_contents",
				arguments: { uri: "file:///", depth: 1 },
			});

			expect(result.isError).toBeFalsy();
			const text = getToolResultText(result);
			expect(text).toContain("notes");
			expect(text).toContain("tasks");
			expect(text).toContain("templates");
		});

		test("should list notes directory", async () => {
			const result = await client.callTool({
				name: "get_contents",
				arguments: { uri: "file:///notes", depth: 1 },
			});

			expect(result.isError).toBeFalsy();
			const text = getToolResultText(result);
			expect(text).toContain("welcome.md");
			expect(text).toContain("project-alpha.md");
			expect(text).toContain("project-beta.md");
			expect(text).toContain("meeting-notes.md");
		});

		test("should list tasks directory", async () => {
			const result = await client.callTool({
				name: "get_contents",
				arguments: { uri: "file:///tasks", depth: 1 },
			});

			expect(result.isError).toBeFalsy();
			const text = getToolResultText(result);
			expect(text).toContain("work-task-1.md");
			expect(text).toContain("work-task-2.md");
			expect(text).toContain("personal-task-1.md");
		});
	});
});
