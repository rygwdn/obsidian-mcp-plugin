import ObsidianMCPPlugin from "../main";
import {
	createSection,
	createButtonSetting,
	createMcpButton,
	createCopyableCode,
	createCollapsibleDetailsSection,
} from "./ui_components";
import { Notice, Modal, Setting, App } from "obsidian";
import { TokenPermission, AuthToken, DirectoryRule } from "./types";
import { showDirectoryTreeModal } from "./directory_tree_modal";

interface TokenUIState {
	selectedTokenId: string | null;
	isCreatingNew: boolean;
	newTokenName: string;
	newTokenPermissions: TokenPermission[];
}

export function createAuthSection(plugin: ObsidianMCPPlugin, containerEl: HTMLElement): void {
	createSection(containerEl, "Authentication");

	const state: TokenUIState = {
		selectedTokenId: null,
		isCreatingNew: false,
		newTokenName: "",
		newTokenPermissions: [TokenPermission.READ],
	};

	// Warning container (will be updated dynamically)
	const warningContainer = containerEl.createDiv();

	// Token list
	const tokenListEl = containerEl.createDiv({ cls: "mcp-token-list" });

	// Configuration section (shown when token is selected or creating new)
	const configSectionEl = containerEl.createDiv({ cls: "mcp-token-config-section" });

	const updateSection = () => {
		updateWarning(plugin, warningContainer);
		updateTokenList(plugin, tokenListEl, state, updateSection);
		updateConfigSection(plugin, configSectionEl, state, updateSection);
	};

	updateSection();

	// Add token button
	createButtonSetting({
		containerEl: containerEl,
		name: "Create New Token",
		desc: "Generate a new authentication token with specific permissions",
		buttonText: "Create Token",
		onClick: async () => {
			state.isCreatingNew = true;
			state.selectedTokenId = null;
			state.newTokenName = "";
			state.newTokenPermissions = [TokenPermission.READ];
			updateSection();
		},
	});
}

function updateWarning(plugin: ObsidianMCPPlugin, container: HTMLElement): void {
	container.empty();
	if (plugin.settings.server.tokens.length === 0) {
		const warningEl = container.createDiv({ cls: "mcp-warning" });
		warningEl.createEl("p", {
			text: "⚠️ No authentication tokens configured. The server will deny all requests. Create at least one token to enable access.",
			cls: "mcp-warning-text",
		});
	}
}

function updateTokenList(
	plugin: ObsidianMCPPlugin,
	containerEl: HTMLElement,
	state: TokenUIState,
	updateSection: () => void
): void {
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
		const tokenEl = containerEl.createDiv({
			cls: `mcp-token-item ${state.selectedTokenId === token.id ? "mcp-token-selected" : ""}`,
		});

		const headerEl = tokenEl.createDiv({ cls: "mcp-token-header" });
		headerEl.createEl("strong", { text: token.name });

		// Make the token clickable to select/deselect
		tokenEl.addEventListener("click", (e) => {
			// Don't select if clicking on buttons or interactive elements
			if (
				e.target instanceof HTMLButtonElement ||
				(e.target instanceof HTMLElement && e.target.closest("button"))
			) {
				return;
			}

			if (state.selectedTokenId === token.id) {
				state.selectedTokenId = null;
			} else {
				state.selectedTokenId = token.id;
				state.isCreatingNew = false;
			}
			updateSection();
		});

		// Token value display with copy button
		const tokenValueEl = tokenEl.createDiv({ cls: "mcp-token-value-container" });
		const prefix = token.token.substring(0, 8);
		const suffix = token.token.substring(token.token.length - 8);
		tokenValueEl.createEl("code", {
			text: `${prefix}...${suffix}`,
			cls: "mcp-token-value-display",
		});

		const copyButton = createMcpButton(tokenValueEl, {
			text: "📋 Copy",
			onClick: () => {
				navigator.clipboard.writeText(token.token).then(() => {
					copyButton.setText("✓ Copied!");
					setTimeout(() => {
						copyButton.setText("📋 Copy");
					}, 2000);
				});
			},
		});

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
			text: state.selectedTokenId === token.id ? "Hide Config" : "Configure",
			onClick: async () => {
				if (state.selectedTokenId === token.id) {
					state.selectedTokenId = null;
				} else {
					state.selectedTokenId = token.id;
					state.isCreatingNew = false;
				}
				updateSection();
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
					state.selectedTokenId = null;
					updateSection();
					new Notice("Token deleted");
				}
			},
		});

		// Add example configuration in collapsible section
		const detailsEl = createCollapsibleDetailsSection(tokenEl, "Example Configuration");
		addTokenExampleConfig(plugin, detailsEl, token);
	});
}

