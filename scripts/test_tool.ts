#!/usr/bin/env tsx

import { Command } from "commander";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport, SseError } from "@modelcontextprotocol/sdk/client/sse.js";

// Define the program with Commander
const program = new Command();

program
	.name("test-tool")
	.description("Test a Model Context Protocol tool with provided parameters")
	.version("1.0.0")
	.requiredOption("-u, --url <url>", "MCP server URL")
	.requiredOption("-t, --token <token>", "Authorization token")
	.requiredOption("-n, --tool-name <name>", "Name of the tool to test")
	.requiredOption("-p, --params <json>", "JSON parameters for the tool", JSON.parse)
	.option("-v, --verbose", "Enable verbose logging")
	.option("--transport <type>", "Transport type to use (sse or http)", "sse")
	.addHelpText(
		"after",
		`
Example:
  npm run test:tool -- -u https://127.0.0.1:27124/mcp -t TOKEN -n dataview_query -p '{"query":"LIST FROM #tag"}'

  # Using HTTP transport instead of SSE:
  npm run test:tool -- -u https://127.0.0.1:27124/mcp -t TOKEN -n dataview_query -p '{"query":"LIST FROM #tag"}' --transport http

  # Or run directly with tsx:
  tsx scripts/test_tool.ts -u https://127.0.0.1:27124/mcp -t TOKEN -n dataview_query -p '{"query":"LIST FROM #tag"}'`
	)
	.showHelpAfterError(true);

program.parse();

const options = program.opts();

async function main() {
	const { url, token, toolName, params, verbose, transport } = options;

	console.log(`Testing tool: ${toolName}`);
	console.log(`Connecting to: ${url}`);
	console.log(`Transport: ${transport}`);
	console.log(`Params: ${JSON.stringify(params, null, 2)}`);

	let transportInstance;

	if (transport === "http") {
		transportInstance = new StreamableHTTPClientTransport(new URL(url), {
			requestInit: {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			},
		});
	} else {
		// Default to SSE
		transportInstance = new SSEClientTransport(new URL(url), {
			requestInit: {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			},
			eventSourceInit: {
				withCredentials: true,
				fetch: async (url, init) => {
					if (verbose) {
						console.log("fetching", (init as RequestInit)?.method ?? "GET", url.toString());
					}
					const response = await fetch(url, {
						...init,
						headers: {
							...init?.headers,
							Authorization: `Bearer ${token}`,
						},
					});
					if (verbose) {
						console.log("response", response.status, response.statusText, response.headers);
					}
					return response;
				},
			},
		});
	}

	transportInstance.onclose = () => console.log("transport closed");
	transportInstance.onerror = (error) => console.error("transport error", error);
	transportInstance.onmessage = (message) => {
		if (verbose) console.log("transport message", message);
	};

	const client = new Client({
		name: "mcp-tool-tester",
		version: "1.0.0",
	});

	client.onclose = () => console.log("client closed");
	client.onerror = (error) => console.error("client error", error);

	try {
		await client.connect(transportInstance, {
			timeout: 1000,
			onprogress: (progress) => {
				if (verbose) console.log("progress", progress);
			},
		});
		console.log("Connected to MCP server");

		// Get available tools
		const tools = await client.listTools();
		if (verbose) {
			console.log("Available tools:", tools.tools.map((t) => t.name).join(", "));
		}

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
		if (error instanceof SseError) {
			console.error(error.event);
		}
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
