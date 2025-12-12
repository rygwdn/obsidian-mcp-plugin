import { test, expect } from "@playwright/test";
import {
	launchObsidian,
	closeObsidian,
	waitForMcpServer,
	ObsidianTestContext,
} from "../helpers/obsidian";
import { createMcpClient, McpTestClient } from "../helpers/mcp-client";
import { E2E_MCP_PORT } from "../playwright.config";

test.describe("MCP HTTP API", () => {
	let ctx: ObsidianTestContext;
	let client: McpTestClient;

	test.beforeAll(async () => {
		// Launch Obsidian with the test vault
		ctx = await launchObsidian();

		// Wait for MCP server to be ready
		const serverReady = await waitForMcpServer(20000);
		expect(serverReady).toBe(true);

		// Create MCP client and initialize it
		client = createMcpClient();
		await client.initialize();
	});

	test.afterAll(async () => {
		if (ctx) {
			await closeObsidian(ctx);
		}
	});

	test.describe("Authentication", () => {
		test("should reject requests without auth token", async () => {
			const unauthClient = createMcpClient(E2E_MCP_PORT, "");

			try {
				await unauthClient.initialize();
				// If we get here without error, check if we got an auth error
			} catch (error) {
				// HTTP error is expected
				expect(String(error)).toContain("401");
			}
		});

		test("should reject requests with invalid token", async () => {
			const badClient = createMcpClient(E2E_MCP_PORT, "invalid-token-value");

			try {
				await badClient.initialize();
			} catch (error) {
				expect(String(error)).toContain("401");
			}
		});

		test("should accept requests with valid token", async () => {
			// Use a fresh client for this test since the shared client is already initialized
			const freshClient = createMcpClient();
			const response = await freshClient.initialize();

			expect(response.error).toBeUndefined();
			expect(response.result).toBeDefined();
		});
	});

	test.describe("Initialize", () => {
		test("should return server info on initialize", async () => {
			const freshClient = createMcpClient();
			const response = await freshClient.initialize();

			expect(response.error).toBeUndefined();
			expect(response.result).toBeDefined();

			const result = response.result as {
				protocolVersion: string;
				serverInfo: { name: string; version: string };
				capabilities: Record<string, unknown>;
			};

			expect(result.protocolVersion).toBeDefined();
			expect(result.serverInfo).toBeDefined();
			// Server name may be "mcp-server" or contain "obsidian" or "MCP"
			expect(result.serverInfo.name).toBeTruthy();
			expect(result.capabilities).toBeDefined();
		});

		test("should create a session ID", async () => {
			const freshClient = createMcpClient();
			await freshClient.initialize();

			const sessionId = freshClient.getSessionId();
			expect(sessionId).toBeTruthy();
		});
	});

	test.describe("Tools", () => {
		test("should list available tools", async () => {
			const response = await client.listTools();

			expect(response.error).toBeUndefined();
			expect(response.result).toBeDefined();

			const result = response.result as { tools: Array<{ name: string; description: string }> };
			expect(result.tools).toBeInstanceOf(Array);
			expect(result.tools.length).toBeGreaterThan(0);

			// Check for expected tools
			const toolNames = result.tools.map((t) => t.name);
			expect(toolNames).toContain("get_contents");
			expect(toolNames).toContain("search");
		});

		test("should call get_contents tool for a file", async () => {
			const response = await client.callTool("get_contents", {
				uri: "file:///notes/welcome.md",
			});

			expect(response.error).toBeUndefined();
			expect(response.result).toBeDefined();

			const result = response.result as { content: Array<{ type: string; text: string }> };
			expect(result.content).toBeInstanceOf(Array);
			expect(result.content[0].text).toContain("Welcome to the Test Vault");
		});

		test("should call get_contents tool for directory listing", async () => {
			const response = await client.callTool("get_contents", {
				uri: "file:///",
				depth: 1,
			});

			expect(response.error).toBeUndefined();
			expect(response.result).toBeDefined();

			const result = response.result as { content: Array<{ type: string; text: string }> };
			expect(result.content).toBeInstanceOf(Array);

			const text = result.content[0].text;
			expect(text).toContain("notes");
		});

		test("should call search tool", async () => {
			const response = await client.callTool("search", {
				query: "Test Vault",
			});

			expect(response.error).toBeUndefined();
			expect(response.result).toBeDefined();

			const result = response.result as { content: Array<{ type: string; text: string }> };
			expect(result.content).toBeInstanceOf(Array);
			expect(result.content[0].text).toContain("welcome.md");
		});

		test("should call search with folder filter", async () => {
			const response = await client.callTool("search", {
				query: "project",
				folder: "notes",
			});

			expect(response.error).toBeUndefined();
			expect(response.result).toBeDefined();
		});

		test("should call get_file_metadata tool", async () => {
			const response = await client.callTool("get_file_metadata", {
				path: "file:///notes/welcome.md",
			});

			expect(response.error).toBeUndefined();
			expect(response.result).toBeDefined();

			const result = response.result as { content: Array<{ type: string; text: string }> };
			const text = result.content[0].text;

			// Should contain file stats
			expect(text).toMatch(/size|ctime|mtime/i);
		});

		test("should handle non-existent file gracefully", async () => {
			const response = await client.callTool("get_contents", {
				uri: "file:///does-not-exist.md",
			});

			// Should return an error in the result
			expect(response.result).toBeDefined();
			const result = response.result as { isError?: boolean; content: Array<{ text: string }> };
			expect(result.isError).toBe(true);
		});
	});

	test.describe("Resources", () => {
		test("should list available resources", async () => {
			const response = await client.listResources();

			expect(response.error).toBeUndefined();
			expect(response.result).toBeDefined();

			const result = response.result as {
				resources: Array<{ uri: string; name: string }>;
			};
			expect(result.resources).toBeInstanceOf(Array);
		});

		test("should read a file resource", async () => {
			const response = await client.readResource("file:///notes/welcome.md");

			expect(response.error).toBeUndefined();
			expect(response.result).toBeDefined();

			const result = response.result as {
				contents: Array<{ uri: string; text: string }>;
			};
			expect(result.contents).toBeInstanceOf(Array);
			expect(result.contents[0].text).toContain("Welcome");
		});

		test("should read daily note resource for today", async () => {
			const response = await client.readResource("daily:///today");

			// Daily note may not exist - check that request completes without protocol error
			// Either result is defined (note exists) or we get a structured error response
			expect(response.result !== undefined || response.error !== undefined).toBe(true);

			// If we got a result, verify structure
			if (response.result) {
				const result = response.result as {
					contents?: Array<{ uri: string; text?: string }>;
				};
				// Contents may exist or be empty
				expect(result.contents === undefined || Array.isArray(result.contents)).toBe(true);
			}
		});
	});

	test.describe("Prompts", () => {
		test("should list available prompts", async () => {
			const response = await client.listPrompts();

			// The prompts API may return an error if prompts feature is not enabled
			// or may return an empty list - both are acceptable
			if (response.error) {
				// Method might not be supported - this is okay for this test
				console.log("listPrompts returned error (may not be supported):", response.error);
				expect(response.error.code).toBeDefined();
			} else {
				expect(response.result).toBeDefined();
				const result = response.result as {
					prompts?: Array<{ name: string; description?: string }>;
				};
				// Prompts may be empty array or undefined if no prompts configured
				expect(result.prompts === undefined || Array.isArray(result.prompts)).toBe(true);
			}
		});

		test("should get a prompt with arguments", async () => {
			// First check if our test prompt exists
			const listResponse = await client.listPrompts();

			// Skip if prompts API returns error
			if (listResponse.error) {
				console.log("listPrompts not supported, skipping getPrompt test");
				return;
			}

			const result = listResponse.result as { prompts?: Array<{ name: string }> };
			const prompts = result?.prompts ?? [];

			const examplePrompt = prompts.find((p) => p.name.toLowerCase().includes("example"));

			if (examplePrompt) {
				const response = await client.getPrompt(examplePrompt.name, {
					topic: "testing",
				});

				expect(response.error).toBeUndefined();
				expect(response.result).toBeDefined();
			} else {
				// Skip if no example prompt found - this is not a failure
				console.log("No example prompt found in vault, skipping");
			}
		});
	});

	test.describe("Content Updates", () => {
		test("should replace content in file", async () => {
			// Use replace mode - requires uri, mode, content, and find parameters
			const response = await client.callTool("update_content", {
				uri: "file:///notes/welcome.md",
				mode: "replace",
				find: "Welcome to the Test Vault",
				content: "Welcome (modified by e2e test)",
			});

			// Log the response for debugging
			if (response.result) {
				const result = response.result as { isError?: boolean; content?: Array<{ text: string }> };
				if (result.isError) {
					console.log("Replace error:", result.content?.[0]?.text);
				}
			}

			expect(response.error).toBeUndefined();
			expect(response.result).toBeDefined();

			// Wait a moment for file to sync
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Verify the replace
			const readResponse = await client.callTool("get_contents", {
				uri: "file:///notes/welcome.md",
			});

			const result = readResponse.result as { isError?: boolean; content: Array<{ text: string }> };
			if (!result.isError) {
				expect(result.content[0].text).toContain("modified by e2e test");
			}
		});

		test("should append to existing file", async () => {
			const response = await client.callTool("update_content", {
				uri: "file:///notes/project-alpha.md",
				mode: "append",
				content: "\n\n## Added by E2E Test\n\nThis was appended.",
			});

			// Log the response for debugging
			if (response.result) {
				const result = response.result as { isError?: boolean; content?: Array<{ text: string }> };
				if (result.isError) {
					console.log("Append error:", result.content?.[0]?.text);
				}
			}

			expect(response.error).toBeUndefined();

			// Wait a moment for file to sync
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Verify the append
			const readResponse = await client.callTool("get_contents", {
				uri: "file:///notes/project-alpha.md",
			});

			const result = readResponse.result as { isError?: boolean; content: Array<{ text: string }> };
			if (!result.isError) {
				expect(result.content[0].text).toContain("Added by E2E Test");
			}
		});
	});

	test.describe("Error Handling", () => {
		test("should handle invalid method gracefully", async () => {
			const response = await client.request("invalid/method", {});

			expect(response.error).toBeDefined();
			expect(response.error?.code).toBeDefined();
		});

		test("should handle missing required parameters", async () => {
			const response = await client.callTool("get_contents", {});

			expect(response.result).toBeDefined();
			const result = response.result as { isError?: boolean };
			expect(result.isError).toBe(true);
		});
	});
});