function updateConfigSection(
	plugin: ObsidianMCPPlugin,
	containerEl: HTMLElement,
	state: TokenUIState,
	updateSection: () => void
): void {
	containerEl.empty();

	if (state.isCreatingNew) {
		renderCreateTokenConfig(plugin, containerEl, state, updateSection);
	} else if (state.selectedTokenId) {
		const token = plugin.settings.server.tokens.find((t) => t.id === state.selectedTokenId);
		if (token) {
			renderEditTokenConfig(plugin, containerEl, token, updateSection);
		}
	}
}

function renderCreateTokenConfig(
	plugin: ObsidianMCPPlugin,
	containerEl: HTMLElement,
	state: TokenUIState,
	updateSection: () => void
): void {
	containerEl.addClass("mcp-token-config-visible");

	containerEl.createEl("h3", { text: "Create New Token" });

	// Token name
	new Setting(containerEl).setName("Token Name").addText((text) =>
		text
			.setPlaceholder("e.g., My MCP Client")
			.setValue(state.newTokenName)
			.onChange((value) => {
				state.newTokenName = value;
			})
	);

	// Permissions
	renderPermissionsConfig(containerEl, state.newTokenPermissions, (permissions) => {
		state.newTokenPermissions = permissions;
	});

	// Features (using default settings as template)
	const tempToken: AuthToken = {
		id: "temp",
		name: state.newTokenName,
		token: "",
		permissions: state.newTokenPermissions,
		createdAt: Date.now(),
		enabledTools: {
			file_access: true,
			update_content: true,
			search: true,
			dataview_query: true,
			quickadd: true,
		},
		directoryPermissions: {
			rules: [],
			rootPermission: true,
		},
	};

	renderFeaturesConfig(plugin, containerEl, tempToken);
	renderDirectoriesConfig(plugin, containerEl, tempToken, updateSection);

	// Create/Cancel buttons
	const buttonContainer = containerEl.createDiv({ cls: "mcp-token-config-buttons" });

	createMcpButton(buttonContainer, {
		text: "Cancel",
		onClick: () => {
			state.isCreatingNew = false;
			updateSection();
		},
	});

	createMcpButton(buttonContainer, {
		text: "Create Token",
		additionalClasses: "mcp-button-primary",
		onClick: async () => {
			if (!state.newTokenName.trim()) {
				new Notice("Token name is required");
				return;
			}
			if (state.newTokenPermissions.length === 0) {
				new Notice("At least one permission is required");
				return;
			}

			const authManager = plugin.getServerManager().getAuthManager();
			const newToken = authManager.createToken(state.newTokenName, state.newTokenPermissions);

			// Apply the configured settings
			newToken.enabledTools = tempToken.enabledTools;
			newToken.directoryPermissions = tempToken.directoryPermissions;

			await plugin.saveSettings();
			state.isCreatingNew = false;
			state.selectedTokenId = null;
			updateSection();

			// Show token to user (only time they'll see it)
			new TokenDisplayModal(plugin.app, newToken).open();
		},
	});
}

function renderEditTokenConfig(
	plugin: ObsidianMCPPlugin,
	containerEl: HTMLElement,
	token: AuthToken,
	updateSection: () => void
): void {
	containerEl.addClass("mcp-token-config-visible");

	containerEl.createEl("h3", { text: `Configure: ${token.name}` });

	// Permissions
	renderPermissionsConfig(containerEl, token.permissions, (permissions) => {
		token.permissions = permissions;
	});

	// Features
	renderFeaturesConfig(plugin, containerEl, token);

	// Directories
	renderDirectoriesConfig(plugin, containerEl, token, updateSection);

	// Save button
	const buttonContainer = containerEl.createDiv({ cls: "mcp-token-config-buttons" });

	createMcpButton(buttonContainer, {
		text: "Save Changes",
		additionalClasses: "mcp-button-primary",
		onClick: async () => {
			if (token.permissions.length === 0) {
				new Notice("At least one permission is required");
				return;
			}
			await plugin.saveSettings();
			new Notice("Token configuration updated");
			updateSection();
		},
	});
}

