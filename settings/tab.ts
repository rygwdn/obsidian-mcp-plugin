import ObsidianMCPPlugin from "../main";
import {
	createSection,
	createTextAreaSetting,
	createTextSetting,
	createToggleSetting,
	createButtonSetting,
} from "./ui_components";
import { createPromptsInstructions } from "./prompts_ui";
import { createAuthSection } from "./auth_ui";
import type { ObsidianInterface } from "../obsidian/obsidian_interface";
import { App, Notice, PluginSettingTab, Setting } from "obsidian";

export class MCPSettingTab extends PluginSettingTab {
	containerEl: HTMLElement;
	private activeTab: "tokens" | "server" | "vault" | "advanced" = "tokens";

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

		// Create tab navigation
		const tabNavEl = containerEl.createDiv({ cls: "mcp-tab-nav" });
		this.createTabButton(tabNavEl, "tokens", "Tokens");
		this.createTabButton(tabNavEl, "server", "Server");
		this.createTabButton(tabNavEl, "vault", "Vault");
		this.createTabButton(tabNavEl, "advanced", "Advanced");

		// Create tab content container
		const tabContentEl = containerEl.createDiv({ cls: "mcp-tab-content" });

		// Render active tab
		this.renderActiveTab(tabContentEl);
	}

	private createTabButton(
		container: HTMLElement,
		tabId: "tokens" | "server" | "vault" | "advanced",
		label: string
	): void {
		const button = container.createEl("button", {
			text: label,
			cls: `mcp-tab-button ${this.activeTab === tabId ? "mcp-tab-button-active" : ""}`,
		});

		button.addEventListener("click", () => {
			this.activeTab = tabId;
			this.display();
		});
	}

	private renderActiveTab(container: HTMLElement): void {
		switch (this.activeTab) {
			case "tokens":
				this.renderTokensTab(container);
				break;
			case "server":
				this.renderServerTab(container);
				break;
			case "vault":
				this.renderVaultTab(container);
				break;
			case "advanced":
				this.renderAdvancedTab(container);
				break;
		}
	}

	private renderTokensTab(container: HTMLElement): void {
		createAuthSection(this.plugin, container);
	}

	private renderServerTab(container: HTMLElement): void {
		this.addServerSettings(container);
	}

	private renderVaultTab(container: HTMLElement): void {
		this.addBasicSettings(container);
		this.addPromptsSettings(container);
	}

	private renderAdvancedTab(container: HTMLElement): void {
		this.addAdvancedSection(container);
	}

	private addServerSettings(container: HTMLElement): void {
		createSection(container, "Server Configuration");

		const statusEl = container.createDiv({ cls: "mcp-server-status" });
		this.updateServerStatus(statusEl);

		// Show message if no tokens exist
		if (this.plugin.settings.server.tokens.length === 0) {
			const messageEl = container.createDiv({ cls: "mcp-server-message" });
			messageEl.style.marginBottom = "1rem";
			messageEl.style.padding = "0.75rem";
			messageEl.style.backgroundColor = "var(--background-modifier-border)";
			messageEl.style.borderRadius = "4px";
			messageEl.createEl("p", {
				text: "ℹ️ The server will start automatically once you create an authentication token. Go to the 'Tokens' tab to create your first token.",
				cls: "setting-item-description",
			});
		}

		createToggleSetting({
			containerEl: container,
			name: "Enable Server",
			desc: "Enable the MCP server (requires at least one authentication token)",
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
				this.display(); // Refresh to update message
			},
			saveSettings: async () => {
				// Saving is handled in setValue
			},
		});

		createTextSetting({
			containerEl: container,
			name: "Port",
			desc: "Port number for the MCP server (HTTP: 27125, HTTPS: 27126)",
			placeholder: "27125",
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
			containerEl: container,
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
			containerEl: container,
			name: "Enable HTTPS (Experimental)",
			desc: "Use HTTPS with self-signed certificate. Requires manual certificate installation.",
			getValue: () => this.plugin.settings.server.httpsEnabled,
			setValue: async (value) => {
				this.plugin.settings.server.httpsEnabled = value;
				await this.plugin.saveSettings();
				await this.plugin.getServerManager().restart();
				this.display();
			},
			saveSettings: async () => {
				// Saving is handled in setValue
			},
			warningText: " ⚠️ Experimental feature",
		});

		if (this.plugin.settings.server.httpsEnabled) {
			this.addCertificateSettings(container, statusEl);
		}
	}

	private async addCertificateSettings(
		container: HTMLElement,
		statusEl: HTMLElement
	): Promise<void> {
		const certInfo = this.plugin.getServerManager().getCertificateInfo();

		if (certInfo) {
			const certStatusEl = container.createDiv({
				cls: "mcp-cert-status setting-item-description",
			});
			certStatusEl.style.marginLeft = "48px";
			certStatusEl.style.marginTop = "-10px";

			// Check if certificate is trusted
			const isTrusted = await this.checkCertificateTrust();

			if (isTrusted) {
				certStatusEl.createSpan({
					text: "✓ Certificate is trusted by system",
					cls: "mcp-success-text",
				});
				certStatusEl.createEl("br");
			} else {
				certStatusEl.createSpan({
					text: "⚠️ Certificate is not trusted - install it below",
					cls: "mcp-warning-text",
				});
				certStatusEl.createEl("br");
			}

			if (certInfo.daysRemaining < 0) {
				certStatusEl.createSpan({
					text: `Certificate expired ${Math.abs(certInfo.daysRemaining)} days ago`,
					cls: "mcp-warning-text",
				});
			} else if (certInfo.daysRemaining < 30) {
				certStatusEl.createSpan({
					text: `Certificate expires in ${certInfo.daysRemaining} days`,
					cls: "mcp-warning-text",
				});
			} else {
				certStatusEl.createSpan({
					text: `Valid until ${certInfo.notAfter.toLocaleDateString()}`,
				});
			}
		}

		new Setting(container)
			.setName("Install Certificate")
			.setDesc("Install the self-signed certificate to trust HTTPS connections")
			.addButton((button) =>
				button.setButtonText("Download Certificate").onClick(async () => {
					try {
						const cert = this.plugin.settings.server.crypto?.cert;
						if (!cert) {
							new Notice("No certificate available");
							return;
						}

						// Start temporary HTTP server to serve the certificate
						const serverManager = this.plugin.getServerManager();
						const tempPort = await serverManager.serveCertificateTemporarily(cert);

						// Open browser to download the certificate
						const downloadUrl = `http://127.0.0.1:${tempPort}/certificate.pem`;
						// eslint-disable-next-line @typescript-eslint/no-require-imports
						const { shell } = require("electron");
						await shell.openExternal(downloadUrl);

						new Notice(`Certificate available at ${downloadUrl} for 30 seconds`);
					} catch (error) {
						console.error("Error serving certificate:", error);
						new Notice("Failed to serve certificate file");
					}
				})
			);

		// Add OS-specific installation instructions
		const instructionsEl = container.createDiv({ cls: "mcp-cert-instructions" });
		instructionsEl.style.marginLeft = "48px";
		instructionsEl.style.marginTop = "8px";
		instructionsEl.style.fontSize = "0.9em";
		instructionsEl.style.color = "var(--text-muted)";

		const platform = process.platform;
		let instructions = "";

		if (platform === "darwin") {
			instructions = `<strong>macOS:</strong> After downloading, open Keychain Access, then <strong>drag the downloaded certificate file into the "System" keychain</strong> (not "login"). Authenticate with your password. Then, find "Obsidian MCP Plugin" in the System keychain, double-click it, expand "Trust", and set "When using this certificate" to "Always Trust". Authenticate again to save.`;
		} else if (platform === "win32") {
			instructions = `<strong>Windows:</strong> After downloading, right-click the certificate file, select "Install Certificate", choose "Current User" or "Local Machine", select "Place all certificates in the following store", click "Browse" and select "Trusted Root Certification Authorities", then click "Finish".`;
		} else {
			instructions = `<strong>Linux:</strong> After downloading, copy the certificate to /usr/local/share/ca-certificates/ and run: <code>sudo update-ca-certificates</code>`;
		}

		instructionsEl.innerHTML = instructions;

		createButtonSetting({
			containerEl: container,
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

		createTextAreaSetting({
			containerEl: container,
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

	private async checkCertificateTrust(): Promise<boolean> {
		try {
			const protocol = this.plugin.settings.server.httpsEnabled ? "https" : "http";
			const host = this.plugin.settings.server.host || "127.0.0.1";
			const port = this.plugin.settings.server.port;
			const url = `${protocol}://${host}:${port}/mcp`;

			// Try to make a request to the HTTPS endpoint
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", params: {}, id: 1 }),
			});

			// If we get here without error, certificate is trusted
			return response.ok || response.status === 401 || response.status === 403;
		} catch {
			// Certificate trust errors typically manifest as network errors
			return false;
		}
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
			if (this.plugin.settings.server.enabled && this.plugin.settings.server.tokens.length === 0) {
				statusEl.createEl("span", {
					text: "⚠ Server not running - requires at least one authentication token",
					cls: "mcp-warning-text",
				});
			} else if (this.plugin.settings.server.enabled) {
				statusEl.createEl("span", {
					text: "⚠ Server not running",
					cls: "mcp-warning-text",
				});
			} else {
				statusEl.createEl("span", {
					text: "⚠ Server not running - disabled in settings",
					cls: "mcp-warning-text",
				});
			}
		}
	}

	private addBasicSettings(container: HTMLElement): void {
		createSection(container, "Basic Settings");

		createTextAreaSetting({
			containerEl: container,
			name: "Vault Description",
			desc: "Description of your vault to include in MCP server instructions",
			placeholder: "This vault contains personal notes...",
			getValue: () => this.plugin.settings.vaultDescription,
			setValue: (value) => (this.plugin.settings.vaultDescription = value),
			saveSettings: () => this.plugin.saveSettings(),
		});
	}

	private addPromptsSettings(container: HTMLElement): void {
		createSection(container, "Prompts");

		createTextSetting({
			containerEl: container,
			name: "Prompts Folder",
			desc: "Folder path where your prompts are stored (relative to vault root)",
			placeholder: "prompts",
			getValue: () => this.plugin.settings.promptsFolder,
			setValue: (value) => (this.plugin.settings.promptsFolder = value),
			saveSettings: () => this.plugin.saveSettings(),
		});

		createPromptsInstructions(container);
	}

	private addAdvancedSection(container: HTMLElement): void {
		createSection(container, "Advanced");

		createTextSetting({
			containerEl: container,
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

		const exampleContainer = container.createEl("div", {
			cls: "setting-item-description",
			attr: { style: "margin-top: -10px; margin-left: 48px; font-style: italic;" },
		});

		const updateExampleText = (prefix: string) => {
			const exampleTool = prefix ? `${prefix}_search` : "search";
			exampleContainer.setText(`Example: "${exampleTool}" (${prefix ? "with" : "without"} prefix)`);
		};

		updateExampleText(this.plugin.settings.toolNamePrefix);

		createToggleSetting({
			containerEl: container,
			name: "Verbose Logging",
			desc: "Enable detailed logging in console (useful for debugging, but can be noisy)",
			getValue: () => this.plugin.settings.verboseLogging,
			setValue: (value) => (this.plugin.settings.verboseLogging = value),
			saveSettings: () => this.plugin.saveSettings(),
		});
	}
}
