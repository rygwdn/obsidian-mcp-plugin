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
	private activeTab: "tokens" | "server" | "vault" | "debug" = "tokens";
	private debugRefreshInterval: number | null = null;
	private debugContentContainer: HTMLElement | null = null;

	constructor(
		app: App,
		private plugin: ObsidianMCPPlugin,
		public obsidian: ObsidianInterface
	) {
		super(app, plugin);
	}

	hide(): void {
		this.stopDebugRefresh();
		super.hide();
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
		this.createTabButton(tabNavEl, "debug", "Debug");

		// Create tab content container
		const tabContentEl = containerEl.createDiv({ cls: "mcp-tab-content" });

		// Render active tab
		this.renderActiveTab(tabContentEl);
	}

	private createTabButton(
		container: HTMLElement,
		tabId: "tokens" | "server" | "vault" | "debug",
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
		this.stopDebugRefresh();
		this.debugContentContainer = null;

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
			case "debug":
				this.renderDebugTab(container);
				this.startDebugRefresh();
				break;
		}
	}

	private startDebugRefresh(): void {
		this.stopDebugRefresh();
		this.debugRefreshInterval = window.setInterval(() => {
			if (this.activeTab === "debug" && this.debugContentContainer) {
				this.updateDebugContent(this.debugContentContainer);
			}
		}, 500);
	}

	private stopDebugRefresh(): void {
		if (this.debugRefreshInterval !== null) {
			window.clearInterval(this.debugRefreshInterval);
			this.debugRefreshInterval = null;
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
					try {
						await serverManager.start();
					} catch {
						// Error is already stored in ServerManager and will be displayed in status
					}
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

		const portSetting = new Setting(container)
			.setName("Port")
			.setDesc("Port number for the MCP server (HTTP: 27125, HTTPS: 27126)")
			.addText((text) => {
				text
					.setPlaceholder("27125")
					.setValue(this.plugin.settings.server.port.toString())
					.onChange(async (value) => {
						const port = parseInt(value, 10);
						if (isNaN(port) || port < 1 || port > 65535) {
							portSetting.descEl.empty();
							portSetting.descEl.createSpan({
								text: "Port number for the MCP server (HTTP: 27125, HTTPS: 27126)",
							});
							portSetting.descEl.createEl("br");
							portSetting.descEl.createSpan({
								text: "❌ Invalid port number",
								cls: "mcp-error-text",
							});
							new Notice("Invalid port number");
							return;
						}
						this.plugin.settings.server.port = port;
						await this.plugin.saveSettings();

						// Clear any previous error display
						portSetting.descEl.empty();
						portSetting.descEl.createSpan({
							text: "Port number for the MCP server (HTTP: 27125, HTTPS: 27126)",
						});

						try {
							await this.plugin.getServerManager().restart();
							this.updateServerStatus(statusEl);
						} catch (error) {
							const serverManager = this.plugin.getServerManager();
							const lastError = serverManager.getLastError();
							const errorMessage = this.formatServerError(lastError || error);

							portSetting.descEl.empty();
							portSetting.descEl.createSpan({
								text: "Port number for the MCP server (HTTP: 27125, HTTPS: 27126)",
							});
							portSetting.descEl.createEl("br");
							portSetting.descEl.createSpan({
								text: `❌ ${errorMessage}`,
								cls: "mcp-error-text",
							});
							this.updateServerStatus(statusEl);
						}
					});
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
				try {
					await this.plugin.getServerManager().restart();
				} catch {
					// Error is already stored in ServerManager and will be displayed in status
				}
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
				try {
					await this.plugin.getServerManager().restart();
				} catch {
					// Error is already stored in ServerManager and will be displayed in status
				}
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

			// Check for startup errors
			const lastError = serverManager.getLastError();
			if (lastError && this.plugin.settings.server.enabled) {
				const errorMessage = this.formatServerError(lastError);
				statusEl.createEl("span", {
					text: `❌ Server failed to start: ${errorMessage}`,
					cls: "mcp-error-text",
				});
			} else if (
				this.plugin.settings.server.enabled &&
				this.plugin.settings.server.tokens.length === 0
			) {
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

	private formatServerError(error: Error | unknown): string {
		if (!error) {
			return "Unknown error";
		}

		const errorObj = error instanceof Error ? error : new Error(String(error));
		const message = errorObj.message || String(error);

		// Format EADDRINUSE errors more user-friendly
		if (message.includes("EADDRINUSE") || message.includes("address already in use")) {
			const port = this.plugin.settings.server.port;
			return `Port ${port} is already in use. Please choose a different port.`;
		}

		return message;
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

	private renderDebugTab(container: HTMLElement): void {
		createSection(container, "Debug");

		createToggleSetting({
			containerEl: container,
			name: "Verbose Logging",
			desc: "Enable detailed logging in console (useful for debugging, but can be noisy)",
			getValue: () => this.plugin.settings.verboseLogging,
			setValue: (value) => (this.plugin.settings.verboseLogging = value),
			saveSettings: () => this.plugin.saveSettings(),
		});

		createSection(container, "Token Debugging");

		const desc = container.createDiv({ cls: "setting-item-description mcp-debug-description" });
		desc.createSpan({
			text: "View tokens and the actions they've performed. This information is useful for debugging MCP client interactions. The view auto-updates every 500ms.",
		});

		const debugContent = container.createDiv({ cls: "mcp-debug-content" });
		this.debugContentContainer = debugContent;
		this.updateDebugContent(debugContent);

		createButtonSetting({
			containerEl: container,
			name: "Clear Token History",
			desc: "Clear all token history. New tokens will be tracked as they occur.",
			buttonText: "Clear",
			onClick: () => {
				this.plugin.tokenTracker.clear();
				new Notice("Token history cleared");
			},
		});
	}

	private updateDebugContent(container: HTMLElement): void {
		// Save scroll position on the main container (which is what actually scrolls)
		const scrollTop = this.containerEl.scrollTop;

		// Clear and rebuild content
		container.empty();

		const tokens = this.plugin.tokenTracker.getAllTokens(50);

		if (tokens.length === 0) {
			const emptyEl = container.createDiv({ cls: "mcp-debug-empty" });
			emptyEl.createSpan({
				text: "No tokens yet. Tokens will appear here when clients connect to the MCP server.",
			});
			// Restore scroll position after DOM update
			requestAnimationFrame(() => {
				this.containerEl.scrollTop = scrollTop;
			});
			return;
		}

		const tokensList = container.createDiv({ cls: "mcp-debug-connections" });

		for (const token of tokens) {
			const tokenEl = tokensList.createDiv({
				cls: "mcp-debug-connection",
			});

			const header = tokenEl.createDiv({ cls: "mcp-debug-connection-header" });

			const headerLeft = header.createDiv();
			headerLeft.createSpan({
				text: token.tokenName,
				cls: "mcp-debug-connection-id",
			});

			const headerRight = header.createDiv({ cls: "mcp-debug-timestamp" });
			headerRight.createSpan({
				text: `Last activity: ${new Date(token.lastActivityAt).toLocaleString()}`,
			});

			const details = tokenEl.createDiv({ cls: "mcp-debug-connection-details" });

			const timeRow = details.createDiv();
			timeRow.createSpan({ text: "Connected: ", cls: "mcp-debug-label" });
			timeRow.createSpan({
				text: new Date(token.connectedAt).toLocaleString(),
			});

			if (token.actions.length > 0) {
				const actionsHeader = tokenEl.createDiv({ cls: "mcp-debug-actions-header" });
				actionsHeader.createSpan({ text: `Actions (${token.actions.length}):` });

				const actionsList = tokenEl.createDiv({ cls: "mcp-debug-actions" });

				const recentActions = token.actions.slice(-20).reverse();

				for (const action of recentActions) {
					const actionClass = `mcp-debug-action ${
						!action.success ? (action.type === "error" ? "is-error" : "is-warning") : ""
					}`;
					const actionEl = actionsList.createDiv({ cls: actionClass });

					const actionLine = actionEl.createDiv({ cls: "mcp-debug-action-line" });

					const actionLeft = actionLine.createDiv();
					actionLeft.createSpan({
						text: action.type.toUpperCase(),
						cls: "mcp-debug-action-type",
					});

					actionLeft.createSpan({ text: action.name });

					// Add params on same line if non-empty
					if (action.details?.params && Object.keys(action.details.params).length > 0) {
						const paramsText = JSON.stringify(action.details.params);
						const paramsSpan = actionLeft.createSpan({
							cls: "mcp-debug-params-inline",
						});
						paramsSpan.createEl("code", {
							text: ` ${paramsText}`,
						});
					}

					const actionRight = actionLine.createDiv({ cls: "mcp-debug-action-time" });
					actionRight.createSpan({
						text: new Date(action.timestamp).toLocaleTimeString(),
					});

					if (action.duration !== undefined) {
						actionRight.createSpan({
							text: ` (${action.duration.toFixed(0)}ms)`,
							cls: "mcp-debug-duration",
						});
					}

					// Meta row with IP, UA, and Request ID
					if (action.ip || action.userAgent || action.details?.requestId !== undefined) {
						const metaEl = actionEl.createDiv({ cls: "mcp-debug-action-meta" });
						if (action.details?.requestId !== undefined) {
							metaEl.createSpan({
								text: `Request ID: ${action.details.requestId}`,
								cls: "mcp-debug-meta-item",
							});
						}
						if (action.ip) {
							metaEl.createSpan({ text: `IP: ${action.ip}`, cls: "mcp-debug-meta-item" });
						}
						if (action.userAgent) {
							const uaText =
								action.userAgent.length > 60
									? action.userAgent.substring(0, 60) + "..."
									: action.userAgent;
							metaEl.createSpan({
								text: `UA: ${uaText}`,
								cls: "mcp-debug-meta-item",
							});
						}
					}

					if (!action.success && action.error) {
						const errorEl = actionEl.createDiv({ cls: "mcp-debug-action-error" });
						errorEl.createSpan({ text: `Error: ${action.error}` });
					}
				}

				if (token.actions.length > 20) {
					const moreEl = actionsList.createDiv({ cls: "mcp-debug-action-more" });
					moreEl.createSpan({
						text: `... and ${token.actions.length - 20} more actions`,
					});
				}
			} else {
				const noActions = tokenEl.createDiv({ cls: "mcp-debug-no-actions" });
				noActions.createSpan({ text: "No actions recorded" });
			}
		}

		// Restore scroll position after DOM update
		requestAnimationFrame(() => {
			this.containerEl.scrollTop = scrollTop;
		});
	}
}
