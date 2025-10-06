import ObsidianMCPPlugin from "../main";
import {
	createSection,
	createTextAreaSetting,
	createTextSetting,
	createToggleSetting,
	createButtonSetting,
} from "./ui_components";
import { createConnectionInfoSection } from "./connection_ui";
import { createPromptsInstructions } from "./prompts_ui";
import { addFeaturesSection } from "./tools_ui";
import { createDirectoryPermissionsSection } from "./directory_permissions_ui";
import { createAuthSection } from "./auth_ui";
import type { ObsidianInterface } from "../obsidian/obsidian_interface";
import { App, Notice, PluginSettingTab } from "obsidian";

export class MCPSettingTab extends PluginSettingTab {
	containerEl: HTMLElement;

	constructor(
		app: App,
		private plugin: ObsidianMCPPlugin,
		public obsidian: ObsidianInterface
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		this.containerEl = containerEl;
		containerEl.empty();
		containerEl.addClass("mcp-settings-container");

		createConnectionInfoSection(this.plugin, containerEl);
		this.addServerSettings();
		createAuthSection(this.plugin, containerEl);
		this.addBasicSettings();
		this.addPromptsSettings();
		addFeaturesSection(this.plugin, containerEl);
		createDirectoryPermissionsSection(this.plugin, containerEl);
		this.addAdvancedSection();
	}

	private addServerSettings(): void {
		createSection(this.containerEl, "Server Configuration");

		const statusEl = this.containerEl.createDiv({ cls: "mcp-server-status" });
		this.updateServerStatus(statusEl);

		createToggleSetting({
			containerEl: this.containerEl,
			name: "Enable Server",
			desc: "Enable the MCP server",
			getValue: () => this.plugin.settings.server.enabled,
			setValue: async (value) => {
				this.plugin.settings.server.enabled = value;
				await this.plugin.saveSettings();
				const serverManager = this.plugin.getServerManager();
				if (value) {
					await serverManager.start();
				} else {
					await serverManager.stop();
				}
				this.updateServerStatus(statusEl);
			},
			saveSettings: async () => {
				// Saving is handled in setValue
			},
		});

		createTextSetting({
			containerEl: this.containerEl,
			name: "Port",
			desc: "Port number for the MCP server",
			placeholder: "27123",
			getValue: () => this.plugin.settings.server.port.toString(),
			setValue: async (value) => {
				const port = parseInt(value, 10);
				if (isNaN(port) || port < 1 || port > 65535) {
					new Notice("Invalid port number");
					return;
				}
				this.plugin.settings.server.port = port;
				await this.plugin.saveSettings();
				await this.plugin.getServerManager().restart();
				this.updateServerStatus(statusEl);
			},
			saveSettings: async () => {
				// Saving is handled in setValue
			},
		});

		createTextSetting({
			containerEl: this.containerEl,
			name: "Host",
			desc: "Host address to bind to (127.0.0.1 for localhost only)",
			placeholder: "127.0.0.1",
			getValue: () => this.plugin.settings.server.host,
			setValue: async (value) => {
				this.plugin.settings.server.host = value;
				await this.plugin.saveSettings();
				await this.plugin.getServerManager().restart();
				this.updateServerStatus(statusEl);
			},
			saveSettings: async () => {
				// Saving is handled in setValue
			},
		});

		createToggleSetting({
			containerEl: this.containerEl,
			name: "Enable HTTPS",
			desc: "Use HTTPS with self-signed certificate (recommended for MCP)",
			getValue: () => this.plugin.settings.server.httpsEnabled,
			setValue: async (value) => {
				this.plugin.settings.server.httpsEnabled = value;
				await this.plugin.saveSettings();
				await this.plugin.getServerManager().restart();
				this.updateServerStatus(statusEl);
			},
			saveSettings: async () => {
				// Saving is handled in setValue
			},
		});

		if (this.plugin.settings.server.httpsEnabled) {
			this.addCertificateSettings(statusEl);
		}
	}

