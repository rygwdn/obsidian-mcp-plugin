import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { E2E_MCP_PORT, E2E_TEST_TOKEN } from "../playwright.config";

export { Client };
export type { StreamableHTTPClientTransport };

/**
 * Create an MCP client connected to the test server
 */
export async function createMcpClient(
	port: number = E2E_MCP_PORT,
	token: string = E2E_TEST_TOKEN
): Promise<Client> {
	const client = new Client({ name: "e2e-test-client", version: "1.0.0" }, { capabilities: {} });

	const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
		requestInit: {
			headers: { Authorization: `Bearer ${token}` },
		},
	});

	await client.connect(transport);
	return client;
}
