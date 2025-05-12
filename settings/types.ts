/**
 * Settings type definitions for the MCP Plugin
 */

export interface MCPPluginSettings {
	promptsFolder: string;
	toolNamePrefix: string;
	vaultDescription: string;
	enabledTools: {
		file_access: boolean; // Combined setting for file listing and content access
		search: boolean;
		update_content: boolean;
		dataview_query: boolean;
		quickadd: boolean;
	};
	enablePrompts: boolean;
}

export const DEFAULT_SETTINGS: MCPPluginSettings = {
	promptsFolder: "prompts",
	toolNamePrefix: "vault",
	vaultDescription:
		"This vault contains personal notes on various topics including work projects, research, and daily journals. It's organized with folders for each major area and uses tags for cross-referencing.",
	enabledTools: {
		file_access: true, // Combined setting for file listing and content access
		search: true,
		update_content: true,
		dataview_query: true,
		quickadd: true,
	},
	enablePrompts: true,
};
