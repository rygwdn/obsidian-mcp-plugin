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

test.describe("TaskNotes Integration", () => {
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

	test("should include tasknotes tools when plugin is available", async () => {
		const result = await client.listTools();
		const toolNames = result.tools.map((t) => t.name);
		expect(toolNames).toContain("tasknotes_query");
		expect(toolNames).toContain("tasknotes_update");
		expect(toolNames).toContain("tasknotes_create");
	});

	test("should query all tasks", async () => {
		const result = await client.callTool({
			name: "tasknotes_query",
			arguments: {},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		// Should find tasks from the tasks folder
		expect(text).toMatch(/documentation|authentication|groceries/i);
	});

	test("should query incomplete tasks", async () => {
		const result = await client.callTool({
			name: "tasknotes_query",
			arguments: {
				status: "incomplete",
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		// Should find incomplete tasks
		expect(text).toMatch(/documentation|authentication/i);
		// Should not include completed tasks
		expect(text).not.toMatch(/groceries/i);
	});

	test("should query tasks by priority", async () => {
		const result = await client.callTool({
			name: "tasknotes_query",
			arguments: {
				priority: "high",
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		// Should find high priority task
		expect(text).toMatch(/documentation/i);
	});

	test("should query tasks by context", async () => {
		const result = await client.callTool({
			name: "tasknotes_query",
			arguments: {
				contexts: ["work"],
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		// Should find work-related tasks
		expect(text).toMatch(/documentation|authentication/i);
	});

	test("should query completed tasks", async () => {
		const result = await client.callTool({
			name: "tasknotes_query",
			arguments: {
				status: "completed",
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		// Should find completed task (groceries)
		expect(text).toMatch(/groceries/i);
	});

	test("should read tasknotes stats resource", async () => {
		const result = await client.readResource({
			uri: "tasknotes:///stats",
		});

		expect(result.contents).toBeInstanceOf(Array);
		const content = result.contents[0];
		if ("text" in content) {
			// Stats should include counts or status information
			expect(content.text).toBeDefined();
		}
	});

	test("should create a new task", async () => {
		const result = await client.callTool({
			name: "tasknotes_create",
			arguments: {
				title: "E2E Test Task",
				priority: "medium",
				status: "incomplete",
				contexts: ["testing"],
				tags: ["e2e", "automated"],
			},
		});

		expect(result.isError).toBeFalsy();
	});

	test("should find created task in query", async () => {
		// Query to find the task we just created
		const result = await client.callTool({
			name: "tasknotes_query",
			arguments: {
				contexts: ["testing"],
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		expect(text).toMatch(/e2e test task/i);
	});

	test("should update task status", async () => {
		// First query to get a task
		const queryResult = await client.callTool({
			name: "tasknotes_query",
			arguments: {
				contexts: ["testing"],
			},
		});

		expect(queryResult.isError).toBeFalsy();

		// Update the task (the exact update mechanism depends on the tool's API)
		const updateResult = await client.callTool({
			name: "tasknotes_update",
			arguments: {
				title: "E2E Test Task",
				status: "completed",
			},
		});

		expect(updateResult.isError).toBeFalsy();
	});

	test("should handle query with no matching tasks", async () => {
		const result = await client.callTool({
			name: "tasknotes_query",
			arguments: {
				contexts: ["nonexistent-context-12345"],
			},
		});

		// Should not error, just return empty or no results message
		expect(result.isError).toBeFalsy();
	});
});
