import { Plugin } from "obsidian";
import { getAPI, LocalRestApiPublicApi } from "obsidian-local-rest-api";
import { ObsidianMcpServer } from "mcp_server";
import { DEFAULT_SETTINGS, MCPPluginSettings } from "./settings/types";
import { MCPSettingTab } from "./settings/tab";
import type { Response } from "express";
import { logger } from "./tools/logging";
import type { ObsidianInterface } from "./obsidian/obsidian_interface";
import { ObsidianImpl } from "./obsidian/obsidian_impl";

export default class ObsidianMCPPlugin extends Plugin {
	private api: LocalRestApiPublicApi;
	private server: ObsidianMcpServer;
	public settings: MCPPluginSettings;
	public obsidianInterface: ObsidianInterface;

	public get hasLocalRestApi() {
		return this.app.plugins.enabledPlugins.has("obsidian-local-rest-api");
	}

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
		if (this.api) {
			return;
		}

		this.api = getAPI(this.app as unknown as Parameters<typeof getAPI>[0], this.manifest);
		if (!this.api) {
			return;
		}

		this.obsidianInterface = new ObsidianImpl(this.app, this);
		this.server = new ObsidianMcpServer(this.obsidianInterface, this.manifest);

		this.api.addRoute("/mcp").post(async (request, response) => {
			try {
				await this.server.handleStreamingRequest(request, response);
			} catch (error) {
				this.errorResponse(response, error);
			}
		});

		if (this.settings.enableSSE) {
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
	}

	async loadSettings() {
		const savedData = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);

		// Migration: Enable SSE for existing users who don't have this setting yet
		// New users will get the default value (false)
		if (savedData && Object.keys(savedData).length > 0 && savedData.enableSSE === undefined) {
			this.settings.enableSSE = true;
		}

		logger.getVerboseSetting = () => this.settings.verboseLogging;
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new MCPSettingTab(this.app, this, this.obsidianInterface));
		if (this.hasLocalRestApi) {
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
	interface Workspace {
		on(name: "obsidian-local-rest-api:loaded", callback: () => void, ctx?: unknown): EventRef;
	}
}
