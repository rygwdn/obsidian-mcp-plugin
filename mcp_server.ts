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
import { VaultFileResource } from "tools/vault_file_resource";
import { getContentsTool } from "tools/get_contents";
import type { Request, Response } from "express";
import { isPluginEnabled as isDataviewEnabled } from "obsidian-dataview";
import { logger } from "tools/logging";

export class ObsidianMcpServer {
	private server: McpServer;
	private transports: Record<string, SSEServerTransport> = {};

	constructor(
		private app: App,
		private manifest: { version: string; name: string },
		private settings: MCPPluginSettings
	) {
		logger.log(`Initializing MCP server v${this.manifest.version}`);
		const vaultDescription = this.settings.vaultDescription ?? DEFAULT_SETTINGS.vaultDescription;
		const vaultStructure = this.getVaultStructure();

		this.server = new McpServer(
			{
				name: this.manifest.name,
				version: this.manifest.version,
			},
			{
				instructions: `${vaultDescription}

Vault Structure:
${vaultStructure}`,
			}
		);
		this.server.server.onerror = (error) => {
			logger.logError("Server Error:", error);
		};

		const { enabledTools } = this.settings;

		if (enabledTools.file_access) {
			this.registerTool(this.server, getContentsTool);
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

		if (this.settings.enableResources) {
			new VaultFileResource(this.app).register(this.server);
		}

		if (enabledTools.get_file_metadata) {
			new FileMetadataResource(this.app, this.settings.toolNamePrefix).register(this.server);
			this.registerTool(this.server, getFileMetadataTool);
		}

		if (isQuickAddEnabled(this.app) && enabledTools.quickadd) {
			this.registerTool(this.server, quickAddListTool);
			this.registerTool(this.server, quickAddExecuteTool);
		}

		if (this.settings.enablePrompts) {
			registerPrompts(this.app, this.server, this.settings);
		}
	}

	/**
	 * Generates a formatted string representing the first two layers of directories in the vault
	 */
	private getVaultStructure(): string {
		const rootFolder = this.app.vault.getRoot();
		let structure = "";

		// Get all folders in the vault
		const allFolders = this.app.vault
			.getAllLoadedFiles()
			.filter((file): file is TFolder => file instanceof TFolder)
			.sort((a, b) => a.path.localeCompare(b.path));

		// Process root level folders first
		const rootFolders = allFolders.filter((folder) => folder.parent === rootFolder);

		for (const folder of rootFolders) {
			structure += `- ${folder.path}\n`;

			// Add second level folders
			const subFolders = allFolders.filter((f) => f.parent === folder);
			for (const subFolder of subFolders) {
				structure += `  - ${subFolder.path}\n`;
			}
		}

		return structure || "No directories found in vault.";
	}

	async handleSseRequest(request: Request, response: Response) {
		if (request.method === "GET") {
			const transport = new SSEServerTransport("/mcp/messages", response);
			this.transports[transport.sessionId] = transport;

			logger.logConnection("SSE", transport.sessionId, request);

			response.on("close", () => {
				logger.logConnectionClosed("SSE", transport.sessionId);
				delete this.transports[transport.sessionId];
			});

			await this.server.connect(transport);
		} else if (request.method === "POST") {
			const sessionId = request.query.sessionId as string | undefined;
			if (!sessionId) {
				logger.logError("SSE POST error: No session ID provided");
				response.status(400).send("No session ID provided");
				return;
			}

			const transport = this.transports[sessionId];
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
