/**
 * Settings type definitions for the MCP Plugin
 */

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
		quickadd: boolean;
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
		quickadd: true,
	},
	enableResources: true,
	enablePrompts: true,
};
