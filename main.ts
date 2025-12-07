import type { Response } from "express";
import { Plugin } from "obsidian";

import type { ObsidianInterface } from "./obsidian/obsidian_interface";
import { ObsidianImpl } from "./obsidian/obsidian_impl";
import { ObsidianMcpServer } from "mcp_server";
import { ServerManager } from "./server/server_manager";
import { TokenTracker } from "./server/connection_tracker";
import { logger } from "./tools/logging";
import { DEFAULT_SETTINGS, type MCPPluginSettings } from "./settings/types";
import { MCPSettingTab } from "./settings/tab";

export default class ObsidianMCPPlugin extends Plugin {
	private serverManager: ServerManager | null = null;
	private mcpServer: ObsidianMcpServer | null = null;
	public settings: MCPPluginSettings;
	public obsidianInterface: ObsidianInterface | null = null;
	public tokenTracker: TokenTracker;

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
		const serverManager = this.getServerManager();
		this.mcpServer = new ObsidianMcpServer(this.obsidianInterface, this.manifest);

		serverManager.addRoute("/mcp").all(async (request, response) => {
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
		if (this.serverManager) {
			this.serverManager.updateSettings(this.settings);
		}
	}

	async onload() {
		await this.loadSettings();

		this.tokenTracker = new TokenTracker();
		logger.tokenTracker = this.tokenTracker;

		await this.registerRoutes();

		this.addSettingTab(new MCPSettingTab(this.app, this, this.obsidianInterface!));

		// Defer starting the server until Obsidian is fully loaded
		this.app.workspace.onLayoutReady(async () => {
			if (!this.settings.server.enabled) {
				logger.log("[MCP Server] Server disabled in settings");
				return;
			}

			if (this.settings.server.tokens.length === 0) {
				logger.log("[MCP Server] Server requires at least one authentication token to start");
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
			this.serverManager = new ServerManager(this.settings, this.tokenTracker);
		}
		return this.serverManager;
	}
}
