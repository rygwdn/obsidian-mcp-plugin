import { App, PluginSettingTab, Setting } from "obsidian";
import ObsidianMCPPlugin from "./main";

export interface MCPPluginSettings {
	promptsFolder: string;
}

export const DEFAULT_SETTINGS: MCPPluginSettings = {
	promptsFolder: "prompts",
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

		containerEl.createEl("h3", { text: "MCP Resources and Prompts" });

		const infoDiv = containerEl.createDiv();
		infoDiv.createEl("p", {
			text: "Files in your vault can be accessed as MCP resources directly.",
		});
		infoDiv.createEl("p", {
			text: "Markdown files in the prompts folder are automatically available as prompts.",
		});
	}
}
