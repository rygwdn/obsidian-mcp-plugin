import { test, expect } from "@playwright/test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
	launchObsidian,
	closeObsidian,
	waitForMcpServer,
	ObsidianTestContext,
} from "../helpers/obsidian";
import { createMcpClient } from "../helpers/mcp-client";
import {
	E2E_MCP_PORT,
	E2E_FULL_ACCESS_TOKEN,
	E2E_READ_ONLY_TOKEN,
	E2E_NO_INTEGRATIONS_TOKEN,
} from "../playwright.config";

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

test.describe("Integration Toggles", () => {
	let ctx: ObsidianTestContext;

	test.beforeAll(async () => {
		ctx = await launchObsidian();
		const serverReady = await waitForMcpServer(20000);
		expect(serverReady).toBe(true);
	});

	test.afterAll(async () => {
		if (ctx) {
			await closeObsidian(ctx);
		}
	});

	test.describe("Full Access Token", () => {
		let client: Client;

		test.beforeAll(async () => {
			client = await createMcpClient(E2E_MCP_PORT, E2E_FULL_ACCESS_TOKEN);
		});

		test.afterAll(async () => {
			if (client) {
				await client.close();
			}
		});

		test("should have all tools available", async () => {
			const result = await client.listTools();

			expect(result.tools).toBeInstanceOf(Array);
			const toolNames = result.tools.map((t) => t.name);

			// Core tools
			expect(toolNames).toContain("get_contents");
			expect(toolNames).toContain("search");
			expect(toolNames).toContain("update_content");

			// Integration tools
			expect(toolNames).toContain("dataview_query");
			expect(toolNames).toContain("quickadd_list");
			expect(toolNames).toContain("quickadd_execute");
			expect(toolNames).toContain("tasknotes_query");
			expect(toolNames).toContain("tasknotes");
		});

		test("should be able to call update_content", async () => {
			const result = await client.callTool({
				name: "update_content",
				arguments: {
					uri: "file:///notes/project-alpha.md",
					mode: "append",
					content: "\n\n## Integration Test\n\nThis was added by integration test.",
				},
			});

			expect(result.isError).toBeFalsy();
		});

		test("should be able to call dataview_query", async () => {
			const result = await client.callTool({
				name: "dataview_query",
				arguments: {
					query: 'LIST FROM "tasks" WHERE title',
					type: "dql",
				},
			});

			expect(result.isError).toBeFalsy();
		});
	});

	test.describe("Read Only Token", () => {
		let client: Client;

		test.beforeAll(async () => {
			client = await createMcpClient(E2E_MCP_PORT, E2E_READ_ONLY_TOKEN);
		});

		test.afterAll(async () => {
			if (client) {
				await client.close();
			}
		});

		test("should NOT have update_content tool", async () => {
			const result = await client.listTools();

			expect(result.tools).toBeInstanceOf(Array);
			const toolNames = result.tools.map((t) => t.name);

			expect(toolNames).toContain("get_contents");
			expect(toolNames).toContain("search");
			expect(toolNames).not.toContain("update_content");
		});

		test("should NOT have quickadd tools", async () => {
			const result = await client.listTools();

			const toolNames = result.tools.map((t) => t.name);
			expect(toolNames).not.toContain("quickadd_list");
			expect(toolNames).not.toContain("quickadd_execute");
		});

		test("should NOT have tasknotes_query tool", async () => {
			const result = await client.listTools();

			const toolNames = result.tools.map((t) => t.name);
			expect(toolNames).not.toContain("tasknotes_query");
		});

		test("should have dataview_query tool", async () => {
			const result = await client.listTools();

			const toolNames = result.tools.map((t) => t.name);
			expect(toolNames).toContain("dataview_query");
		});

		test("should fail when calling disabled update_content tool", async () => {
			const result = await client.callTool({
				name: "update_content",
				arguments: {
					uri: "file:///notes/welcome.md",
					mode: "append",
					content: "Test content",
				},
			});

			expect(result.isError).toBe(true);
			expect(getToolResultText(result)).toMatch(/not found|unknown/i);
		});
	});

	test.describe("No Integrations Token", () => {
		let client: Client;

		test.beforeAll(async () => {
			client = await createMcpClient(E2E_MCP_PORT, E2E_NO_INTEGRATIONS_TOKEN);
		});

		test.afterAll(async () => {
			if (client) {
				await client.close();
			}
		});

		test("should NOT have dataview_query tool", async () => {
			const result = await client.listTools();

			expect(result.tools).toBeInstanceOf(Array);
			const toolNames = result.tools.map((t) => t.name);

			expect(toolNames).not.toContain("dataview_query");
		});

		test("should NOT have quickadd tools", async () => {
			const result = await client.listTools();

			const toolNames = result.tools.map((t) => t.name);
			expect(toolNames).not.toContain("quickadd_list");
			expect(toolNames).not.toContain("quickadd_execute");
		});

		test("should NOT have tasknotes_query tool", async () => {
			const result = await client.listTools();

			const toolNames = result.tools.map((t) => t.name);
			expect(toolNames).not.toContain("tasknotes_query");
		});

		test("should have core tools available", async () => {
			const result = await client.listTools();

			const toolNames = result.tools.map((t) => t.name);
			expect(toolNames).toContain("get_contents");
			expect(toolNames).toContain("search");
			expect(toolNames).toContain("update_content");
		});

		test("should fail when calling disabled dataview_query tool", async () => {
			const result = await client.callTool({
				name: "dataview_query",
				arguments: {
					query: 'LIST FROM "tasks"',
					type: "dql",
				},
			});

			expect(result.isError).toBe(true);
			expect(getToolResultText(result)).toMatch(/not found|unknown/i);
		});

		test("should fail when calling disabled quickadd_list tool", async () => {
			const result = await client.callTool({
				name: "quickadd_list",
				arguments: {},
			});

			expect(result.isError).toBe(true);
			expect(getToolResultText(result)).toMatch(/not found|unknown/i);
		});

		test("should fail when calling disabled tasknotes_query tool", async () => {
			const result = await client.callTool({
				name: "tasknotes_query",
				arguments: {
					query: "status:pending",
				},
			});

			expect(result.isError).toBe(true);
			expect(getToolResultText(result)).toMatch(/not found|unknown/i);
		});
	});
});
