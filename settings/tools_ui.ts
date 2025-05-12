import ObsidianMCPPlugin from "../main";
import { createSection, createToggleSetting } from "./ui_components";
import * as DailyNoteUtils from "../tools/daily_note_utils";

export function addFeaturesSection(plugin: ObsidianMCPPlugin, containerEl: HTMLElement): void {
	createSection(containerEl, "Features");

	const isDataviewEnabled = plugin.app.plugins.enabledPlugins.has("dataview");
	const isQuickAddEnabled = plugin.app.plugins.enabledPlugins.has("quickadd");

	createToggleSetting({
		containerEl,
		name: "File Access",
		desc: "Enable reading files, listing directories, and retrieving file metadata in your vault.",
		getValue: () => plugin.settings.enabledTools.file_access,
		setValue: (value) => (plugin.settings.enabledTools.file_access = value),
		saveSettings: () => plugin.saveSettings(),
	});

	createToggleSetting({
		containerEl,
		name: "Content Modification",
		desc: "Enable modifying file content (e.g., appending or replacing text).",
		getValue: () => plugin.settings.enabledTools.update_content,
		setValue: (value) => (plugin.settings.enabledTools.update_content = value),
		saveSettings: () => plugin.saveSettings(),
	});

	createToggleSetting({
		containerEl,
		name: "Vault Search",
		desc: "Search for text in your vault files.",
		getValue: () => plugin.settings.enabledTools.search,
		setValue: (value) => (plugin.settings.enabledTools.search = value),
		saveSettings: () => plugin.saveSettings(),
	});

	addDataviewFeatureSetting(plugin, containerEl, isDataviewEnabled);
	addDailyNotesFeatureSetting(plugin, containerEl);
	addQuickAddFeatureSetting(plugin, containerEl, isQuickAddEnabled);
}

function addDataviewFeatureSetting(
	plugin: ObsidianMCPPlugin,
	containerEl: HTMLElement,
	isDataviewEnabled: boolean
): void {
	const dataviewSetting = createToggleSetting({
		containerEl,
		name: "Dataview Integration",
		desc: "Enable Dataview integration for executing queries.",
		getValue: () => isDataviewEnabled && plugin.settings.enabledTools.dataview_query,
		setValue: (value) => (plugin.settings.enabledTools.dataview_query = value),
		saveSettings: () => plugin.saveSettings(),
		disabled: !isDataviewEnabled,
	});

	if (!isDataviewEnabled) {
		dataviewSetting.setDesc(
			"Enable Dataview integration for executing queries (Dataview plugin is not enabled)"
		);
		dataviewSetting.descEl.createSpan({ text: " — ", cls: "mcp-warning-text" });
		dataviewSetting.descEl.createSpan({
			text: "Requires Dataview plugin",
			cls: "mcp-warning-text",
		});
	}
}

function addDailyNotesFeatureSetting(plugin: ObsidianMCPPlugin, containerEl: HTMLElement): void {
	const isDailyNotesPluginEnabled = DailyNoteUtils.isDailyNotesEnabled(plugin.app);
	const dailyNoteSetting = createToggleSetting({
		containerEl,
		name: "Daily Notes Integration",
		desc: "Enable integration for accessing and managing daily notes. This feature relies on 'File System Access' being enabled if the Daily Notes plugin is active.",
		getValue: () => isDailyNotesPluginEnabled && plugin.settings.enabledTools.file_access,
		setValue: (value) => (plugin.settings.enabledTools.file_access = value),
		saveSettings: () => plugin.saveSettings(),
		disabled: !isDailyNotesPluginEnabled,
	});

	if (!isDailyNotesPluginEnabled) {
		dailyNoteSetting.setDesc(
			"Enable Daily Notes integration (Daily Notes or Periodic Notes plugin with daily notes configured is not enabled)"
		);
		dailyNoteSetting.descEl.createSpan({ text: " — ", cls: "mcp-warning-text" });
		dailyNoteSetting.descEl.createSpan({
			text: "Requires Daily Notes or Periodic Notes plugin (for daily notes)",
			cls: "mcp-warning-text",
		});
	}
}

function addQuickAddFeatureSetting(
	plugin: ObsidianMCPPlugin,
	containerEl: HTMLElement,
	isQuickAddEnabled: boolean
): void {
	const quickAddSetting = createToggleSetting({
		containerEl,
		name: "QuickAdd Integration",
		desc: "Enable QuickAdd integration for executing and listing choices.",
		getValue: () => isQuickAddEnabled && plugin.settings.enabledTools.quickadd,
		setValue: (value) => (plugin.settings.enabledTools.quickadd = value),
		saveSettings: () => plugin.saveSettings(),
		disabled: !isQuickAddEnabled,
	});

	if (!isQuickAddEnabled) {
		quickAddSetting.setDesc("Enable QuickAdd integration (QuickAdd plugin is not enabled)");
		quickAddSetting.descEl.createSpan({ text: " — ", cls: "mcp-warning-text" });
		quickAddSetting.descEl.createSpan({
			text: "Requires QuickAdd plugin",
			cls: "mcp-warning-text",
		});
	}
}
