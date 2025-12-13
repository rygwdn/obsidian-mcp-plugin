import ObsidianMCPPlugin from "../main";
import { createMcpButton, createCopyableCode } from "./ui_components";
import { Notice, Modal, Setting, App } from "obsidian";
import { AuthToken, DirectoryRule } from "./types";
import { showDirectoryTreeModal } from "./directory_tree_modal";
import { logger } from "../tools/logging";

interface TokenUIState {
	selectedTokenId: string | null;
	isCreatingNew: boolean;
	newTokenName: string;
}

export function createAuthSection(plugin: ObsidianMCPPlugin, containerEl: HTMLElement): void {
	const state: TokenUIState = {
		selectedTokenId: null,
		isCreatingNew: false,
		newTokenName: "",
	};

	// Header with create button
	const headerEl = containerEl.createDiv({ cls: "mcp-token-header-section" });
	headerEl.createEl("h2", { text: "Authentication Tokens" });

	createMcpButton(headerEl, {
		text: "Create Token",
		additionalClasses: "mcp-button-primary",
		onClick: async () => {
			state.isCreatingNew = true;
			state.selectedTokenId = null;
			state.newTokenName = "";
			updateSection();
		},
	});

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
}

function updateWarning(plugin: ObsidianMCPPlugin, container: HTMLElement): void {
	container.empty();
	if (plugin.settings.server.tokens.length === 0) {
		const warningEl = container.createDiv({ cls: "mcp-warning" });
		warningEl.createEl("p", {
			text: "⚠️ No authentication tokens configured. The server will not start until you create at least one token. Create a token below to enable the server.",
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
			cls: `mcp-token-row ${state.selectedTokenId === token.id ? "mcp-token-selected" : ""}`,
		});

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

		// Token name
		const nameEl = tokenEl.createDiv({ cls: "mcp-token-name" });
		nameEl.createEl("strong", { text: token.name });

		// Token value with copy
		const keyEl = tokenEl.createDiv({ cls: "mcp-token-key" });
		const prefix = token.token.substring(0, 8);
		const suffix = token.token.substring(token.token.length - 8);
		keyEl.createEl("code", { text: `${prefix}...${suffix}` });

		const copyButton = createMcpButton(keyEl, {
			text: "📋",
			additionalClasses: "mcp-token-copy-btn",
			onClick: (e) => {
				e.stopPropagation();
				navigator.clipboard.writeText(token.token).then(() => {
					copyButton.setText("✓");
					setTimeout(() => {
						copyButton.setText("📋");
					}, 2000);
				});
			},
		});

		// Feature icons in same order as config section
		const featuresEl = tokenEl.createDiv({ cls: "mcp-token-features" });

		// Icon mapping in display order
		const toolsInOrder = [
			{ key: "file_access", icon: "📄", title: "File Access" },
			{ key: "update_content", icon: "✏️", title: "Content Modification" },
			{ key: "search", icon: "🔍", title: "Vault Search" },
			{ key: "dataview_query", icon: "📊", title: "Dataview Integration" },
			{ key: "quickadd", icon: "⚡", title: "QuickAdd Integration" },
			{ key: "tasknotes", icon: "✅", title: "TaskNotes Integration" },
			{ key: "timeblocks", icon: "📅", title: "Timeblocks Integration" },
		];

		for (const tool of toolsInOrder) {
			if (token.enabledTools[tool.key as keyof typeof token.enabledTools]) {
				featuresEl.createSpan({
					text: tool.icon,
					cls: "mcp-token-feature-icon",
					attr: { title: tool.title },
				});
			}
		}

		// Actions
		const actionsEl = tokenEl.createDiv({ cls: "mcp-token-row-actions" });

		createMcpButton(actionsEl, {
			text: "🗑",
			additionalClasses: "mcp-button-danger mcp-icon-button",
			onClick: async (e) => {
				e.stopPropagation();
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
	});
}

function updateConfigSection(
	plugin: ObsidianMCPPlugin,
	containerEl: HTMLElement,
	state: TokenUIState,
	updateSection: () => void
): void {
	containerEl.empty();
	containerEl.removeClass("mcp-token-config-visible");

	if (state.isCreatingNew) {
		containerEl.addClass("mcp-token-config-visible");
		renderCreateTokenConfig(plugin, containerEl, state, updateSection);
	} else if (state.selectedTokenId) {
		const token = plugin.settings.server.tokens.find((t) => t.id === state.selectedTokenId);
		if (token) {
			containerEl.addClass("mcp-token-config-visible");
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

	// Features (using default settings as template)
	const tempToken: AuthToken = {
		id: "temp",
		name: state.newTokenName,
		token: "",
		createdAt: Date.now(),
		enabledTools: {
			file_access: true,
			update_content: true,
			search: true,
			dataview_query: true,
			quickadd: true,
			tasknotes: false,
			timeblocks: false,
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

			const authManager = plugin.getServerManager().getAuthManager();
			const newToken = authManager.createToken(state.newTokenName);

			// Apply the configured settings
			newToken.enabledTools = tempToken.enabledTools;
			newToken.directoryPermissions = tempToken.directoryPermissions;

			await plugin.saveSettings();
			state.isCreatingNew = false;
			state.selectedTokenId = null;
			updateSection();

			// Auto-start server if enabled and this is the first token
			if (plugin.settings.server.enabled && plugin.settings.server.tokens.length === 1) {
				try {
					await plugin.getServerManager().start();
					new Notice("Server started automatically");
				} catch (error) {
					logger.logError("Failed to auto-start server after token creation:", error);
				}
			}

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
	// Header with name and timestamp
	const headerEl = containerEl.createDiv({ cls: "mcp-token-config-header" });
	headerEl.createEl("h3", { text: `Configure: ${token.name}` });

	const timestampEl = headerEl.createDiv({ cls: "mcp-token-config-timestamp" });
	timestampEl.createEl("span", {
		text: `Created: ${new Date(token.createdAt).toLocaleString()}`,
		cls: "setting-item-description",
	});
	if (token.lastUsed) {
		timestampEl.createEl("span", {
			text: ` | Last used: ${new Date(token.lastUsed).toLocaleString()}`,
			cls: "setting-item-description",
		});
	}

	// Example configuration at top with copy button
	const exampleSection = containerEl.createDiv({ cls: "mcp-token-example-section" });
	exampleSection.createEl("h4", { text: "Client Configuration" });

	// Token display with copy button
	const copyContainer = exampleSection.createDiv({ cls: "mcp-token-copy-container" });
	copyContainer.createEl("span", { text: "Token: ", cls: "setting-item-description" });

	copyContainer.createEl("code", {
		text: token.token,
		cls: "mcp-token-display-value",
	});

	const copyButton = createMcpButton(copyContainer, {
		text: "📋 Copy Full Token",
		additionalClasses: "mcp-button-secondary",
		onClick: () => {
			navigator.clipboard.writeText(token.token).then(() => {
				copyButton.setText("✓ Copied!");
				setTimeout(() => {
					copyButton.setText("📋 Copy Full Token");
				}, 2000);
			});
		},
	});

	// Example config (no longer collapsible)
	const exampleContent = exampleSection.createDiv({ cls: "mcp-example-content" });
	addTokenExampleConfig(plugin, exampleContent, token);

	// Add Cursor install button
	addCursorInstallButton(plugin, exampleSection, token);

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
			await plugin.saveSettings();
			new Notice("Token configuration updated");
			updateSection();
		},
	});
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
		.setName("📄 File Access")
		.setDesc("Enable reading files, listing directories, and retrieving file metadata")
		.addToggle((toggle) =>
			toggle.setValue(token.enabledTools.file_access).onChange((value) => {
				token.enabledTools.file_access = value;
			})
		);

	const updateSetting = new Setting(containerEl)
		.setName("✏️ Content Modification")
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
		.setName("🔍 Vault Search")
		.setDesc("Search for text in vault files")
		.addToggle((toggle) =>
			toggle.setValue(token.enabledTools.search).onChange((value) => {
				token.enabledTools.search = value;
			})
		);

	const isDataviewEnabled = plugin.app.plugins.enabledPlugins.has("dataview");
	const dataviewSetting = new Setting(containerEl)
		.setName("📊 Dataview Integration")
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
		.setName("⚡ QuickAdd Integration")
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

	const isTaskNotesEnabled = plugin.app.plugins.enabledPlugins.has("tasknotes");
	const taskNotesSetting = new Setting(containerEl)
		.setName("✅ TaskNotes Integration")
		.setDesc(
			isTaskNotesEnabled
				? "Query and manage tasks across your vault"
				: "TaskNotes plugin is not enabled"
		);

	taskNotesSetting.addToggle((toggle) =>
		toggle
			.setValue(isTaskNotesEnabled && token.enabledTools.tasknotes)
			.setDisabled(!isTaskNotesEnabled)
			.onChange((value) => {
				token.enabledTools.tasknotes = value;
			})
	);

	// Timeblocks requires TaskNotes plugin and daily notes
	const hasDailyNotes =
		plugin.app.internalPlugins.plugins["daily-notes"]?.enabled ||
		plugin.app.plugins.enabledPlugins.has("periodic-notes");
	const hasTaskNotes = plugin.app.plugins.enabledPlugins.has("tasknotes");
	const isTimeblocksEnabled = hasDailyNotes && hasTaskNotes;

	const timeblocksSetting = new Setting(containerEl)
		.setName("📅 Timeblocks Integration")
		.setDesc(
			isTimeblocksEnabled
				? "Manage timeblocks in daily notes (TaskNotes format)"
				: !hasDailyNotes
					? "Requires Daily Notes or Periodic Notes plugin"
					: "Requires TaskNotes plugin"
		);

	timeblocksSetting.addToggle((toggle) =>
		toggle
			.setValue(isTimeblocksEnabled && token.enabledTools.timeblocks)
			.setDisabled(!isTimeblocksEnabled)
			.onChange((value) => {
				token.enabledTools.timeblocks = value;
			})
	);
}

function renderDirectoriesConfig(
	plugin: ObsidianMCPPlugin,
	containerEl: HTMLElement,
	token: AuthToken,
	_updateSection: () => void
): void {
	containerEl.createEl("h4", { text: "Directory Access" });
	containerEl.createEl("p", {
		text: "Configure which directories this token can access. Rules are applied in order.",
		cls: "setting-item-description",
	});

	const rootPermSetting = new Setting(containerEl)
		.setName("Root Permission")
		.setDesc("Default permission for all files not covered by rules below");

	// Store reference to button for updates
	const updateRootPermButton = (button: HTMLButtonElement) => {
		button.setText(token.directoryPermissions.rootPermission ? "Allowed" : "Denied");
		button.removeClass("mcp-allowed", "mcp-blocked");
		button.addClass(token.directoryPermissions.rootPermission ? "mcp-allowed" : "mcp-blocked");
	};

	const rootPermButton = createMcpButton(rootPermSetting.controlEl, {
		text: token.directoryPermissions.rootPermission ? "Allowed" : "Denied",
		additionalClasses: token.directoryPermissions.rootPermission
			? "mcp-toggle-button mcp-allowed"
			: "mcp-toggle-button mcp-blocked",
		onClick: () => {
			token.directoryPermissions.rootPermission = !token.directoryPermissions.rootPermission;
			updateRootPermButton(rootPermButton);
		},
	});

	// Directory rules list
	const rulesContainer = containerEl.createDiv({ cls: "mcp-directory-rules-list" });
	const updateRulesList = () =>
		renderDirectoryRulesList(plugin, rulesContainer, token, updateRulesList);
	updateRulesList();

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
				updateRulesList();
			});
		},
	});
}

