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

	registerRoutes() {
		// Get the API handle
		this.api = getAPI(this.app, this.manifest);

		// Add the MCP route for streamable HTTP
		this.api.addRoute("/mcp").all(async (request, response) => {
			try {
				// Create a new server and transport for each request (stateless approach)
				const server = new McpServer({
					name: "Obsidian MCP Plugin",
					version: this.manifest.version,
				});

				// Add basic tools here
				server.tool("ping", 
					{}, 
					async () => ({
						content: [{ type: "text", text: "pong" }]
					})
				);

				// Create a stateless transport (no session management)
				const transport = new StreamableHTTPServerTransport({
					sessionIdGenerator: undefined,
				});

				// Close resources when the connection ends
				response.on('close', () => {
					transport.close();
					server.close();
				});

				// Connect the server to the transport
				await server.connect(transport);

				// Handle the request
				await transport.handleRequest(request, response, request.body);
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

		// Keep the example route
		this.api.addRoute("/my-route/").get((request, response) => {
			response.status(200).json({
				sample_plugin_response_ok: true,
			});
		});
	}

	//
	//
	//
	//
	// Everything below this point can be left as it is -- this is just
	// setting up machinery to properly register your routes with
	// Obsidian Local REST API
	//
	//
	//
	//

	async onload() {
		if (this.app.plugins.enabledPlugins.has("obsidian-local-rest-api")) {
			this.registerRoutes();
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
