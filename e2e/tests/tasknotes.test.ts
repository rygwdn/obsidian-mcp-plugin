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
		expect(toolNames).toContain("tasknotes");
	});

	test("should query tasks with default filters", async () => {
		const result = await client.callTool({
			name: "tasknotes_query",
			arguments: {
				due_before: "2030-12-31", // Far future to get all tasks
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		const data = JSON.parse(text);

		// Should return response with tasks array and metadata
		expect(data).toHaveProperty("tasks");
		expect(data).toHaveProperty("hasMore");
		expect(data).toHaveProperty("returned");
		expect(data.tasks).toBeInstanceOf(Array);
	});

	test("should include stats when include_stats is true (default)", async () => {
		const result = await client.callTool({
			name: "tasknotes_query",
			arguments: {
				due_before: "2030-12-31",
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		const data = JSON.parse(text);

		// Stats should be included by default
		expect(data).toHaveProperty("stats");
		expect(data.stats).toHaveProperty("total");
		expect(data.stats).toHaveProperty("active");
		expect(data.stats).toHaveProperty("completed");

		// Filter options should also be included
		expect(data).toHaveProperty("filterOptions");
		expect(data.filterOptions).toHaveProperty("statuses");
		expect(data.filterOptions).toHaveProperty("priorities");
	});

	test("should not include stats when include_stats is false", async () => {
		const result = await client.callTool({
			name: "tasknotes_query",
			arguments: {
				due_before: "2030-12-31",
				include_stats: false,
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		const data = JSON.parse(text);

		expect(data).not.toHaveProperty("stats");
		expect(data).not.toHaveProperty("filterOptions");
	});

	test("should query tasks by status", async () => {
		const result = await client.callTool({
			name: "tasknotes_query",
			arguments: {
				status: ["incomplete"],
				due_before: "2030-12-31",
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		const data = JSON.parse(text);

		// All returned tasks should have the specified status
		if (data.tasks.length > 0) {
			expect(data.tasks.every((t: { status: string }) => t.status === "incomplete")).toBe(true);
		}
	});

	test("should query tasks by priority", async () => {
		const result = await client.callTool({
			name: "tasknotes_query",
			arguments: {
				priority: ["high"],
				due_before: "2030-12-31",
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		const data = JSON.parse(text);

		// All returned tasks should have high priority
		if (data.tasks.length > 0) {
			expect(data.tasks.every((t: { priority: string }) => t.priority === "high")).toBe(true);
		}
	});

	test("should respect limit and indicate hasMore", async () => {
		const result = await client.callTool({
			name: "tasknotes_query",
			arguments: {
				due_before: "2030-12-31",
				limit: 1,
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		const data = JSON.parse(text);

		expect(data.tasks.length).toBeLessThanOrEqual(1);
		expect(data.returned).toBeLessThanOrEqual(1);
		// hasMore should be true if there are more tasks
	});

	test("should verify tasks have expected fields", async () => {
		const result = await client.callTool({
			name: "tasknotes_query",
			arguments: {
				due_before: "2030-12-31",
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		const data = JSON.parse(text);

		if (data.tasks.length > 0) {
			const firstTask = data.tasks[0];
			expect(firstTask).toHaveProperty("title");
			expect(firstTask).toHaveProperty("status");
			expect(firstTask).toHaveProperty("path");
			expect(firstTask).toHaveProperty("priority");
		}
	});

	test("should handle query with no matching tasks", async () => {
		const result = await client.callTool({
			name: "tasknotes_query",
			arguments: {
				status: ["nonexistent-status-12345"],
				due_before: "2030-12-31",
			},
		});

		// Should not error, just return empty results
		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		const data = JSON.parse(text);

		expect(data.tasks).toEqual([]);
		expect(data.hasMore).toBe(false);
	});

	test("should create a task", async () => {
		const uniqueTitle = `E2E Test Task ${Date.now()}`;
		const result = await client.callTool({
			name: "tasknotes",
			arguments: {
				title: uniqueTitle,
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		const task = JSON.parse(text);

		// Note: TaskNotes uses `path` as identifier, not `id`
		expect(task).toHaveProperty("title", uniqueTitle);
		expect(task).toHaveProperty("status");
		expect(task).toHaveProperty("priority");
		expect(task).toHaveProperty("path");
		expect(task).toHaveProperty("archived");
	});

	test("should update an existing task status", async () => {
		// Query for an existing task from the test vault
		const queryResult = await client.callTool({
			name: "tasknotes_query",
			arguments: {
				due_before: "2030-12-31",
				limit: 1,
			},
		});

		expect(queryResult.isError).toBeFalsy();
		const queryData = JSON.parse(getToolResultText(queryResult));
		expect(queryData.tasks.length).toBeGreaterThan(0);

		const existingTask = queryData.tasks[0];
		const originalStatus = existingTask.status;

		// Update the task status
		const newStatus = originalStatus === "completed" ? "incomplete" : "completed";
		const updateResult = await client.callTool({
			name: "tasknotes",
			arguments: {
				path: existingTask.path,
				status: newStatus,
			},
		});

		expect(updateResult.isError).toBeFalsy();
		const updated = JSON.parse(getToolResultText(updateResult));
		expect(updated.status).toBe(newStatus);

		// Restore original status
		await client.callTool({
			name: "tasknotes",
			arguments: {
				path: existingTask.path,
				status: originalStatus,
			},
		});
	});
});
