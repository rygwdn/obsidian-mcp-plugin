/**
 * Settings type definitions for the MCP Plugin
 */

export interface DirectoryRule {
	path: string;
	allowed: boolean;
}

export interface CryptoSettings {
	cert: string;
	privateKey: string;
	publicKey: string;
}

export interface AuthToken {
	id: string;
	name: string;
	token: string;
	createdAt: number;
	lastUsed?: number;
	enabledTools: {
		file_access: boolean;
		search: boolean;
		update_content: boolean;
		dataview_query: boolean;
		quickadd: boolean;
	};
	directoryPermissions: {
		rules: DirectoryRule[];
		rootPermission: boolean;
	};
}

export interface MCPPluginSettings {
	promptsFolder: string;
	vaultDescription: string;
	verboseLogging: boolean;
	server: {
		enabled: boolean;
		port: number;
		host: string;
		httpsEnabled: boolean;
		crypto: CryptoSettings | null;
		subjectAltNames: string;
		tokens: AuthToken[];
	};
}

export const DEFAULT_SETTINGS: MCPPluginSettings = {
	promptsFolder: "prompts",
	vaultDescription:
		"This vault contains personal notes on various topics including work projects, research, and daily journals. It's organized with folders for each major area and uses tags for cross-referencing.",
	verboseLogging: false,
	server: {
		enabled: false,
		port: 27125,
		host: "127.0.0.1",
		httpsEnabled: false,
		crypto: null,
		subjectAltNames: "",
		tokens: [],
	},
};
