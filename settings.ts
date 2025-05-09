import { App, PluginSettingTab, Setting } from "obsidian";
import ObsidianMCPPlugin from "./main";

export interface MCPPluginSettings {
	promptsFolder: string;
	toolNamePrefix: string;
	vaultDescription: string;
	enabledTools: {
		list_files: boolean;
		get_file_contents: boolean;
		append_content: boolean;
		search: boolean;
		replace_content: boolean;
		dataview_query: boolean;
	};
	enableResources: boolean;
	enablePrompts: boolean;
}

export const DEFAULT_SETTINGS: MCPPluginSettings = {
	promptsFolder: "prompts",
	toolNamePrefix: "vault",
	vaultDescription: "",
	enabledTools: {
		list_files: true,
		get_file_contents: true,
		append_content: true,
		search: true,
		replace_content: true,
		dataview_query: true,
	},
	enableResources: true,
	enablePrompts: true,
};

export class MCPSettingTab extends PluginSettingTab {
	plugin: ObsidianMCPPlugin;

	constructor(app: App, plugin: ObsidianMCPPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "MCP Plugin Settings" });

		// Check if the Local REST API plugin is installed and enabled
		const isLocalRestApiEnabled =
			this.plugin.app.plugins.enabledPlugins.has("obsidian-local-rest-api");

		if (!isLocalRestApiEnabled) {
			const warningEl = containerEl.createEl("div", { cls: "mcp-warning" });
			warningEl.createEl("p", {
				text: "⚠️ The Local REST API plugin is not installed or enabled. This plugin requires Local REST API to function properly.",
				cls: "mcp-warning-text",
			});

			const installLink = warningEl.createEl("a", {
				text: "Install or enable the Local REST API plugin",
				href: "obsidian://show-plugin?id=obsidian-local-rest-api",
			});

			// Add some space after the warning
			containerEl.createEl("hr");
		}

		// Basic Settings
		containerEl.createEl("h3", { text: "Basic Settings" });

		new Setting(containerEl)
			.setName("Tool Name Prefix")
			.setDesc("Prefix for all tool names (e.g., 'vault_list_files' if prefix is 'vault')")
			.addText((text) =>
				text
					.setPlaceholder("vault")
					.setValue(this.plugin.settings.toolNamePrefix)
					.onChange(async (value) => {
						this.plugin.settings.toolNamePrefix = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Vault Description")
			.setDesc("Description of your vault to include in MCP server instructions")
			.addTextArea((text) => {
				text
					.setPlaceholder("Describe your vault and its structure...")
					.setValue(this.plugin.settings.vaultDescription)
					.onChange(async (value) => {
						this.plugin.settings.vaultDescription = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 4;
				text.inputEl.cols = 50;
			});

		new Setting(containerEl)
			.setName("Prompts Folder")
			.setDesc("Folder path where your prompts are stored (relative to vault root)")
			.addText((text) =>
				text
					.setPlaceholder("prompts")
					.setValue(this.plugin.settings.promptsFolder)
					.onChange(async (value) => {
						this.plugin.settings.promptsFolder = value;
						await this.plugin.saveSettings();
					})
			);

		// Feature toggles
		containerEl.createEl("h3", { text: "Features" });

		new Setting(containerEl)
			.setName("Enable Resources")
			.setDesc("Allow access to vault files as resources")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.enableResources).onChange(async (value) => {
					this.plugin.settings.enableResources = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Enable Prompts")
			.setDesc("Make prompts available from the prompts folder")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.enablePrompts).onChange(async (value) => {
					this.plugin.settings.enablePrompts = value;
					await this.plugin.saveSettings();
				})
			);

		// Tools section
		containerEl.createEl("h3", { text: "Tools" });

		// Check for dataview plugin
		const isDataviewEnabled = this.plugin.app.plugins.enabledPlugins.has("dataview");

		// Tool toggles
		new Setting(containerEl)
			.setName("List Files Tool")
			.setDesc("List files and directories in your vault")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.enabledTools.list_files).onChange(async (value) => {
					this.plugin.settings.enabledTools.list_files = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Get File Contents Tool")
			.setDesc("Read contents of files in your vault")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabledTools.get_file_contents)
					.onChange(async (value) => {
						this.plugin.settings.enabledTools.get_file_contents = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Search Tool")
			.setDesc("Search for text in your vault files")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.enabledTools.search).onChange(async (value) => {
					this.plugin.settings.enabledTools.search = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Append Content Tool")
			.setDesc("Append content to files in your vault")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabledTools.append_content)
					.onChange(async (value) => {
						this.plugin.settings.enabledTools.append_content = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Replace Content Tool")
			.setDesc("Replace content in files in your vault")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabledTools.replace_content)
					.onChange(async (value) => {
						this.plugin.settings.enabledTools.replace_content = value;
						await this.plugin.saveSettings();
					})
			);

		const dataviewSetting = new Setting(containerEl)
			.setName("Dataview Query Tool")
			.setDesc("Execute Dataview queries in your vault");

		if (!isDataviewEnabled) {
			dataviewSetting.setDesc(
				"Execute Dataview queries in your vault (Dataview plugin is not enabled)"
			);
			dataviewSetting.descEl.createSpan({ text: " — ", cls: "mcp-warning-text" });
			dataviewSetting.descEl.createSpan({
				text: "Requires Dataview plugin",
				cls: "mcp-warning-text",
			});
		}

		dataviewSetting.addToggle((toggle) => {
			toggle
				.setValue(isDataviewEnabled && this.plugin.settings.enabledTools.dataview_query)
				.setDisabled(!isDataviewEnabled)
				.onChange(async (value) => {
					this.plugin.settings.enabledTools.dataview_query = value;
					await this.plugin.saveSettings();
				});
		});

		// Information
		containerEl.createEl("h3", { text: "Information" });

		const infoDiv = containerEl.createDiv();
		infoDiv.createEl("p", {
			text: "Files in your vault can be accessed as MCP resources when Resources are enabled.",
		});
		infoDiv.createEl("p", {
			text: "Markdown files in the prompts folder are automatically available as prompts when Prompts are enabled.",
		});
	}
}
