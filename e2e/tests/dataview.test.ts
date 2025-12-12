import { test, expect } from "@playwright/test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
	launchObsidian,
	closeObsidian,
	waitForMcpServer,
	ObsidianTestContext,
} from "../helpers/obsidian";
import { createMcpClient } from "../helpers/mcp-client";

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

test.describe("Dataview Integration", () => {
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

	test("should include dataview_query tool when plugin is available", async () => {
		const result = await client.listTools();
		const toolNames = result.tools.map((t) => t.name);
		expect(toolNames).toContain("dataview_query");
	});

	test("should execute LIST query for tagged notes", async () => {
		const result = await client.callTool({
			name: "dataview_query",
			arguments: {
				query: "LIST FROM #project",
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		// Should find both project-alpha and project-beta
		expect(text).toContain("project-alpha");
		expect(text).toContain("project-beta");
	});

	test("should execute LIST query with WHERE clause", async () => {
		const result = await client.callTool({
			name: "dataview_query",
			arguments: {
				query: 'LIST FROM #project WHERE status = "in-progress"',
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		// Should only find project-alpha (in-progress), not project-beta (completed)
		expect(text).toContain("project-alpha");
		expect(text).not.toContain("project-beta");
	});

	test("should execute TABLE query with fields", async () => {
		const result = await client.callTool({
			name: "dataview_query",
			arguments: {
				query: "TABLE status, priority, assignee FROM #project",
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		// Should contain field values from frontmatter
		expect(text).toContain("in-progress");
		expect(text).toContain("high");
		expect(text).toContain("Alice");
	});

	test("should execute TASK query", async () => {
		const result = await client.callTool({
			name: "dataview_query",
			arguments: {
				query: 'TASK FROM "notes/project-alpha"',
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		// Should find tasks from project-alpha.md
		expect(text).toMatch(/complete initial setup|write documentation|run tests/i);
	});

	test("should handle query with no results", async () => {
		const result = await client.callTool({
			name: "dataview_query",
			arguments: {
				query: "LIST FROM #nonexistent-tag-12345",
			},
		});

		// Should not error, just return empty results
		expect(result.isError).toBeFalsy();
	});

	test("should handle invalid query syntax gracefully", async () => {
		const result = await client.callTool({
			name: "dataview_query",
			arguments: {
				query: "THIS IS NOT VALID DATAVIEW SYNTAX!!!",
			},
		});

		// Should return an error
		expect(result.isError).toBe(true);
	});

	test("should query notes by folder", async () => {
		const result = await client.callTool({
			name: "dataview_query",
			arguments: {
				query: 'LIST FROM "notes"',
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		expect(text).toContain("welcome");
		expect(text).toContain("project-alpha");
	});

	test("should query with complex WHERE conditions", async () => {
		const result = await client.callTool({
			name: "dataview_query",
			arguments: {
				query: 'LIST FROM #project WHERE priority = "high" AND status != "completed"',
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		expect(text).toContain("project-alpha");
		expect(text).not.toContain("project-beta");
	});
});
