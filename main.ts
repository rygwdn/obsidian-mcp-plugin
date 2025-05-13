import { Plugin } from "obsidian";
import { getAPI, LocalRestApiPublicApi } from "obsidian-local-rest-api";
import { ObsidianMcpServer } from "mcp_server";
import { DEFAULT_SETTINGS, MCPPluginSettings } from "./settings/types";
import { MCPSettingTab } from "./settings/tab";
import type { Response } from "express";
import { logger } from "./tools/logging";

export default class ObsidianMCPPlugin extends Plugin {
	private api: LocalRestApiPublicApi;
	private server: ObsidianMcpServer;
	settings: MCPPluginSettings;

	private errorResponse(response: Response, error: Error) {
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

	async registerRoutes() {
		this.api = getAPI(this.app, this.manifest);
		this.server = new ObsidianMcpServer(this.app, this.manifest, this.settings);

		this.api.addRoute("/mcp").post(async (request, response) => {
			try {
				await this.server.handleStreamingRequest(request, response);
			} catch (error) {
				this.errorResponse(response, error);
			}
		});

		this.api.addRoute("/messages").post(async (request, response) => {
			try {
				await this.server.handleSseRequest(request, response);
			} catch (error) {
				this.errorResponse(response, error);
			}
		});

		this.api.addRoute("/sse").get(async (request, response) => {
			try {
				await this.server.handleSseRequest(request, response);
			} catch (error) {
				this.errorResponse(response, error);
			}
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		logger.getVerboseSetting = () => this.settings.verboseLogging;
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
		if (this.server) {
			this.server.close();
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
