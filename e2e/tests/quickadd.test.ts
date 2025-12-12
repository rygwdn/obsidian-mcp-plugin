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

test.describe("QuickAdd Integration", () => {
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

	test("should include quickadd tools when plugin is available", async () => {
		const result = await client.listTools();
		const toolNames = result.tools.map((t) => t.name);
		expect(toolNames).toContain("quickadd_list");
		expect(toolNames).toContain("quickadd_execute");
	});

	test("should list available QuickAdd choices", async () => {
		const result = await client.callTool({
			name: "quickadd_list",
			arguments: {},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		// Should find the choices configured in data.json
		expect(text).toContain("Daily Note Template");
		expect(text).toContain("Quick Capture");
		expect(text).toContain("Meeting Note");
	});

	test("should list choices with their types", async () => {
		const result = await client.callTool({
			name: "quickadd_list",
			arguments: {},
		});

		expect(result.isError).toBeFalsy();
		const text = getToolResultText(result);
		// Should indicate choice types
		expect(text).toMatch(/template/i);
		expect(text).toMatch(/capture/i);
	});

	test("should execute capture choice by name", async () => {
		const result = await client.callTool({
			name: "quickadd_execute",
			arguments: {
				choice: "Quick Capture",
				variables: {
					VALUE: "Test capture from e2e test",
				},
			},
		});

		// Capture should succeed (creates or appends to capture.md)
		expect(result.isError).toBeFalsy();
	});

	test("should execute capture choice by ID", async () => {
		const result = await client.callTool({
			name: "quickadd_execute",
			arguments: {
				choice: "e2e-capture-choice",
				variables: {
					VALUE: "Another capture entry",
				},
			},
		});

		expect(result.isError).toBeFalsy();
	});

	test("should handle non-existent choice gracefully", async () => {
		const result = await client.callTool({
			name: "quickadd_execute",
			arguments: {
				choice: "Non-Existent Choice Name 12345",
			},
		});

		// Should return an error for non-existent choice
		expect(result.isError).toBe(true);
	});

	test("should verify capture was written to file", async () => {
		// First execute a capture
		await client.callTool({
			name: "quickadd_execute",
			arguments: {
				choice: "Quick Capture",
				variables: {
					VALUE: "Verification test entry",
				},
			},
		});

		// Wait for file to be written
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Then read the capture file
		const readResult = await client.callTool({
			name: "get_contents",
			arguments: {
				uri: "file:///notes/capture.md",
			},
		});

		if (!readResult.isError) {
			const text = getToolResultText(readResult);
			expect(text).toContain("Verification test entry");
		}
	});
});
