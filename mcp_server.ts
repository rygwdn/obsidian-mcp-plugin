import { IncomingMessage, ServerResponse } from "http";
import { App } from "obsidian";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { listFilesTool } from "tools/list_files";
import { getFileContentsTool } from "tools/get_file_contents";
import { appendContentTool } from "tools/append_content";
import { searchTool } from "tools/search";
import { replaceContentTool } from "tools/replace_content";
import { dataviewQueryTool } from "tools/dataview_query";
import { ToolRegistration } from "tools/types";
import { MCPPluginSettings } from "./settings";
import { registerPrompts } from "tools/prompts";
import { VaultFileResource } from "tools/resources";

export class ObsidianMcpServer {
	constructor(
		private app: App,
		private manifest: { version: string; name: string },
		private settings: MCPPluginSettings
	) {}

	async handleRequest(request: IncomingMessage & { body: unknown }, response: ServerResponse) {
		const { server, transport } = this.buildServer();

		server.connect(transport);

		response.on("close", () => {
			server.close();
			transport.close();
		});

		await transport.handleRequest(request, response, request.body);
	}

	private buildServer() {
		const server = new McpServer({
			name: this.manifest.name,
			version: this.manifest.version,
		});

		this.registerTool(server, listFilesTool);
		this.registerTool(server, getFileContentsTool);
		this.registerTool(server, searchTool);
		this.registerTool(server, appendContentTool);
		this.registerTool(server, replaceContentTool);
		this.registerTool(server, dataviewQueryTool);

		new VaultFileResource(this.app).register(server);
		registerPrompts(this.app, server, this.settings);

		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		});

		return { server, transport };
	}

	private registerTool(server: McpServer, toolReg: ToolRegistration) {
		server.tool(toolReg.name, toolReg.description, toolReg.schema, async (args) => {
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
