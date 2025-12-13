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

test.describe("Timeblocks Integration", () => {
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

	test("should include timeblocks tools when plugin is available", async () => {
		const result = await client.listTools();
		const toolNames = result.tools.map((t) => t.name);
		expect(toolNames).toContain("timeblocks_query");
		expect(toolNames).toContain("timeblocks");
	});

	test("should query timeblocks for today", async () => {
		const result = await client.callTool({
			name: "timeblocks_query",
			arguments: {
				date: "today",
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		const data = JSON.parse(text);

		expect(data).toHaveProperty("date");
		expect(data).toHaveProperty("timeblocks");
		expect(data.timeblocks).toBeInstanceOf(Array);
	});

	test("should query timeblocks with default date (today)", async () => {
		const result = await client.callTool({
			name: "timeblocks_query",
			arguments: {},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		const data = JSON.parse(text);

		expect(data.date).toBe("today");
		expect(data.timeblocks).toBeInstanceOf(Array);
	});

	test("should query timeblocks with explicit date", async () => {
		const result = await client.callTool({
			name: "timeblocks_query",
			arguments: {
				date: "2024-01-15",
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		const data = JSON.parse(text);

		expect(data.date).toBe("2024-01-15");
		expect(data.timeblocks).toBeInstanceOf(Array);
	});

	test("should create a timeblock", async () => {
		const result = await client.callTool({
			name: "timeblocks",
			arguments: {
				date: "today",
				title: "Test Meeting",
				startTime: "14:00",
				endTime: "15:00",
				description: "E2E test timeblock",
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		const data = JSON.parse(text);

		expect(data).toHaveProperty("id");
		expect(data.title).toBe("Test Meeting");
		expect(data.startTime).toBe("14:00");
		expect(data.endTime).toBe("15:00");
		expect(data.description).toBe("E2E test timeblock");
	});

	test("should create a timeblock with all fields", async () => {
		const result = await client.callTool({
			name: "timeblocks",
			arguments: {
				date: "today",
				title: "Deep Work Session",
				startTime: "09:00",
				endTime: "11:00",
				description: "Focus on e2e tests",
				color: "#6366f1",
				attachments: ["[[task-1]]", "[[task-2]]"],
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		const data = JSON.parse(text);

		expect(data).toHaveProperty("id");
		expect(data.title).toBe("Deep Work Session");
		expect(data.color).toBe("#6366f1");
		expect(data.attachments).toEqual(["[[task-1]]", "[[task-2]]"]);
	});

	test("should update a timeblock", async () => {
		// First create a timeblock
		const createResult = await client.callTool({
			name: "timeblocks",
			arguments: {
				date: "today",
				title: "Original Title",
				startTime: "10:00",
				endTime: "11:00",
			},
		});

		expect(createResult.isError).toBeFalsy();
		const createText = getToolResultText(createResult);
		const createData = JSON.parse(createText);
		const id = createData.id;

		// Now update it
		const updateResult = await client.callTool({
			name: "timeblocks",
			arguments: {
				date: "today",
				id: id,
				title: "Updated Title",
				description: "Added description",
			},
		});

		expect(updateResult.isError).toBeFalsy();
		const updateText = getToolResultText(updateResult);
		const updateData = JSON.parse(updateText);

		expect(updateData.id).toBe(id);
		expect(updateData.title).toBe("Updated Title");
		expect(updateData.description).toBe("Added description");
		expect(updateData.startTime).toBe("10:00");
		expect(updateData.endTime).toBe("11:00");
	});

	test("should delete a timeblock", async () => {
		// First create a timeblock
		const createResult = await client.callTool({
			name: "timeblocks",
			arguments: {
				date: "today",
				title: "To Be Deleted",
				startTime: "16:00",
				endTime: "17:00",
			},
		});

		expect(createResult.isError).toBeFalsy();
		const createText = getToolResultText(createResult);
		const createData = JSON.parse(createText);
		const id = createData.id;

		// Now delete it
		const deleteResult = await client.callTool({
			name: "timeblocks",
			arguments: {
				date: "today",
				id: id,
				delete: true,
			},
		});

		expect(deleteResult.isError).toBeFalsy();
		const deleteText = getToolResultText(deleteResult);
		const deleteData = JSON.parse(deleteText);

		expect(deleteData.success).toBe(true);
		expect(deleteData.deleted).toBe(id);
	});

	test("should fail to create timeblock without required fields", async () => {
		const result = await client.callTool({
			name: "timeblocks",
			arguments: {
				date: "today",
				title: "Missing times",
			},
		});

		expect(result.isError).toBe(true);
		const text = getToolResultText(result);
		expect(text).toMatch(/startTime.*endTime.*required/i);
	});

	test("should fail to delete without id", async () => {
		const result = await client.callTool({
			name: "timeblocks",
			arguments: {
				date: "today",
				delete: true,
			},
		});

		expect(result.isError).toBe(true);
		const text = getToolResultText(result);
		expect(text).toMatch(/ID.*required.*delete/i);
	});

	test("should query timeblocks after creating some", async () => {
		// Create multiple timeblocks
		await client.callTool({
			name: "timeblocks",
			arguments: {
				date: "today",
				title: "Morning Block",
				startTime: "08:00",
				endTime: "09:00",
			},
		});

		await client.callTool({
			name: "timeblocks",
			arguments: {
				date: "today",
				title: "Afternoon Block",
				startTime: "13:00",
				endTime: "14:00",
			},
		});

		// Query all timeblocks
		const result = await client.callTool({
			name: "timeblocks_query",
			arguments: {
				date: "today",
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		const data = JSON.parse(text);

		expect(data.timeblocks.length).toBeGreaterThanOrEqual(2);
		const titles = data.timeblocks.map((tb: { title: string }) => tb.title);
		expect(titles).toContain("Morning Block");
		expect(titles).toContain("Afternoon Block");
	});

	test("should verify timeblock has expected fields", async () => {
		const result = await client.callTool({
			name: "timeblocks",
			arguments: {
				date: "today",
				title: "Field Check",
				startTime: "12:00",
				endTime: "13:00",
			},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		const data = JSON.parse(text);

		expect(data).toHaveProperty("id");
		expect(data).toHaveProperty("title");
		expect(data).toHaveProperty("startTime");
		expect(data).toHaveProperty("endTime");
	});
});
