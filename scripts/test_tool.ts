#!/usr/bin/env tsx

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 4) {
	console.error("Usage: tsx test_tool.ts <url> <token> <tool_name> <json_params>");
	console.error(
		'Example: tsx test_tool.ts https://127.0.0.1:27124/mcp TOKEN dataview_query \'{"query":"LIST FROM #tag"}\''
	);
	process.exit(1);
}

const [url, token, toolName, jsonParamsStr] = args;

// Parse JSON parameters
let params: Record<string, unknown>;
try {
	params = JSON.parse(jsonParamsStr);
} catch (e) {
	console.error("Error: Invalid JSON parameters");
	console.error((e as Error).message);
	process.exit(1);
}

async function main() {
	console.log(`Testing tool: ${toolName}`);
	console.log(`Connecting to: ${url}`);
	console.log(`Params: ${JSON.stringify(params, null, 2)}`);

	// Create MCP client with transport
	const transport = new StreamableHTTPClientTransport(url, {
		requestInit: {
			headers: {
				Authorization: `Bearer ${token}`,
			},
			allowInsecureConnections: true,
		},
	});

	const client = new Client({
		name: "mcp-tool-tester",
		version: "1.0.0",
	});

	try {
		// Connect to server
		await client.connect(transport);
		console.log("Connected to MCP server");

		// Get available tools
		const tools = await client.listTools();
		console.log("Available tools:", tools.tools.map((t) => t.name).join(", "));

		// Check if the requested tool is available
		if (!tools.tools.some((t) => t.name === toolName)) {
			console.error(`Error: Tool "${toolName}" is not available on the server.`);
			console.error("Available tools:", tools.tools.map((t) => t.name).join(", "));
			process.exit(1);
		}

		// Execute the tool with parameters
		console.log(`\nExecuting ${toolName} with params:`);
		console.log(JSON.stringify(params, null, 2));

		// Use dynamic tool execution
		const result = await client.callTool({
			name: toolName,
			arguments: params,
		});

		console.log("\nRESULT:");
		console.log("-------");
		// Convert response content to a readable format
		if (result.content && Array.isArray(result.content)) {
			result.content.forEach((item) => {
				if (item.type === "text" && item.text) {
					console.log(item.text);
				} else {
					console.log(item);
				}
			});
		} else {
			console.log(result);
		}
	} catch (error) {
		console.error("Error occurred:");
		console.error(error);
	} finally {
		// Close the connection
		await client.close();
		console.log("\nConnection closed");
	}
}

main().catch((error) => {
	console.error("Unhandled error:", error);
	process.exit(1);
});
