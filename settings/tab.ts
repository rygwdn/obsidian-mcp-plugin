import { App, PluginSettingTab } from "obsidian";
import ObsidianMCPPlugin from "../main";
import {
	createSection,
	createTextAreaSetting,
	createTextSetting,
	createRequiredPluginWarning,
} from "./ui_components";
import { createConnectionInfoSection } from "./connection_ui";
import { createPromptsInstructions } from "./prompts_ui";
import { addFeaturesSection } from "./tools_ui";

export class MCPSettingTab extends PluginSettingTab {
	plugin: ObsidianMCPPlugin;
	containerEl: HTMLElement;

	constructor(app: App, plugin: ObsidianMCPPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		this.containerEl = containerEl;
		containerEl.empty();
		containerEl.addClass("mcp-settings-container");

		containerEl.createEl("h1", { text: "MCP Plugin Settings" });

		const isLocalRestApiEnabled =
			this.plugin.app.plugins.enabledPlugins.has("obsidian-local-rest-api");
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
			desc: "Prefix for all tool names (e.g., 'vault_list_files' if prefix is 'vault')",
			placeholder: "vault",
			getValue: () => this.plugin.settings.toolNamePrefix,
			setValue: (value) => (this.plugin.settings.toolNamePrefix = value),
			saveSettings: () => this.plugin.saveSettings(),
		});
	}
}
