import { Plugin } from "obsidian";
import { getAPI, LocalRestApiPublicApi } from "obsidian-local-rest-api";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// Extend the LocalRestApiPublicApi interface to include the unregister method
declare module "obsidian-local-rest-api" {
	interface LocalRestApiPublicApi {
		unregister(): void;
	}
}

export default class ObsidianMCPPlugin extends Plugin {
	private api: LocalRestApiPublicApi;
	private server: McpServer;
	private transport: StreamableHTTPServerTransport;

	async registerRoutes() {
		this.api = getAPI(this.app, this.manifest);

		this.server = new McpServer({
			name: "Obsidian MCP Plugin",
			version: this.manifest.version,
		});

		this.server.tool("ping", {}, async () => ({
			content: [{ type: "text", text: "pong" }]
		}));

		this.transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			enableJsonResponse: true,
		});

		await this.server.connect(this.transport);

		this.api.addRoute("/mcp").all(async (request, response) => {
			try {
				await this.transport.handleRequest(request, response, request.body);
			} catch (error) {
				console.error("Error handling MCP request:", error);
				response.status(500).json({
					jsonrpc: "2.0",
					error: {
						code: -32603,
						message: "Internal error"
					},
					id: null
				});
			}
		});
	}

	async onload() {
		if (this.app.plugins.enabledPlugins.has("obsidian-local-rest-api")) {
			await this.registerRoutes();
		}

		this.registerEvent(
			this.app.workspace.on(
				"obsidian-local-rest-api:loaded",
				this.registerRoutes.bind(this)
			)
		);
	}

	onunload() {
		if (this.api) {
			this.api.unregister();
		}
		if (this.transport) {
			this.transport.close();
		}
		if (this.server) {
			this.server.close();
		}
	}
}

declare module "obsidian" {
	interface App {
		plugins: {
			enabledPlugins: Set<string>;
		};
	}
	interface Workspace {
		on(
			name: "obsidian-local-rest-api:loaded",
			callback: () => void,
			ctx?: any
		): EventRef;
	}
}