	private addCertificateSettings(statusEl: HTMLElement): void {
		const certInfo = this.plugin.getServerManager().getCertificateInfo();

		if (certInfo) {
			const certStatusEl = this.containerEl.createDiv({
				cls: "mcp-cert-status setting-item-description",
			});
			certStatusEl.style.marginLeft = "48px";
			certStatusEl.style.marginTop = "-10px";

			if (certInfo.daysRemaining < 0) {
				certStatusEl.addClass("mcp-warning");
				certStatusEl.setText(`⚠️ Certificate expired ${Math.abs(certInfo.daysRemaining)} days ago`);
			} else if (certInfo.daysRemaining < 30) {
				certStatusEl.addClass("mcp-warning");
				certStatusEl.setText(`⚠️ Certificate expires in ${certInfo.daysRemaining} days`);
			} else {
				certStatusEl.setText(`Certificate valid until ${certInfo.notAfter.toLocaleDateString()}`);
			}
		}

		createButtonSetting({
			containerEl: this.containerEl,
			name: "Regenerate Certificate",
			desc: "Generate a new self-signed certificate",
			buttonText: "Regenerate",
			onClick: async () => {
				const serverManager = this.plugin.getServerManager();
				this.plugin.settings.server.crypto = serverManager.generateCertificate();
				await this.plugin.saveSettings();
				await serverManager.restart();
				new Notice("Certificate regenerated successfully");
				this.updateServerStatus(statusEl);
				this.display();
			},
		});

		if (this.app.plugins.enabledPlugins.has("obsidian-local-rest-api")) {
			createButtonSetting({
				containerEl: this.containerEl,
				name: "Import Certificate from Local REST API",
				desc: "Import existing certificate from the Local REST API plugin",
				buttonText: "Import",
				onClick: async () => {
					const serverManager = this.plugin.getServerManager();
					const cert = serverManager.importCertificateFromLocalRestApi(this.app.plugins.plugins);
					if (cert) {
						this.plugin.settings.server.crypto = cert;
						await this.plugin.saveSettings();
						await serverManager.restart();
						new Notice("Certificate imported successfully");
						this.updateServerStatus(statusEl);
						this.display();
					} else {
						new Notice("Failed to import certificate");
					}
				},
			});
		}

		createTextAreaSetting({
			containerEl: this.containerEl,
			name: "Subject Alternative Names",
			desc: "Additional hostnames or IPs for the certificate (one per line)",
			placeholder: "myhost.local\n192.168.1.100",
			getValue: () => this.plugin.settings.server.subjectAltNames,
			setValue: async (value) => {
				this.plugin.settings.server.subjectAltNames = value;
			},
			saveSettings: async () => {
				await this.plugin.saveSettings();
				new Notice("Subject Alternative Names saved. Regenerate certificate to apply changes.");
			},
		});
	}

	private updateServerStatus(statusEl: HTMLElement): void {
		const serverManager = this.plugin.getServerManager();
		statusEl.empty();

		if (serverManager.isRunning()) {
			statusEl.addClass("mcp-server-running");
			statusEl.removeClass("mcp-server-stopped");
			const url = serverManager.getServerUrl();
			statusEl.createEl("span", {
				text: `✓ Server running at ${url}`,
				cls: "mcp-success-text",
			});
		} else {
			statusEl.addClass("mcp-server-stopped");
			statusEl.removeClass("mcp-server-running");
			statusEl.createEl("span", {
				text: "⚠ Server not running",
				cls: "mcp-warning-text",
			});
		}
	}

	private addBasicSettings(): void {
		createSection(this.containerEl, "Basic Settings");

		createTextAreaSetting({
			containerEl: this.containerEl,
			name: "Vault Description",
			desc: "Description of your vault to include in MCP server instructions",
			placeholder: "This vault contains personal notes...",
			getValue: () => this.plugin.settings.vaultDescription,
			setValue: (value) => (this.plugin.settings.vaultDescription = value),
			saveSettings: () => this.plugin.saveSettings(),
		});
	}

	private addPromptsSettings(): void {
		createSection(this.containerEl, "Prompts");

		createTextSetting({
			containerEl: this.containerEl,
			name: "Prompts Folder",
			desc: "Folder path where your prompts are stored (relative to vault root)",
			placeholder: "prompts",
			getValue: () => this.plugin.settings.promptsFolder,
			setValue: (value) => (this.plugin.settings.promptsFolder = value),
			saveSettings: () => this.plugin.saveSettings(),
		});

		createPromptsInstructions(this.containerEl);
	}

	private addAdvancedSection(): void {
		createSection(this.containerEl, "Advanced");

		createTextSetting({
			containerEl: this.containerEl,
			name: "Tool Name Prefix",
			desc: "Optional prefix for all tool names",
			placeholder: "vault",
			getValue: () => this.plugin.settings.toolNamePrefix,
			setValue: (value) => {
				this.plugin.settings.toolNamePrefix = value;
				updateExampleText(value);
			},
			saveSettings: () => this.plugin.saveSettings(),
		});

		const exampleContainer = this.containerEl.createEl("div", {
			cls: "setting-item-description",
			attr: { style: "margin-top: -10px; margin-left: 48px; font-style: italic;" },
		});

		const updateExampleText = (prefix: string) => {
			const exampleTool = prefix ? `${prefix}_search` : "search";
			exampleContainer.setText(`Example: "${exampleTool}" (${prefix ? "with" : "without"} prefix)`);
		};

		updateExampleText(this.plugin.settings.toolNamePrefix);

		createToggleSetting({
			containerEl: this.containerEl,
			name: "Enable SSE Endpoints",
			desc: "Enable Server-Sent Events endpoints (/sse and /messages) for backward compatibility with older MCP clients",
			getValue: () => this.plugin.settings.enableSSE,
			setValue: (value) => (this.plugin.settings.enableSSE = value),
			saveSettings: () => this.plugin.saveSettings(),
		});

		createToggleSetting({
			containerEl: this.containerEl,
			name: "Verbose Logging",
			desc: "Enable detailed logging in console (useful for debugging, but can be noisy)",
			getValue: () => this.plugin.settings.verboseLogging,
			setValue: (value) => (this.plugin.settings.verboseLogging = value),
			saveSettings: () => this.plugin.saveSettings(),
		});
	}
}
