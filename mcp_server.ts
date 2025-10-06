import { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { searchTool } from "tools/search";
import { updateContentTool } from "tools/update_content";
import { dataviewQueryTool } from "tools/dataview_query";
import { getFileMetadataTool, FileMetadataResource } from "tools/file_metadata";
import { quickAddListTool, quickAddExecuteTool } from "tools/quickadd";
import { ToolRegistration } from "tools/types";
import { DEFAULT_SETTINGS, TokenPermission } from "./settings/types";
import { registerPrompts } from "tools/prompts";
import { VaultDailyNoteResource, VaultFileResource } from "tools/vault_file_resource";
import { getContentsTool } from "tools/get_contents";
import type { Request, Response } from "express";
import { logger } from "tools/logging";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { ObsidianInterface } from "./obsidian/obsidian_interface";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types";
import type { AuthenticatedRequest } from "./server/auth";

class LegacySSEServerTransport extends SSEServerTransport {
	async handleMessage(
		message: unknown,
		extra?: {
			authInfo?: AuthInfo;
		}
	): Promise<void> {
		// Force the protocol version to 2024-11-05 for SSE connections to improve compatibility with older clients
		if (isInitializeRequest(message) && !message.params.protocolVersion.startsWith("2024")) {
			logger.log(
				"Legacy SSE server transport: Setting protocol version from",
				message.params.protocolVersion,
				"to 2024-11-05"
			);
			message.params.protocolVersion = "2024-11-05";
		}
		return await super.handleMessage(message, extra);
	}
}

// Define which tools require write permission
const WRITE_TOOLS = new Set(["update_content", "quickadd_execute"]);

export class ObsidianMcpServer {
	private sseTransports: Record<string, SSEServerTransport> = {};
	private servers: McpServer[] = [];
	private currentRequest: Request | null = null;

	constructor(
		private obsidian: ObsidianInterface,
		private manifest: { version: string; name: string }
	) {}

	public async handleSseRequest(request: Request, response: Response) {
		// Check if SSE is enabled in settings
		if (!this.obsidian.settings.enableSSE) {
			logger.logError("SSE request failed: SSE endpoints are disabled in plugin settings");
			response.status(404).json({
				error: "SSE not available",
				message: "SSE endpoints are currently disabled",
				details: "Enable SSE in the MCP Plugin settings to use Server-Sent Events connections",
			});
			return;
		}

		if (request.method === "GET") {
			const transport = new LegacySSEServerTransport("/messages", response);
			this.sseTransports[transport.sessionId] = transport;

			logger.logConnection("SSE", transport.sessionId, request);
			const server = this.createServer();
			this.servers.push(server);

			response.on("close", () => {
				logger.logConnectionClosed("SSE", transport.sessionId);
				delete this.sseTransports[transport.sessionId];
			});

			await server.connect(transport);
		} else if (request.method === "POST") {
			const sessionId = request.query.sessionId as string | undefined;
			if (!sessionId) {
				logger.logError("SSE POST error: No session ID provided");
				response.status(400).send("No session ID provided");
				return;
			}

			const transport = this.sseTransports[sessionId];
			if (!transport) {
				logger.logError(`SSE POST error: No transport found for session ID: ${sessionId}`);
				response.status(400).send("No transport found for session ID");
				return;
			}

			logger.log(`SSE message received: ${sessionId}`);
			await transport.handlePostMessage(request, response, request.body);
		}
	}

	public async handleStreamingRequest(request: Request, response: Response) {
		logger.logConnection("HTTP", "streaming", request);
		this.currentRequest = request;

		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			enableJsonResponse: true,
		});

		const server = this.createServer();
		this.servers.push(server);

		await logger.withPerformanceLogging(
			"Streaming request",
			async () => {
				await server.connect(transport);
				await transport.handleRequest(request, response, request.body);
			},
			{
				successMessage: "Streaming request completed",
				errorMessage: "Error handling streaming request",
			}
		);

		this.currentRequest = null;
	}

	public async close() {
		logger.log("Shutting down MCP server");
		for (const server of this.servers) {
			if (server.isConnected()) {
				await server.close();
			}
		}
		logger.log("MCP server closed");
	}

	private createServer() {
		logger.log(`Initializing MCP server v${this.manifest.version}`);
		const vaultDescription =
			this.obsidian.settings.vaultDescription ?? DEFAULT_SETTINGS.vaultDescription;

		const server = new McpServer(
			{ name: this.manifest.name, version: this.manifest.version },
			{ instructions: vaultDescription }
		);

		server.server.onerror = (error) => {
			logger.logError("Server Error:", error);
		};

		this.registerTools(server);

		if (this.obsidian.settings.enablePrompts) {
			registerPrompts(this.obsidian, server);
		}

		return server;
	}

	private registerTools(server: McpServer) {
		const enabledTools = this.obsidian.settings.enabledTools;

		if (enabledTools.file_access) {
			new VaultFileResource(this.obsidian).register(server);
			new VaultDailyNoteResource(this.obsidian).register(server);
			new FileMetadataResource(this.obsidian).register(server);
			this.registerTool(server, getContentsTool);
			this.registerTool(server, getFileMetadataTool);
		}

		if (enabledTools.search) {
			this.registerTool(server, searchTool);
		}

		if (enabledTools.update_content) {
			this.registerTool(server, updateContentTool);
		}

		if (enabledTools.dataview_query && this.obsidian.dataview) {
			this.registerTool(server, dataviewQueryTool);
		}

		if (this.obsidian.quickAdd && enabledTools.quickadd) {
			this.registerTool(server, quickAddListTool);
			this.registerTool(server, quickAddExecuteTool);
		}
	}

	private registerTool(server: McpServer, toolReg: ToolRegistration) {
		const toolNamePrefix = this.obsidian.settings.toolNamePrefix;
		const toolName = toolNamePrefix ? `${toolNamePrefix}_${toolReg.name}` : toolReg.name;
		logger.logToolRegistration(toolName);

		const requiresWrite = WRITE_TOOLS.has(toolReg.name);

		const wrappedToolHandler = logger.withToolLogging(
			toolName,
			async (args: Record<string, unknown>) => {
				// Check permissions if this tool requires write access
				if (requiresWrite && this.currentRequest) {
					const authReq = this.currentRequest as AuthenticatedRequest;
					if (!authReq.hasPermission(TokenPermission.WRITE)) {
						throw new Error("Permission denied: This operation requires write permission");
					}
				}

				return await toolReg.handler(this.obsidian)(args);
			}
		);

		const handler: ToolCallback = async (args) => {
			try {
				const data = await wrappedToolHandler(args);
				return { content: [{ type: "text", text: data }] };
			} catch (error) {
				return {
					isError: true,
					content: [
						{
							type: "text",
							text: error.toString(),
						},
					],
				};
			}
		};

		if (toolReg.schema) {
			server.tool(toolName, toolReg.description, toolReg.schema, toolReg.annotations, handler);
		} else {
			server.tool(toolName, toolReg.description, toolReg.annotations, handler);
		}
	}
}
