import { Plugin } from "obsidian";
import { ObsidianMcpServer } from "mcp_server";
import { DEFAULT_SETTINGS, MCPPluginSettings } from "./settings/types";
import { MCPSettingTab } from "./settings/tab";
import type { Response } from "express";
import { logger } from "./tools/logging";
import type { ObsidianInterface } from "./obsidian/obsidian_interface";
import { ObsidianImpl } from "./obsidian/obsidian_impl";
import { ServerManager } from "./server/server_manager";

export default class ObsidianMCPPlugin extends Plugin {
	private serverManager: ServerManager | null = null;
	private mcpServer: ObsidianMcpServer | null = null;
	public settings: MCPPluginSettings;
	public obsidianInterface: ObsidianInterface | null = null;

	private errorResponse(response: Response, error: Error) {
		logger.logError("Error handling MCP request:", error);
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
		this.obsidianInterface = new ObsidianImpl(this.app, this);
		this.mcpServer = new ObsidianMcpServer(this.obsidianInterface, this.manifest);

		const serverManager = this.getServerManager();

		serverManager.addRoute("/mcp").post(async (request, response) => {
			try {
				await this.mcpServer!.handleHttpRequest(request, response);
			} catch (error) {
				this.errorResponse(response, error);
			}
		});
	}

	async loadSettings() {
		const savedData = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);

		// Migration: Add server settings for existing users
		if (savedData && !savedData.server) {
			this.settings.server = DEFAULT_SETTINGS.server;
		}

		logger.getVerboseSetting = () => this.settings.verboseLogging;
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async onload() {
		await this.loadSettings();

		await this.registerRoutes();

		this.addSettingTab(new MCPSettingTab(this.app, this, this.obsidianInterface!));

		// Defer starting the server until Obsidian is fully loaded
		this.app.workspace.onLayoutReady(async () => {
			if (!this.settings.server.enabled) {
				logger.log("[MCP Server] Server disabled in settings");
				return;
			}

			try {
				await this.getServerManager().start();
			} catch (error) {
				logger.logError("Failed to start MCP server:", error);
			}
		});
	}

	async onunload() {
		if (this.serverManager) {
			await this.serverManager.stop();
		}
		if (this.mcpServer) {
			await this.mcpServer.close();
		}
	}

	public getServerManager(): ServerManager {
		if (!this.serverManager) {
			this.serverManager = new ServerManager(this.settings);
		}
		return this.serverManager;
	}
}
