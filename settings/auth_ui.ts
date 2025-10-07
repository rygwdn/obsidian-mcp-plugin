import ObsidianMCPPlugin from "../main";
import {
	createSection,
	createButtonSetting,
	createMcpButton,
	createCopyableCode,
	createCollapsibleDetailsSection,
} from "./ui_components";
import { Notice, Modal, Setting, App } from "obsidian";
import { TokenPermission, AuthToken } from "./types";

export function createAuthSection(plugin: ObsidianMCPPlugin, containerEl: HTMLElement): void {
	createSection(containerEl, "Authentication");

	const authManager = plugin.getServerManager().getAuthManager();

	// Warning if no tokens
	if (plugin.settings.server.tokens.length === 0) {
		const warningEl = containerEl.createDiv({ cls: "mcp-warning" });
		warningEl.createEl("p", {
			text: "⚠️ No authentication tokens configured. The server will deny all requests. Create at least one token to enable access.",
			cls: "mcp-warning-text",
		});
	}

	// Token list
	const tokenListEl = containerEl.createDiv({ cls: "mcp-token-list" });
	updateTokenList(plugin, tokenListEl);

	// Add token button
	createButtonSetting({
		containerEl: containerEl,
		name: "Create New Token",
		desc: "Generate a new authentication token with specific permissions",
		buttonText: "Create Token",
		onClick: async () => {
			new CreateTokenModal(plugin.app, async (name, permissions) => {
				const token = authManager.createToken(name, permissions);
				await plugin.saveSettings();
				updateTokenList(plugin, tokenListEl);

				// Show token to user (only time they'll see it)
				new TokenDisplayModal(plugin.app, token).open();
			}).open();
		},
	});
}

function updateTokenList(plugin: ObsidianMCPPlugin, containerEl: HTMLElement): void {
	containerEl.empty();

	const tokens = plugin.settings.server.tokens;

	if (tokens.length === 0) {
		containerEl.createEl("p", {
			text: "No tokens configured",
			cls: "setting-item-description",
		});
		return;
	}

	tokens.forEach((token) => {
		const tokenEl = containerEl.createDiv({ cls: "mcp-token-item" });

		const headerEl = tokenEl.createDiv({ cls: "mcp-token-header" });
		headerEl.createEl("strong", { text: token.name });

		const permissionsEl = tokenEl.createDiv({ cls: "mcp-token-permissions" });
		permissionsEl.createEl("span", {
			text: `Permissions: ${token.permissions.join(", ")}`,
			cls: "mcp-token-permission-text",
		});

		const metaEl = tokenEl.createDiv({ cls: "mcp-token-meta" });
		metaEl.createEl("span", {
			text: `Created: ${new Date(token.createdAt).toLocaleString()}`,
			cls: "setting-item-description",
		});

		if (token.lastUsed) {
			metaEl.createEl("span", {
				text: ` | Last used: ${new Date(token.lastUsed).toLocaleString()}`,
				cls: "setting-item-description",
			});
		}

		const actionsEl = tokenEl.createDiv({ cls: "mcp-token-actions" });

		createMcpButton(actionsEl, {
			text: "Configure",
			onClick: async () => {
				new ConfigureTokenModal(plugin, token, async () => {
					await plugin.saveSettings();
					updateTokenList(plugin, containerEl);
					new Notice("Token configuration updated");
				}).open();
			},
		});

		createMcpButton(actionsEl, {
			text: "Delete",
			additionalClasses: "mcp-button-danger",
			onClick: async () => {
				if (
					confirm(
						`Are you sure you want to delete the token "${token.name}"? This cannot be undone.`
					)
				) {
					plugin.getServerManager().getAuthManager().deleteToken(token.id);
					await plugin.saveSettings();
					updateTokenList(plugin, containerEl);
					new Notice("Token deleted");
				}
			},
		});

		// Add example configuration in collapsible section
		const detailsEl = createCollapsibleDetailsSection(tokenEl, "Example Configuration");
		addTokenExampleConfig(plugin, detailsEl, token);
	});
}

function addTokenExampleConfig(
	plugin: ObsidianMCPPlugin,
	container: HTMLElement,
	token: AuthToken
): void {
	const protocol = plugin.settings.server.httpsEnabled ? "https" : "http";
	const host = plugin.settings.server.host || "127.0.0.1";
	const port = plugin.settings.server.port;
	const httpEndpointUrl = `${protocol}://${host}:${port}/mcp`;

	const httpConfigJson = {
		type: "streamableHttp",
		url: httpEndpointUrl,
		headers: {
			Authorization: `Bearer ${token.token}`,
		},
	};

	container
		.createDiv({ cls: "mcp-copyable-label" })
		.createEl("span", { text: "HTTP Configuration" });
	createCopyableCode(container, JSON.stringify(httpConfigJson, null, 2));
}

class CreateTokenModal extends Modal {
	private name = "";
	private permissions: TokenPermission[] = [TokenPermission.READ];

