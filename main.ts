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
	private serverManager: ServerManager;
	private mcpServer: ObsidianMcpServer;
	public settings: MCPPluginSettings;
	public obsidianInterface: ObsidianInterface;

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

		this.serverManager.addRoute("/mcp").post(async (request, response) => {
			try {
				await this.mcpServer.handleStreamingRequest(request, response);
			} catch (error) {
				this.errorResponse(response, error);
			}
		});

		if (this.settings.enableSSE) {
			this.serverManager.addRoute("/messages").post(async (request, response) => {
				try {
					await this.mcpServer.handleSseRequest(request, response);
				} catch (error) {
					this.errorResponse(response, error);
				}
			});

			this.serverManager.addRoute("/sse").get(async (request, response) => {
				try {
					await this.mcpServer.handleSseRequest(request, response);
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

		this.serverManager = new ServerManager(this.settings);
		this.addSettingTab(new MCPSettingTab(this.app, this, this.obsidianInterface));

		await this.registerRoutes();

		try {
			await this.serverManager.start();
		} catch (error) {
			logger.logError("Failed to start MCP server:", error);
		}
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
		return this.serverManager;
	}
}
