import { App } from "obsidian";
import ObsidianMCPPlugin from "../main";
import { createSection, createToggleSetting } from "./ui_components";
import * as DailyNoteUtils from "../tools/daily_note_utils";

export function addToolsSection(plugin: ObsidianMCPPlugin, containerEl: HTMLElement): void {
	createSection(containerEl, "Tools");

	createToggleSetting({
		containerEl,
		name: "Enable Resources",
		desc: "Allow access to vault files as resources. Files in your vault can be accessed as MCP resources when enabled.",
		getValue: () => plugin.settings.enableResources,
		setValue: (value) => (plugin.settings.enableResources = value),
		saveSettings: () => plugin.saveSettings(),
	});

	const isDataviewEnabled = plugin.app.plugins.enabledPlugins.has("dataview");
	const isQuickAddEnabled = plugin.app.plugins.enabledPlugins.has("quickadd");

	createToggleSetting({
		containerEl,
		name: "List Files Tool",
		desc: "List files and directories in your vault",
		getValue: () => plugin.settings.enabledTools.list_files,
		setValue: (value) => (plugin.settings.enabledTools.list_files = value),
		saveSettings: () => plugin.saveSettings(),
	});

	createToggleSetting({
		containerEl,
		name: "Get File Contents Tool",
		desc: "Read contents of files in your vault",
		getValue: () => plugin.settings.enabledTools.get_file_contents,
		setValue: (value) => (plugin.settings.enabledTools.get_file_contents = value),
		saveSettings: () => plugin.saveSettings(),
	});

	createToggleSetting({
		containerEl,
		name: "Search Tool",
		desc: "Search for text in your vault files",
		getValue: () => plugin.settings.enabledTools.search,
		setValue: (value) => (plugin.settings.enabledTools.search = value),
		saveSettings: () => plugin.saveSettings(),
	});

	createToggleSetting({
		containerEl,
		name: "Update Content Tool",
		desc: "Update files by appending or replacing content",
		getValue: () => plugin.settings.enabledTools.update_content,
		setValue: (value) => (plugin.settings.enabledTools.update_content = value),
		saveSettings: () => plugin.saveSettings(),
	});

	createToggleSetting({
		containerEl,
		name: "File Metadata Tool",
		desc: "Retrieve metadata for files in your vault",
		getValue: () => plugin.settings.enabledTools.get_file_metadata,
		setValue: (value) => (plugin.settings.enabledTools.get_file_metadata = value),
		saveSettings: () => plugin.saveSettings(),
	});

	addDataviewToolSetting(plugin, containerEl, isDataviewEnabled);
	addDailyNotesToolSetting(plugin, containerEl);
	addQuickAddToolSetting(plugin, containerEl, isQuickAddEnabled);
}

function addDataviewToolSetting(
	plugin: ObsidianMCPPlugin,
	containerEl: HTMLElement,
	isDataviewEnabled: boolean
): void {
	const dataviewSetting = createToggleSetting({
		containerEl,
		name: "Dataview Query Tool",
		desc: "Execute Dataview queries in your vault",
		getValue: () => isDataviewEnabled && plugin.settings.enabledTools.dataview_query,
		setValue: (value) => (plugin.settings.enabledTools.dataview_query = value),
		saveSettings: () => plugin.saveSettings(),
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

function addDailyNotesToolSetting(plugin: ObsidianMCPPlugin, containerEl: HTMLElement): void {
	const isDailyNotesEnabled = DailyNoteUtils.isDailyNotesEnabled(plugin.app);
	const dailyNoteSetting = createToggleSetting({
		containerEl,
		name: "Daily Notes Features",
		desc: "Enable daily notes tool and resource to access daily notes in your vault",
		getValue: () => isDailyNotesEnabled && plugin.settings.enabledTools.daily_notes,
		setValue: (value) => (plugin.settings.enabledTools.daily_notes = value),
		saveSettings: () => plugin.saveSettings(),
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

function addQuickAddToolSetting(
	plugin: ObsidianMCPPlugin,
	containerEl: HTMLElement,
	isQuickAddEnabled: boolean
): void {
	const quickAddSetting = createToggleSetting({
		containerEl,
		name: "QuickAdd Tool",
		desc: "Execute and list QuickAdd choices",
		getValue: () => isQuickAddEnabled && plugin.settings.enabledTools.quickadd,
		setValue: (value) => (plugin.settings.enabledTools.quickadd = value),
		saveSettings: () => plugin.saveSettings(),
		disabled: !isQuickAddEnabled,
	});

	if (!isQuickAddEnabled) {
		quickAddSetting.setDesc("Execute and list QuickAdd choices (QuickAdd plugin is not enabled)");
		quickAddSetting.descEl.createSpan({ text: " — ", cls: "mcp-warning-text" });
		quickAddSetting.descEl.createSpan({
			text: "Requires QuickAdd plugin",
			cls: "mcp-warning-text",
		});
	}
}