	constructor(
		app: App,
		private onSubmit: (name: string, permissions: TokenPermission[]) => void
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Create Authentication Token" });

		new Setting(contentEl).setName("Token Name").addText((text) =>
			text.setPlaceholder("e.g., My MCP Client").onChange((value) => {
				this.name = value;
			})
		);

		const permSetting = new Setting(contentEl)
			.setName("Permissions")
			.setDesc("Select the permissions this token should have");

		const checkboxContainer = permSetting.controlEl.createDiv();

		const readCheckbox = checkboxContainer.createEl("label");
		readCheckbox.addClass("mcp-checkbox-label");
		const readInput = readCheckbox.createEl("input", { type: "checkbox" });
		readInput.checked = true;
		readInput.addEventListener("change", () => {
			if (readInput.checked) {
				if (!this.permissions.includes(TokenPermission.READ)) {
					this.permissions.push(TokenPermission.READ);
				}
			} else {
				this.permissions = this.permissions.filter((p) => p !== TokenPermission.READ);
			}
		});
		readCheckbox.createSpan({ text: " Read" });

		checkboxContainer.createEl("br");

		const writeCheckbox = checkboxContainer.createEl("label");
		writeCheckbox.addClass("mcp-checkbox-label");
		const writeInput = writeCheckbox.createEl("input", { type: "checkbox" });
		writeInput.addEventListener("change", () => {
			if (writeInput.checked) {
				if (!this.permissions.includes(TokenPermission.WRITE)) {
					this.permissions.push(TokenPermission.WRITE);
				}
			} else {
				this.permissions = this.permissions.filter((p) => p !== TokenPermission.WRITE);
			}
		});
		writeCheckbox.createSpan({ text: " Write" });

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => {
					this.close();
				})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Create")
					.setCta()
					.onClick(() => {
						if (!this.name.trim()) {
							new Notice("Token name is required");
							return;
						}
						if (this.permissions.length === 0) {
							new Notice("At least one permission is required");
							return;
						}
						this.onSubmit(this.name, this.permissions);
						this.close();
					})
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ConfigureTokenModal extends Modal {
	private permissions: TokenPermission[];
	private activeTab: "permissions" | "features" | "directories" = "permissions";

	constructor(
		private plugin: ObsidianMCPPlugin,
		private token: AuthToken,
		private onSubmit: () => void
	) {
		super(plugin.app);
		this.permissions = [...token.permissions];
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("mcp-configure-token-modal");

		contentEl.createEl("h2", { text: `Configure Token: ${this.token.name}` });

		// Tab navigation
		const tabNavEl = contentEl.createDiv({ cls: "mcp-tab-nav" });
		this.createTabButton(tabNavEl, "permissions", "Permissions");
		this.createTabButton(tabNavEl, "features", "Features");
		this.createTabButton(tabNavEl, "directories", "Directory Access");

		// Tab content
		const tabContentEl = contentEl.createDiv({ cls: "mcp-modal-tab-content" });
		this.renderActiveTab(tabContentEl);

		// Bottom buttons
		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => {
					this.close();
				})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Save")
					.setCta()
					.onClick(() => {
						if (this.permissions.length === 0) {
							new Notice("At least one permission is required");
							return;
						}
						this.token.permissions = this.permissions;
						this.onSubmit();
						this.close();
					})
			);
	}

	private createTabButton(
		container: HTMLElement,
		tabId: "permissions" | "features" | "directories",
		label: string
	): void {
		const button = container.createEl("button", {
			text: label,
			cls: `mcp-tab-button ${this.activeTab === tabId ? "mcp-tab-button-active" : ""}`,
		});

		button.addEventListener("click", () => {
			this.activeTab = tabId;
			this.onOpen();
		});
	}

	private renderActiveTab(container: HTMLElement): void {
		switch (this.activeTab) {
			case "permissions":
				this.renderPermissionsTab(container);
				break;
			case "features":
				this.renderFeaturesTab(container);
				break;
			case "directories":
				this.renderDirectoriesTab(container);
				break;
		}
	}

	private renderPermissionsTab(container: HTMLElement): void {
		const permSetting = new Setting(container)
			.setName("Permissions")
			.setDesc("Select the permissions this token should have");

		const checkboxContainer = permSetting.controlEl.createDiv();

		const readCheckbox = checkboxContainer.createEl("label");
		readCheckbox.addClass("mcp-checkbox-label");
		const readInput = readCheckbox.createEl("input", { type: "checkbox" });
		readInput.checked = this.permissions.includes(TokenPermission.READ);
		readInput.addEventListener("change", () => {
			if (readInput.checked) {
				if (!this.permissions.includes(TokenPermission.READ)) {
					this.permissions.push(TokenPermission.READ);
				}
			} else {
				this.permissions = this.permissions.filter((p) => p !== TokenPermission.READ);
			}
		});
		readCheckbox.createSpan({ text: " Read" });

		checkboxContainer.createEl("br");

		const writeCheckbox = checkboxContainer.createEl("label");
		writeCheckbox.addClass("mcp-checkbox-label");
		const writeInput = writeCheckbox.createEl("input", { type: "checkbox" });
		writeInput.checked = this.permissions.includes(TokenPermission.WRITE);
		writeInput.addEventListener("change", () => {
			if (writeInput.checked) {
				if (!this.permissions.includes(TokenPermission.WRITE)) {
					this.permissions.push(TokenPermission.WRITE);
				}
			} else {
				this.permissions = this.permissions.filter((p) => p !== TokenPermission.WRITE);
			}
		});
		writeCheckbox.createSpan({ text: " Write" });
	}

	private renderFeaturesTab(container: HTMLElement): void {
		container.createEl("p", {
			text: "Enable or disable specific tools for this token",
			cls: "setting-item-description",
		});

		new Setting(container)
			.setName("File Access")
			.setDesc("Enable reading files, listing directories, and retrieving file metadata")
			.addToggle((toggle) =>
				toggle.setValue(this.token.enabledTools.file_access).onChange((value) => {
					this.token.enabledTools.file_access = value;
				})
			);

		new Setting(container)
			.setName("Content Modification")
			.setDesc("Enable modifying file content ⚠️ Allows direct changes to vault")
			.addToggle((toggle) =>
				toggle.setValue(this.token.enabledTools.update_content).onChange((value) => {
					this.token.enabledTools.update_content = value;
				})
			);

		new Setting(container)
			.setName("Vault Search")
			.setDesc("Search for text in vault files")
			.addToggle((toggle) =>
				toggle.setValue(this.token.enabledTools.search).onChange((value) => {
					this.token.enabledTools.search = value;
				})
			);

		const isDataviewEnabled = this.plugin.app.plugins.enabledPlugins.has("dataview");
		new Setting(container)
			.setName("Dataview Integration")
			.setDesc(isDataviewEnabled ? "Execute Dataview queries" : "Dataview plugin is not enabled")
			.addToggle((toggle) =>
				toggle
					.setValue(isDataviewEnabled && this.token.enabledTools.dataview_query)
					.setDisabled(!isDataviewEnabled)
					.onChange((value) => {
						this.token.enabledTools.dataview_query = value;
					})
			);

		const isQuickAddEnabled = this.plugin.app.plugins.enabledPlugins.has("quickadd");
		new Setting(container)
			.setName("QuickAdd Integration")
			.setDesc(
				isQuickAddEnabled ? "Execute QuickAdd macros and choices" : "QuickAdd plugin is not enabled"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(isQuickAddEnabled && this.token.enabledTools.quickadd)
					.setDisabled(!isQuickAddEnabled)
					.onChange((value) => {
						this.token.enabledTools.quickadd = value;
					})
			);
	}

	private renderDirectoriesTab(container: HTMLElement): void {
		container.createEl("p", {
			text: "Configure which directories this token can access. Rules are applied in order.",
			cls: "setting-item-description",
		});

		new Setting(container)
			.setName("Root Permission")
			.setDesc("Default permission for all files not covered by rules below")
			.addToggle((toggle) =>
				toggle.setValue(this.token.directoryPermissions.rootPermission).onChange((value) => {
					this.token.directoryPermissions.rootPermission = value;
				})
			);

		// Simple rules list display for now
		if (this.token.directoryPermissions.rules.length > 0) {
			container.createEl("h4", { text: "Directory Rules" });
			const rulesList = container.createEl("div", { cls: "mcp-simple-rules-list" });
			this.token.directoryPermissions.rules.forEach((rule) => {
				const ruleEl = rulesList.createEl("div", { cls: "mcp-simple-rule-item" });
				ruleEl.createEl("code", { text: rule.path });
				ruleEl.createEl("span", { text: ` - ${rule.allowed ? "Allowed" : "Blocked"}` });
			});
		} else {
			container.createEl("p", {
				text: "No directory rules configured. All files follow the root permission.",
				cls: "setting-item-description",
			});
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class TokenDisplayModal extends Modal {
	constructor(
		app: App,
		private token: AuthToken
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Token Created Successfully" });

		contentEl.createEl("p", {
			text: "⚠️ Save this token now. You won't be able to see it again!",
			cls: "mcp-warning-text",
		});

		contentEl.createEl("p", {
			text: `Token Name: ${this.token.name}`,
		});

		contentEl.createEl("p", {
			text: `Permissions: ${this.token.permissions.join(", ")}`,
		});

		const tokenContainer = contentEl.createDiv({ cls: "mcp-token-display" });
		tokenContainer.createEl("code", {
			text: this.token.token,
			cls: "mcp-token-value",
		});

		const copyButton = createMcpButton(tokenContainer, {
			text: "📋 Copy Token",
			onClick: () => {
				navigator.clipboard.writeText(this.token.token).then(() => {
					copyButton.setText("✓ Copied!");
					setTimeout(() => {
						copyButton.setText("📋 Copy Token");
					}, 2000);
				});
			},
		});

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Close")
				.setCta()
				.onClick(() => {
					this.close();
				})
		);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
