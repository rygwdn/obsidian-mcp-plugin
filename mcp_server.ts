import crypto from "crypto";
import type { Request, Response } from "express";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types";

import type { ObsidianInterface } from "./obsidian/obsidian_interface";
import type { AuthenticatedRequest } from "./server/auth";
import { getRequest } from "./server/auth";
import { DEFAULT_SETTINGS } from "./settings/types";
import { dataviewQueryTool } from "tools/dataview_query";
import { FileMetadataResource, getFileMetadataTool } from "tools/file_metadata";
import { getContentsTool } from "tools/get_contents";
import { logger } from "tools/logging";
import { quickAddExecuteTool, quickAddListTool } from "tools/quickadd";
import { searchTool } from "tools/search";
import { taskNotesQueryTool, taskNotesTool } from "tools/tasknotes";
import type { ToolRegistration } from "tools/types";
import { updateContentTool } from "tools/update_content";
import { VaultDailyNoteResource, VaultFileResource } from "tools/vault_file_resource";

export class ObsidianMcpServer {
	private transports: StreamableHTTPServerTransport[] = [];

	constructor(
		private obsidian: ObsidianInterface,
		private manifest: { version: string; name: string }
	) {}

	public async handleHttpRequest(request: Request, response: Response) {
		const authReq = request as AuthenticatedRequest;

		const reqSession = request.header("mcp-session-id");
		let transport = this.transports.find((transport) => transport.sessionId === reqSession);

		if (!transport) {
			const server = this.createServer(authReq);
			transport = new StreamableHTTPServerTransport({
				sessionIdGenerator: () => crypto.randomBytes(16).toString("hex"),
				enableJsonResponse: true,
			});
			await server.connect(transport);
			this.transports.push(transport);
		}

		try {
			await logger.withPerformanceLogging(
				"HTTP request",
				async () => {
					(authReq as AuthenticatedRequest & { auth: AuthInfo }).auth = {
						token: reqSession || "unknown",
						clientId: "client",
						scopes: ["*"],
						extra: { request: authReq },
					} satisfies AuthInfo;
					await transport.handleRequest(authReq, response, authReq.body);
				},
				{
					successMessage: `HTTP request completed: ${transport.sessionId} ${JSON.stringify(request.body)} ${JSON.stringify(request.headers)}`,
					errorMessage: `Error handling HTTP request ${transport.sessionId} ${JSON.stringify(request.body)}`,
				}
			);
		} catch (error) {
			authReq.trackAction({
				type: "error",
				name: "HTTP Request Error",
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	public async close() {
		logger.log("Shutting down MCP server");
		for (const transport of this.transports) {
			await transport.close();
		}
		logger.log("MCP server closed");
	}

	private createServer(request: AuthenticatedRequest) {
		logger.log(`Initializing MCP server v${this.manifest.version}`);
		const vaultDescription =
			this.obsidian.settings.vaultDescription ?? DEFAULT_SETTINGS.vaultDescription;

		const server = new McpServer(
			{ name: this.manifest.name, version: this.manifest.version },
			{ instructions: vaultDescription }
		);

		server.server.onerror = (error) => {
			request.trackAction({
				type: "error",
				name: "Server Error",
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
		};

		this.registerTools(server, request);

		return server;
	}

	private registerTools(server: McpServer, request: AuthenticatedRequest) {
		const enabledTools = request.token.enabledTools;

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

		if (enabledTools.dataview_query && this.obsidian.getDataview(request)) {
			this.registerTool(server, dataviewQueryTool);
		}

		if (this.obsidian.getQuickAdd(request) && enabledTools.quickadd) {
			this.registerTool(server, quickAddListTool);
			this.registerTool(server, quickAddExecuteTool);
		}

		if (enabledTools.tasknotes && this.obsidian.getTaskNotes(request)) {
			this.registerTool(server, taskNotesQueryTool);
			this.registerTool(server, taskNotesTool);
		}
	}

	private registerTool(server: McpServer, toolReg: ToolRegistration) {
		const toolName = toolReg.name;

		const handler: ToolCallback = async (...args) => {
			const extra = args[args.length - 1];
			const request = getRequest(extra);

			const trackerParams = {
				type: "tool",
				name: toolName,
				details: { args },
			} as const;

			try {
				const data = await toolReg.handler(this.obsidian, request, args[0]);
				request.trackAction({
					...trackerParams,
					success: true,
				});
				return { content: [{ type: "text", text: data }] };
			} catch (error) {
				request.trackAction({
					...trackerParams,
					success: false,
					error: error.toString(),
				});
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
