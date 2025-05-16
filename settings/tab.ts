import ObsidianMCPPlugin from "../main";
import {
	createSection,
	createTextAreaSetting,
	createTextSetting,
	createToggleSetting,
	createRequiredPluginWarning,
} from "./ui_components";
import { createConnectionInfoSection } from "./connection_ui";
import { createPromptsInstructions } from "./prompts_ui";
import { addFeaturesSection } from "./tools_ui";
import { createDirectoryPermissionsSection } from "./directory_permissions_ui";
import type { ObsidianInterface } from "../obsidian/obsidian_interface";
import { App, PluginSettingTab } from "obsidian";

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

		const isLocalRestApiEnabled = this.plugin.hasLocalRestApi;
		createRequiredPluginWarning(
			containerEl,
			isLocalRestApiEnabled,
			"obsidian-local-rest-api",
			"Local REST API"
		);

		createConnectionInfoSection(this.app, containerEl);

		this.addBasicSettings();
		this.addPromptsSettings();
		addFeaturesSection(this.plugin, containerEl);
		createDirectoryPermissionsSection(this.plugin, containerEl);
		this.addAdvancedSection();
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
			name: "Verbose Logging",
			desc: "Enable detailed logging in console (useful for debugging, but can be noisy)",
			getValue: () => this.plugin.settings.verboseLogging,
			setValue: (value) => (this.plugin.settings.verboseLogging = value),
			saveSettings: () => this.plugin.saveSettings(),
		});
	}
}
