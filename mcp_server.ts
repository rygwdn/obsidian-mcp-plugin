import { App } from "obsidian";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { listFilesTool } from "tools/list_files";
import { getFileContentsTool } from "tools/get_file_contents";
import { appendContentTool } from "tools/append_content";
import { searchTool } from "tools/search";
import { replaceContentTool } from "tools/replace_content";
import { dataviewQueryTool } from "tools/dataview_query";
import { getDailyNoteTool, DailyNoteResource, isDailyNotesEnabled } from "tools/daily_notes";
import { getFileMetadataTool, FileMetadataResource } from "tools/file_metadata";
import { ToolRegistration } from "tools/types";
import { DEFAULT_SETTINGS, MCPPluginSettings } from "./settings";
import { registerPrompts } from "tools/prompts";
import { VaultFileResource } from "tools/vault_file_resource";
import type { Request, Response } from "express";
import { isPluginEnabled as isDataviewEnabled } from "obsidian-dataview";

export class ObsidianMcpServer {
	private server: McpServer;
	private transports: Record<string, SSEServerTransport> = {};

	constructor(
		private app: App,
		private manifest: { version: string; name: string },
		private settings: MCPPluginSettings
	) {
		const vaultDescription = this.settings.vaultDescription ?? DEFAULT_SETTINGS.vaultDescription;

		this.server = new McpServer(
			{
				name: this.manifest.name,
				version: this.manifest.version,
			},
			{
				instructions: vaultDescription,
			}
		);
		this.server.server.onerror = (error) => {
			console.error("MCP Server Error:", error);
		};

		const { enabledTools } = this.settings;

		if (enabledTools.list_files) {
			this.registerTool(this.server, listFilesTool);
		}

		if (enabledTools.get_file_contents) {
			this.registerTool(this.server, getFileContentsTool);
		}

		if (enabledTools.search) {
			this.registerTool(this.server, searchTool);
		}

		if (enabledTools.append_content) {
			this.registerTool(this.server, appendContentTool);
		}

		if (enabledTools.replace_content) {
			this.registerTool(this.server, replaceContentTool);
		}

		if (enabledTools.dataview_query && isDataviewEnabled(this.app)) {
			this.registerTool(this.server, dataviewQueryTool);
		}

		if (enabledTools.daily_notes && isDailyNotesEnabled(this.app)) {
			this.registerTool(this.server, getDailyNoteTool);
			new DailyNoteResource(this.app, this.settings.toolNamePrefix).register(this.server);
		}

		if (this.settings.enableResources) {
			new VaultFileResource(this.app, this.settings.toolNamePrefix).register(this.server);
		}

		if (enabledTools.get_file_metadata) {
			new FileMetadataResource(this.app, this.settings.toolNamePrefix).register(this.server);
			this.registerTool(this.server, getFileMetadataTool);
		}

		if (this.settings.enablePrompts) {
			registerPrompts(this.app, this.server, this.settings);
		}
	}

	async handleSseRequest(request: Request, response: Response) {
		if (request.method === "GET") {
			const transport = new SSEServerTransport("/mcp/messages", response);
			this.transports[transport.sessionId] = transport;
			response.on("close", () => {
				delete this.transports[transport.sessionId];
			});
			await this.server.connect(transport);
		} else if (request.method === "POST") {
			const sessionId = request.query.sessionId as string | undefined;
			if (!sessionId) {
				response.status(400).send("No session ID provided");
				return;
			}
			const transport = this.transports[sessionId];
			if (!transport) {
				response.status(400).send("No transport found for session ID");
				return;
			}

			await transport.handlePostMessage(request, response, request.body);
		}
	}

	async handleStreamingRequest(request: Request, response: Response) {
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			enableJsonResponse: true,
		});
		await transport.handleRequest(request, response, request.body);
	}

	public async close() {
		await this.server.close();
	}

	private registerTool(server: McpServer, toolReg: ToolRegistration) {
		const toolName = this.settings.toolNamePrefix
			? `${this.settings.toolNamePrefix}_${toolReg.name}`
			: toolReg.name;

		server.tool(toolName, toolReg.description, toolReg.schema, async (args) => {
			try {
				const data = await toolReg.handler(this.app)(args);
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
		});
	}
}
