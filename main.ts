import { Plugin } from "obsidian";
import { getAPI, LocalRestApiPublicApi } from "obsidian-local-rest-api";
import { ObsidianMcpServer } from "mcp_server";
import { DEFAULT_SETTINGS, MCPPluginSettings, MCPSettingTab } from "./settings";

export default class ObsidianMCPPlugin extends Plugin {
	private api: LocalRestApiPublicApi;
	settings: MCPPluginSettings;

	async registerRoutes() {
		this.api = getAPI(this.app, this.manifest);

		this.api.addRoute("/mcp").all(async (request, response) => {
			try {
				const server = new ObsidianMcpServer(this.app, this.manifest, this.settings);
				await server.handleRequest(request, response);
			} catch (error) {
				console.error("Error handling MCP request:", error);
				response.status(500).json({
					jsonrpc: "2.0",
					error: {
						code: -32603,
						message: "Internal error",
					},
					id: null,
				});
			}
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new MCPSettingTab(this.app, this));
		if (this.app.plugins.enabledPlugins.has("obsidian-local-rest-api")) {
			await this.registerRoutes();
		}

		this.registerEvent(
			this.app.workspace.on("obsidian-local-rest-api:loaded", this.registerRoutes.bind(this))
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
			plugins: Record<string, unknown>;
		};
	}
	interface Workspace {
		on(name: "obsidian-local-rest-api:loaded", callback: () => void, ctx?: unknown): EventRef;
	}
}
