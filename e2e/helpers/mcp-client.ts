import { E2E_MCP_PORT, E2E_TEST_TOKEN } from "../playwright.config";

export interface JsonRpcRequest {
	jsonrpc: "2.0";
	method: string;
	params?: unknown;
	id: number | string;
}

export interface JsonRpcResponse {
	jsonrpc: "2.0";
	result?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
	id: number | string | null;
}

export interface McpToolCallParams {
	name: string;
	arguments?: Record<string, unknown>;
}

export interface McpResourceReadParams {
	uri: string;
}

/**
 * Simple MCP client for e2e testing over HTTP
 */
export class McpTestClient {
	private baseUrl: string;
	private token: string;
	private requestId: number = 0;
	private sessionId: string | null = null;

	constructor(port: number = E2E_MCP_PORT, token: string = E2E_TEST_TOKEN) {
		this.baseUrl = `http://127.0.0.1:${port}/mcp`;
		this.token = token;
	}

	/**
	 * Send a JSON-RPC request to the MCP server
	 */
	async request(method: string, params?: unknown): Promise<JsonRpcResponse> {
		const request: JsonRpcRequest = {
			jsonrpc: "2.0",
			method,
			params,
			id: ++this.requestId,
		};

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
			Authorization: `Bearer ${this.token}`,
		};

		if (this.sessionId) {
			headers["mcp-session-id"] = this.sessionId;
		}

		const response = await fetch(this.baseUrl, {
			method: "POST",
			headers,
			body: JSON.stringify(request),
		});

		// Capture session ID from response
		const newSessionId = response.headers.get("mcp-session-id");
		if (newSessionId) {
			this.sessionId = newSessionId;
		}

		// Handle different status codes appropriately
		if (response.status === 401) {
			throw new Error(`HTTP error: ${response.status} Unauthorized`);
		}

		// 406 often means we need different Accept headers or there's a protocol issue
		if (!response.ok) {
			const text = await response.text().catch(() => "");
			throw new Error(
				`HTTP error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`
			);
		}

		return response.json();
	}

	/**
	 * Initialize the MCP session
	 */
	async initialize(): Promise<JsonRpcResponse> {
		return this.request("initialize", {
			protocolVersion: "2024-11-05",
			capabilities: {},
			clientInfo: {
				name: "e2e-test-client",
				version: "1.0.0",
			},
		});
	}

	/**
	 * List available tools
	 */
	async listTools(): Promise<JsonRpcResponse> {
		return this.request("tools/list", {});
	}

	/**
	 * Call a tool
	 */
	async callTool(name: string, args?: Record<string, unknown>): Promise<JsonRpcResponse> {
		return this.request("tools/call", {
			name,
			arguments: args || {},
		});
	}

	/**
	 * List available resources
	 */
	async listResources(): Promise<JsonRpcResponse> {
		return this.request("resources/list", {});
	}

	/**
	 * Read a resource
	 */
	async readResource(uri: string): Promise<JsonRpcResponse> {
		return this.request("resources/read", { uri });
	}

	/**
	 * List available prompts
	 */
	async listPrompts(): Promise<JsonRpcResponse> {
		return this.request("prompts/list", {});
	}

	/**
	 * Get a prompt
	 */
	async getPrompt(name: string, args?: Record<string, string>): Promise<JsonRpcResponse> {
		return this.request("prompts/get", {
			name,
			arguments: args || {},
		});
	}

	/**
	 * Get the current session ID
	 */
	getSessionId(): string | null {
		return this.sessionId;
	}
}

/**
 * Create a new MCP test client
 */
export function createMcpClient(port?: number, token?: string): McpTestClient {
	return new McpTestClient(port, token);
}
