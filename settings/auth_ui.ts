import ObsidianMCPPlugin from "../main";
import { createSection, createButtonSetting, createMcpButton } from "./ui_components";
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
			text: "Edit Permissions",
			onClick: async () => {
				new EditTokenModal(plugin.app, token, async (permissions) => {
					plugin.getServerManager().getAuthManager().updateTokenPermissions(token.id, permissions);
					await plugin.saveSettings();
					updateTokenList(plugin, containerEl);
					new Notice("Token permissions updated");
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
	});
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

class EditTokenModal extends Modal {
	private permissions: TokenPermission[];

	constructor(
		app: App,
		private token: AuthToken,
		private onSubmit: (permissions: TokenPermission[]) => void
	) {
		super(app);
		this.permissions = [...token.permissions];
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: `Edit Token: ${this.token.name}` });

		const permSetting = new Setting(contentEl)
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
						this.onSubmit(this.permissions);
						this.close();
					})
			);
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