function renderPermissionsConfig(
	containerEl: HTMLElement,
	permissions: TokenPermission[],
	onChange: (permissions: TokenPermission[]) => void
): void {
	const permSetting = new Setting(containerEl)
		.setName("Permissions")
		.setDesc("Select the permissions this token should have");

	const checkboxContainer = permSetting.controlEl.createDiv();

	const readCheckbox = checkboxContainer.createEl("label");
	readCheckbox.addClass("mcp-checkbox-label");
	const readInput = readCheckbox.createEl("input", { type: "checkbox" });
	readInput.checked = permissions.includes(TokenPermission.READ);
	readInput.addEventListener("change", () => {
		if (readInput.checked) {
			if (!permissions.includes(TokenPermission.READ)) {
				permissions.push(TokenPermission.READ);
			}
		} else {
			const index = permissions.indexOf(TokenPermission.READ);
			if (index > -1) {
				permissions.splice(index, 1);
			}
		}
		onChange(permissions);
	});
	readCheckbox.createSpan({ text: " Read" });

	checkboxContainer.createEl("br");

	const writeCheckbox = checkboxContainer.createEl("label");
	writeCheckbox.addClass("mcp-checkbox-label");
	const writeInput = writeCheckbox.createEl("input", { type: "checkbox" });
	writeInput.checked = permissions.includes(TokenPermission.WRITE);
	writeInput.addEventListener("change", () => {
		if (writeInput.checked) {
			if (!permissions.includes(TokenPermission.WRITE)) {
				permissions.push(TokenPermission.WRITE);
			}
		} else {
			const index = permissions.indexOf(TokenPermission.WRITE);
			if (index > -1) {
				permissions.splice(index, 1);
			}
		}
		onChange(permissions);
	});
	writeCheckbox.createSpan({ text: " Write" });
}

function renderFeaturesConfig(
	plugin: ObsidianMCPPlugin,
	containerEl: HTMLElement,
	token: AuthToken
): void {
	containerEl.createEl("h4", { text: "Features" });
	containerEl.createEl("p", {
		text: "Enable or disable specific tools for this token",
		cls: "setting-item-description",
	});

	new Setting(containerEl)
		.setName("File Access")
		.setDesc("Enable reading files, listing directories, and retrieving file metadata")
		.addToggle((toggle) =>
			toggle.setValue(token.enabledTools.file_access).onChange((value) => {
				token.enabledTools.file_access = value;
			})
		);

	const updateSetting = new Setting(containerEl)
		.setName("Content Modification")
		.setDesc("Enable modifying file content");

	updateSetting.descEl.createSpan({
		text: " ⚠️ Allows direct changes to vault",
		cls: "mcp-warning-text",
	});

	updateSetting.addToggle((toggle) =>
		toggle.setValue(token.enabledTools.update_content).onChange((value) => {
			token.enabledTools.update_content = value;
		})
	);

	new Setting(containerEl)
		.setName("Vault Search")
		.setDesc("Search for text in vault files")
		.addToggle((toggle) =>
			toggle.setValue(token.enabledTools.search).onChange((value) => {
				token.enabledTools.search = value;
			})
		);

	const isDataviewEnabled = plugin.app.plugins.enabledPlugins.has("dataview");
	const dataviewSetting = new Setting(containerEl)
		.setName("Dataview Integration")
		.setDesc(isDataviewEnabled ? "Execute Dataview queries" : "Dataview plugin is not enabled");

	dataviewSetting.addToggle((toggle) =>
		toggle
			.setValue(isDataviewEnabled && token.enabledTools.dataview_query)
			.setDisabled(!isDataviewEnabled)
			.onChange((value) => {
				token.enabledTools.dataview_query = value;
			})
	);

	const isQuickAddEnabled = plugin.app.plugins.enabledPlugins.has("quickadd");
	const quickAddSetting = new Setting(containerEl)
		.setName("QuickAdd Integration")
		.setDesc(
			isQuickAddEnabled ? "Execute QuickAdd macros and choices" : "QuickAdd plugin is not enabled"
		);

	if (isQuickAddEnabled) {
		quickAddSetting.descEl.createSpan({
			text: " ⚠️ Allows direct changes to vault",
			cls: "mcp-warning-text",
		});
	}

	quickAddSetting.addToggle((toggle) =>
		toggle
			.setValue(isQuickAddEnabled && token.enabledTools.quickadd)
			.setDisabled(!isQuickAddEnabled)
			.onChange((value) => {
				token.enabledTools.quickadd = value;
			})
	);
}

