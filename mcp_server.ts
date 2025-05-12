import { App, TFolder } from "obsidian";
import { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { searchTool } from "tools/search";
import { updateContentTool } from "tools/update_content";
import { dataviewQueryTool } from "tools/dataview_query";
import { getFileMetadataTool, FileMetadataResource } from "tools/file_metadata";
import { quickAddListTool, quickAddExecuteTool, isQuickAddEnabled } from "tools/quickadd";
import { ToolRegistration } from "tools/types";
import { DEFAULT_SETTINGS, MCPPluginSettings } from "./settings/types";
import { registerPrompts } from "tools/prompts";
import { VaultDailyNoteResource, VaultFileResource } from "tools/vault_file_resource";
import { getContentsTool } from "tools/get_contents";
import type { Request, Response } from "express";
import { isPluginEnabled as isDataviewEnabled } from "obsidian-dataview";
import { logger } from "tools/logging";
import { InitializeRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export class ObsidianMcpServer {
	private server: McpServer;
	private sseTransports: Record<string, SSEServerTransport> = {};

	constructor(
		private app: App,
		private manifest: { version: string; name: string },
		private settings: MCPPluginSettings
	) {
		logger.log(`Initializing MCP server v${this.manifest.version}`);
		const vaultDescription = this.settings.vaultDescription ?? DEFAULT_SETTINGS.vaultDescription;
		const vaultStructure = this.getVaultStructure();

		this.server = new McpServer(
			{ name: this.manifest.name, version: this.manifest.version },
			{ instructions: `${vaultDescription}\n\nVault Structure:\n${vaultStructure}` }
		);

		this.patchSseVersion();

		this.server.server.onerror = (error) => {
			logger.logError("Server Error:", error);
		};

		const { enabledTools } = this.settings;

		if (enabledTools.file_access) {
			new VaultFileResource(this.app).register(this.server);
			new VaultDailyNoteResource(this.app).register(this.server);
			new FileMetadataResource(this.app).register(this.server);
			this.registerTool(this.server, getContentsTool);
			this.registerTool(this.server, getFileMetadataTool);
		}

		if (enabledTools.search) {
			this.registerTool(this.server, searchTool);
		}

		if (enabledTools.update_content) {
			this.registerTool(this.server, updateContentTool);
		}

		if (enabledTools.dataview_query && isDataviewEnabled(this.app)) {
			this.registerTool(this.server, dataviewQueryTool);
		}

		if (isQuickAddEnabled(this.app) && enabledTools.quickadd) {
			this.registerTool(this.server, quickAddListTool);
			this.registerTool(this.server, quickAddExecuteTool);
		}

		if (this.settings.enablePrompts) {
			registerPrompts(this.app, this.server, this.settings);
		}
	}

	private patchSseVersion() {
		// Modify the server to always respond with the older protocol version for SSE connections to improve compatibility with older clients
		this.server.server.setRequestHandler(InitializeRequestSchema, async (request, extra) => {
			const response = await this.server.server["_oninitialize"](request);
			if (extra.sessionId && this.sseTransports[extra.sessionId]) {
				response.protocolVersion = "2024-11-05";
			}
			return response;
		});
	}

	private getVaultStructure(): string {
		const rootFolder = this.app.vault.getRoot();
		let structure = "";

		const allFolders = this.app.vault
			.getAllLoadedFiles()
			.filter((file): file is TFolder => file instanceof TFolder)
			.sort((a, b) => a.path.localeCompare(b.path));

		const rootFolders = allFolders.filter((folder) => folder.parent === rootFolder);

		for (const folder of rootFolders) {
			structure += `- ${folder.path}\n`;
			const subFolders = allFolders.filter((f) => f.parent === folder);
			for (const subFolder of subFolders) {
				structure += `  - ${subFolder.path}\n`;
			}
		}

		return structure || "No directories found in vault.";
	}

	async handleSseRequest(request: Request, response: Response) {
		if (request.method === "GET") {
			const transport = new SSEServerTransport("/messages", response);
			this.sseTransports[transport.sessionId] = transport;

			logger.logConnection("SSE", transport.sessionId, request);

			response.on("close", () => {
				logger.logConnectionClosed("SSE", transport.sessionId);
				delete this.sseTransports[transport.sessionId];
			});

			await this.server.connect(transport);
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

	async handleStreamingRequest(request: Request, response: Response) {
		logger.log(`New streaming request received`);
		logger.log(
			`Client IP: ${request.ip || "unknown"}, User-Agent: ${request.get("User-Agent") || "unknown"}`
		);

		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			enableJsonResponse: true,
		});

		await logger.withPerformanceLogging(
			"Streaming request",
			async () => {
				await transport.handleRequest(request, response, request.body);
			},
			{
				successMessage: "Streaming request completed",
				errorMessage: "Error handling streaming request",
			}
		);
	}

	public async close() {
		logger.log("Shutting down MCP server");
		await this.server.close();
		logger.log("MCP server closed");
	}

	private registerTool(server: McpServer, toolReg: ToolRegistration) {
		const toolName = this.settings.toolNamePrefix
			? `${this.settings.toolNamePrefix}_${toolReg.name}`
			: toolReg.name;

		logger.logToolRegistration(toolName);

		const wrappedToolHandler = logger.withToolLogging(
			toolName,
			async (args: Record<string, unknown>) => {
				return await toolReg.handler(this.app)(args);
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
