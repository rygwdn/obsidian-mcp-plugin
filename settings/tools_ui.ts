import ObsidianMCPPlugin from "../main";
import { createSection, createToggleSetting } from "./ui_components";

export function addFeaturesSection(plugin: ObsidianMCPPlugin, containerEl: HTMLElement): void {
	createSection(containerEl, "Features");

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
		warningText: " ⚠️ Allows direct changes to your vault.",
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

	const isDataviewEnabled = plugin.app.plugins.enabledPlugins.has("dataview");
	createToggleSetting({
		containerEl,
		name: "Dataview Integration",
		desc: "Enable Dataview integration for executing queries.",
		getValue: () => isDataviewEnabled && plugin.settings.enabledTools.dataview_query,
		setValue: (value) => (plugin.settings.enabledTools.dataview_query = value),
		saveSettings: () => plugin.saveSettings(),
		disabled: !isDataviewEnabled,
		disabledWarningText: " (plugin is not enabled)",
	});

	const isQuickAddEnabled = plugin.app.plugins.enabledPlugins.has("quickadd");
	createToggleSetting({
		containerEl,
		name: "QuickAdd Integration",
		desc: "Enable QuickAdd integration for executing and listing choices.",
		warningText: " ⚠️ Allows direct changes to your vault.",
		getValue: () => isQuickAddEnabled && plugin.settings.enabledTools.quickadd,
		setValue: (value) => (plugin.settings.enabledTools.quickadd = value),
		saveSettings: () => plugin.saveSettings(),
		disabled: !isQuickAddEnabled,
		disabledWarningText: " (plugin is not enabled)",
	});
}