function renderDirectoriesConfig(
	plugin: ObsidianMCPPlugin,
	containerEl: HTMLElement,
	token: AuthToken,
	updateSection: () => void
): void {
	containerEl.createEl("h4", { text: "Directory Access" });
	containerEl.createEl("p", {
		text: "Configure which directories this token can access. Rules are applied in order.",
		cls: "setting-item-description",
	});

	new Setting(containerEl)
		.setName("Root Permission")
		.setDesc("Default permission for all files not covered by rules below")
		.addToggle((toggle) =>
			toggle.setValue(token.directoryPermissions.rootPermission).onChange((value) => {
				token.directoryPermissions.rootPermission = value;
			})
		);

	// Directory rules list
	const rulesContainer = containerEl.createDiv({ cls: "mcp-directory-rules-list" });
	renderDirectoryRulesList(plugin, rulesContainer, token, updateSection);

	// Add rule button
	const addButtonContainer = containerEl.createDiv({ cls: "mcp-add-directory-container" });
	createMcpButton(addButtonContainer, {
		text: "Add Directory Rule",
		additionalClasses: "mcp-add-directory-button",
		onClick: async () => {
			showDirectoryTreeModal(plugin.app, async (action, path) => {
				if (action === "cancel" || !path) {
					return;
				}

				token.directoryPermissions.rules.push({
					path: path,
					allowed: action === "allow",
				});
				updateSection();
			});
		},
	});
}

function renderDirectoryRulesList(
	plugin: ObsidianMCPPlugin,
	containerEl: HTMLElement,
	token: AuthToken,
	updateSection: () => void
): void {
	containerEl.empty();

	const rules = token.directoryPermissions.rules;

	if (rules.length === 0) {
		containerEl.createEl("p", {
			text: "No directory rules configured. All files follow the root permission.",
			cls: "setting-item-description",
		});
		return;
	}

	let draggedRule: DirectoryRule | null = null;
	let hoveredOverRule: DirectoryRule | null = null;

	rules.forEach((rule, index) => {
		const rowEl = containerEl.createDiv({ cls: "mcp-directory-row" });

		// Drag handle
		const dragHandle = rowEl.createSpan({ cls: "mcp-drag-handle" });
		dragHandle.innerHTML = "⋮⋮";
		dragHandle.setAttribute("draggable", "true");

		dragHandle.addEventListener("dragstart", () => {
			draggedRule = rule;
			hoveredOverRule = null;
			rowEl.addClass("dragging");
		});

		dragHandle.addEventListener("dragend", () => {
			draggedRule = null;
			hoveredOverRule = null;
			rowEl.removeClass("dragging");
		});

		rowEl.addEventListener("dragover", (event) => {
			event.preventDefault();

			if (!draggedRule || draggedRule === rule || hoveredOverRule === rule) {
				return;
			}

			hoveredOverRule = rule;

			const draggedIndex = rules.indexOf(draggedRule);
			if (draggedIndex === -1) return;

			rules.splice(draggedIndex, 1);
			const targetIndex = rules.indexOf(rule);
			if (targetIndex === -1) {
				rules.splice(draggedIndex, 0, draggedRule);
				return;
			}

			const insertIndex =
				targetIndex < draggedIndex ? targetIndex : Math.min(targetIndex + 1, rules.length);
			rules.splice(insertIndex, 0, draggedRule);

			updateSection();
		});

		rowEl.addEventListener("drop", (event) => {
			event.preventDefault();
		});

		// Path display
		rowEl.createSpan({
			text: rule.path,
			cls: "mcp-directory-path",
		});

		// Toggle button
		const toggleContainer = rowEl.createDiv({ cls: "mcp-button-container" });
		createMcpButton(toggleContainer, {
			text: rule.allowed ? "Allow" : "Block",
			additionalClasses: ["mcp-toggle-button", rule.allowed ? "mcp-allowed" : "mcp-blocked"],
			onClick: () => {
				rule.allowed = !rule.allowed;
				updateSection();
			},
		});

		// Remove button
		const removeContainer = rowEl.createDiv({ cls: "mcp-button-container" });
		createMcpButton(removeContainer, {
			text: "Remove",
			additionalClasses: "mcp-remove-directory-button",
			onClick: () => {
				token.directoryPermissions.rules.splice(index, 1);
				updateSection();
			},
		});
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
		type: "http",
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