function renderDirectoryRulesList(
	plugin: ObsidianMCPPlugin,
	containerEl: HTMLElement,
	token: AuthToken,
	updateRulesList: () => void
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

			updateRulesList();
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

		const updateToggleButton = (button: HTMLButtonElement) => {
			button.setText(rule.allowed ? "Allow" : "Block");
			button.removeClass("mcp-allowed", "mcp-blocked");
			button.addClass(rule.allowed ? "mcp-allowed" : "mcp-blocked");
		};

		const toggleButton = createMcpButton(toggleContainer, {
			text: rule.allowed ? "Allow" : "Block",
			additionalClasses: ["mcp-toggle-button", rule.allowed ? "mcp-allowed" : "mcp-blocked"],
			onClick: () => {
				rule.allowed = !rule.allowed;
				updateToggleButton(toggleButton);
			},
		});

		// Remove button
		const removeContainer = rowEl.createDiv({ cls: "mcp-button-container" });
		createMcpButton(removeContainer, {
			text: "Remove",
			additionalClasses: "mcp-remove-directory-button",
			onClick: () => {
				token.directoryPermissions.rules.splice(index, 1);
				updateRulesList();
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
	// Use port 27126 for HTTPS, otherwise use configured port (default 27125)
	const port = plugin.settings.server.httpsEnabled ? 27126 : plugin.settings.server.port;
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

function generateCursorInstallLink(httpEndpointUrl: string, authToken: string): string {
	const config = {
		url: httpEndpointUrl,
		headers: {
			Authorization: `Bearer ${authToken}`,
		},
	};

	const configJson = JSON.stringify(config);
	const configBase64 = btoa(configJson);
	const serverName = "obsidian-mcp";

	return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(serverName)}&config=${encodeURIComponent(configBase64)}`;
}

function addCursorInstallButton(
	plugin: ObsidianMCPPlugin,
	container: HTMLElement,
	token: AuthToken
): void {
	const protocol = plugin.settings.server.httpsEnabled ? "https" : "http";
	const host = plugin.settings.server.host || "127.0.0.1";
	// Use port 27126 for HTTPS, otherwise use configured port (default 27125)
	const port = plugin.settings.server.httpsEnabled ? 27126 : plugin.settings.server.port;
	const httpEndpointUrl = `${protocol}://${host}:${port}/mcp`;

	const buttonContainer = container.createDiv({ cls: "mcp-button-container" });
	buttonContainer.style.marginTop = "1rem";

	createMcpButton(buttonContainer, {
		text: "Add to Cursor",
		additionalClasses: "mcp-button-primary",
		onClick: () => {
			const cursorLink = generateCursorInstallLink(httpEndpointUrl, token.token);
			window.open(cursorLink, "_self");
		},
	});
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
			text: `Token Name: ${this.token.name}`,
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
