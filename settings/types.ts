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

export enum TokenPermission {
	READ = "read",
	WRITE = "write",
}

export interface AuthToken {
	id: string;
	name: string;
	token: string;
	permissions: TokenPermission[];
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
	verboseLogging: boolean;
	directoryPermissions: {
		rules: DirectoryRule[];
		rootPermission: boolean;
	};
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
	toolNamePrefix: "",
	vaultDescription:
		"This vault contains personal notes on various topics including work projects, research, and daily journals. It's organized with folders for each major area and uses tags for cross-referencing.",
	enabledTools: {
		file_access: true,
		search: true,
		update_content: true,
		dataview_query: true,
		quickadd: true,
	},
	enablePrompts: true,
	verboseLogging: false,
	directoryPermissions: {
		rules: [],
		rootPermission: true,
	},
	server: {
		enabled: true,
		port: 27123,
		host: "127.0.0.1",
		httpsEnabled: false,
		crypto: null,
		subjectAltNames: "",
		tokens: [],
	},
};
