import { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
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
import type { ObsidianInterface } from "./obsidian/obsidian_interface";
import type { AuthenticatedRequest } from "./server/auth";

// Define which tools require write permission
const WRITE_TOOLS = new Set(["update_content", "quickadd_execute"]);

export class ObsidianMcpServer {
	private servers: McpServer[] = [];
	private currentRequest: Request | null = null;

	constructor(
		private obsidian: ObsidianInterface,
		private manifest: { version: string; name: string }
	) {}

	public async handleHttpRequest(request: Request, response: Response) {
		logger.logConnection("HTTP", "request", request);
		this.currentRequest = request;

		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			enableJsonResponse: true,
		});

		const server = this.createServer();
		this.servers.push(server);

		await logger.withPerformanceLogging(
			"HTTP request",
			async () => {
				await server.connect(transport);
				await transport.handleRequest(request, response, request.body);
			},
			{
				successMessage: "HTTP request completed",
				errorMessage: "Error handling HTTP request",
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
			server.tool(
				toolName,
				toolReg.description,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any -- zod 4.x types incompatible with MCP SDK zod 3.x types
				toolReg.schema as any,
				toolReg.annotations,
				handler
			);
		} else {
			server.tool(toolName, toolReg.description, toolReg.annotations, handler);
		}
	}
}
