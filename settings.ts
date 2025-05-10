import { App, PluginSettingTab, Setting } from "obsidian";
import ObsidianMCPPlugin from "./main";
import { isDailyNotesEnabled } from "tools/daily_notes";

export interface MCPPluginSettings {
	promptsFolder: string;
	toolNamePrefix: string;
	vaultDescription: string;
	enabledTools: {
		list_files: boolean;
		get_file_contents: boolean;
		search: boolean;
		update_content: boolean;
		dataview_query: boolean;
		daily_notes: boolean;
		get_file_metadata: boolean;
	};
	enableResources: boolean;
	enablePrompts: boolean;
}

export const DEFAULT_SETTINGS: MCPPluginSettings = {
	promptsFolder: "prompts",
	toolNamePrefix: "vault",
	vaultDescription:
		"This vault contains personal notes on various topics including work projects, research, and daily journals. It's organized with folders for each major area and uses tags for cross-referencing.",
	enabledTools: {
		list_files: true,
		get_file_contents: true,
		search: true,
		update_content: true,
		dataview_query: true,
		daily_notes: true,
		get_file_metadata: true,
	},
	enableResources: true,
	enablePrompts: true,
};

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
		this.createRequiredPluginWarning(
			isLocalRestApiEnabled,
			"obsidian-local-rest-api",
			"Local REST API"
		);

		this.addBasicSettings();
		this.addPromptsSettings();
		this.addToolsSection();
		this.addAdvancedSection();
	}

	private addBasicSettings(): void {
		this.createSection("Basic Settings");

		this.createTextAreaSetting({
			name: "Vault Description",
			desc: "Description of your vault to include in MCP server instructions",
			placeholder: DEFAULT_SETTINGS.vaultDescription,
			getValue: () => this.plugin.settings.vaultDescription,
			setValue: (value) => (this.plugin.settings.vaultDescription = value),
		});
	}

	private addPromptsSettings(): void {
		this.createToggleSetting({
			name: "Enable Prompts",
			desc: "Make prompts available from the prompts folder. Markdown files in the prompts folder are automatically available as prompts when enabled.",
			getValue: () => this.plugin.settings.enablePrompts,
			setValue: (value) => (this.plugin.settings.enablePrompts = value),
		});

		this.createTextSetting({
			name: "Prompts Folder",
			desc: "Folder path where your prompts are stored (relative to vault root)",
			placeholder: "prompts",
			getValue: () => this.plugin.settings.promptsFolder,
			setValue: (value) => (this.plugin.settings.promptsFolder = value),
		});

		this.addCollapsiblePromptsInstructions();
	}

	private addCollapsiblePromptsInstructions(): void {
		const detailsEl = this.containerEl.createEl("details", { cls: "mcp-collapsible" });

		const promptsInfoDiv = detailsEl.createDiv({ cls: "mcp-info-box" });

		promptsInfoDiv.createEl("p", {
			text: "Prompts can use frontmatter metadata to customize their behavior:",
		});

		const metadataList = promptsInfoDiv.createEl("ul");
		metadataList.createEl("li", {
			text: "description: Add a description field to explain what the prompt does",
		});
		metadataList.createEl("li", {
			text: "args: Define parameters that can be passed to the prompt (as an array of strings)",
		});
		metadataList.createEl("li", {
			text: "Use {{parameter_name}} in your prompt content to insert parameter values",
		});

		promptsInfoDiv.createEl("p", {
			text: "Example frontmatter:",
		});

		const exampleCode = promptsInfoDiv.createEl("pre");
		exampleCode.createEl("code", {
			text: '---\ndescription: This prompt generates a meeting summary\nargs: ["date", "participants"]\n---\n\nSummarize the meeting held on {{date}} with {{participants}}.',
		});
	}

	private addToolsSection(): void {
		this.createSection("Tools");

		this.createToggleSetting({
			name: "Enable Resources",
			desc: "Allow access to vault files as resources. Files in your vault can be accessed as MCP resources when enabled.",
			getValue: () => this.plugin.settings.enableResources,
			setValue: (value) => (this.plugin.settings.enableResources = value),
		});

		const isDataviewEnabled = this.plugin.app.plugins.enabledPlugins.has("dataview");

		this.createToggleSetting({
			name: "List Files Tool",
			desc: "List files and directories in your vault",
			getValue: () => this.plugin.settings.enabledTools.list_files,
			setValue: (value) => (this.plugin.settings.enabledTools.list_files = value),
		});

		this.createToggleSetting({
			name: "Get File Contents Tool",
			desc: "Read contents of files in your vault",
			getValue: () => this.plugin.settings.enabledTools.get_file_contents,
			setValue: (value) => (this.plugin.settings.enabledTools.get_file_contents = value),
		});

		this.createToggleSetting({
			name: "Search Tool",
			desc: "Search for text in your vault files",
			getValue: () => this.plugin.settings.enabledTools.search,
			setValue: (value) => (this.plugin.settings.enabledTools.search = value),
		});

		this.createToggleSetting({
			name: "Update Content Tool",
			desc: "Update files by appending or replacing content",
			getValue: () => this.plugin.settings.enabledTools.update_content,
			setValue: (value) => (this.plugin.settings.enabledTools.update_content = value),
		});

		this.createToggleSetting({
			name: "File Metadata Tool",
			desc: "Retrieve metadata for files in your vault",
			getValue: () => this.plugin.settings.enabledTools.get_file_metadata,
			setValue: (value) => (this.plugin.settings.enabledTools.get_file_metadata = value),
		});

		this.addDataviewToolSetting(isDataviewEnabled);
		this.addDailyNotesToolSetting(isDailyNotesEnabled(this.plugin.app));
	}

	private addDailyNotesToolSetting(isDailyNotesEnabled: boolean): void {
		const dailyNoteSetting = this.createToggleSetting({
			name: "Daily Notes Features",
			desc: "Enable daily notes tool and resource to access daily notes in your vault",
			getValue: () => isDailyNotesEnabled && this.plugin.settings.enabledTools.daily_notes,
			setValue: (value) => (this.plugin.settings.enabledTools.daily_notes = value),
			disabled: !isDailyNotesEnabled,
		});

		if (!isDailyNotesEnabled) {
			dailyNoteSetting.setDesc(
				"Enable daily notes tool and resource (Daily Notes plugin is not enabled)"
			);
			dailyNoteSetting.descEl.createSpan({ text: " — ", cls: "mcp-warning-text" });
			dailyNoteSetting.descEl.createSpan({
				text: "Requires Daily Notes or Periodic Notes plugin",
				cls: "mcp-warning-text",
			});
		}
	}

	private addAdvancedSection(): void {
		this.createSection("Advanced");

		this.createTextSetting({
			name: "Tool Name Prefix",
			desc: "Prefix for all tool names (e.g., 'vault_list_files' if prefix is 'vault')",
			placeholder: "vault",
			getValue: () => this.plugin.settings.toolNamePrefix,
			setValue: (value) => (this.plugin.settings.toolNamePrefix = value),
		});
	}

	private addDataviewToolSetting(isDataviewEnabled: boolean): void {
		const dataviewSetting = this.createToggleSetting({
			name: "Dataview Query Tool",
			desc: "Execute Dataview queries in your vault",
			getValue: () => isDataviewEnabled && this.plugin.settings.enabledTools.dataview_query,
			setValue: (value) => (this.plugin.settings.enabledTools.dataview_query = value),
			disabled: !isDataviewEnabled,
		});

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
	}

	private createSection(title: string): void {
		this.containerEl.createEl("h2", { text: title, cls: "mcp-settings-heading" });
	}

	private createInfoBox(title?: string): HTMLElement {
		const infoDiv = this.containerEl.createDiv({ cls: "mcp-info-box" });
		if (title) {
			infoDiv.createEl("h4", { text: title });
		}
		return infoDiv;
	}

	private createRequiredPluginWarning(
		isInstalled: boolean,
		pluginId: string,
		pluginName: string
	): void {
		if (!isInstalled) {
			const warningEl = this.containerEl.createEl("div", { cls: "mcp-warning" });
			warningEl.createEl("p", {
				text: `⚠️ The ${pluginName} plugin is not installed or enabled. This plugin requires ${pluginName} to function properly.`,
				cls: "mcp-warning-text",
			});

			warningEl.createEl("a", {
				text: `Install or enable the ${pluginName} plugin`,
				href: `obsidian://show-plugin?id=${pluginId}`,
			});

			this.containerEl.createEl("hr");
		}
	}

	private createTextSetting({
		name,
		desc,
		placeholder,
		getValue,
		setValue,
	}: {
		name: string;
		desc: string;
		placeholder: string;
		getValue: () => string;
		setValue: (value: string) => void;
	}): Setting {
		return new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((text) =>
				text
					.setPlaceholder(placeholder)
					.setValue(getValue())
					.onChange(async (value) => {
						setValue(value);
						await this.plugin.saveSettings();
					})
			);
	}

	private createTextAreaSetting({
		name,
		desc,
		placeholder,
		getValue,
		setValue,
		rows = 4,
		cols = 50,
	}: {
		name: string;
		desc: string;
		placeholder: string;
		getValue: () => string;
		setValue: (value: string) => void;
		rows?: number;
		cols?: number;
	}): Setting {
		return new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addTextArea((text) => {
				text
					.setPlaceholder(placeholder)
					.setValue(getValue())
					.onChange(async (value) => {
						setValue(value);
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = rows;
				text.inputEl.cols = cols;
			});
	}

	private createToggleSetting({
		name,
		desc,
		getValue,
		setValue,
		disabled = false,
	}: {
		name: string;
		desc: string;
		getValue: () => boolean;
		setValue: (value: boolean) => void;
		disabled?: boolean;
	}): Setting {
		const setting = new Setting(this.containerEl).setName(name).setDesc(desc);

		setting.addToggle((toggle) => {
			toggle
				.setValue(getValue())
				.setDisabled(disabled)
				.onChange(async (value) => {
					setValue(value);
					await this.plugin.saveSettings();
				});
		});

		return setting;
	}
}
