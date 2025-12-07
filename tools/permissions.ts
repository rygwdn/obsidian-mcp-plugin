import type { ObsidianInterface } from "../obsidian/obsidian_interface";
import type { TFile } from "../obsidian/obsidian_types";
import type { AuthenticatedRequest } from "../server/auth";
import type { AuthToken } from "settings/types";

export function getFileFrontmatterPermissions(
	obsidian: ObsidianInterface,
	file: TFile
): {
	mcp_access?: boolean;
	mcp_readonly?: boolean;
} {
	const fileCache = obsidian.getFileCache(file);
	const frontmatter = fileCache?.frontmatter || {};
	const permissions = {
		mcp_access: frontmatter.mcp_access,
		mcp_readonly: frontmatter.mcp_readonly,
	};

	return permissions;
}

export function isDirectoryAccessible(
	dirPath: string,
	settings: {
		directoryPermissions: { rules: { path: string; allowed: boolean }[]; rootPermission: boolean };
	}
): boolean {
	const { rules, rootPermission } = settings.directoryPermissions;

	for (const rule of rules) {
		if (dirPath === rule.path || dirPath.startsWith(rule.path + "/")) {
			return rule.allowed;
		}
	}

	return rootPermission;
}

/**
 * Check if a file is accessible using token-specific directory permissions
 */
export function isFileAccessibleWithToken(
	obsidian: ObsidianInterface,
	file: TFile,
	token: AuthToken,
	_request: AuthenticatedRequest
): boolean {
	const permissions = getFileFrontmatterPermissions(obsidian, file);
	if (permissions.mcp_access === false) return false;
	if (permissions.mcp_access === true) return true;

	const parentPath = file.path.includes("/")
		? file.path.substring(0, file.path.lastIndexOf("/"))
		: "/";

	return isDirectoryAccessible(parentPath, { directoryPermissions: token.directoryPermissions });
}

/**
 * Check if a file is modifiable using token-specific directory permissions
 */
export function isFileModifiableWithToken(
	obsidian: ObsidianInterface,
	file: TFile,
	token: AuthToken,
	_request: AuthenticatedRequest
): boolean {
	const permissions = getFileFrontmatterPermissions(obsidian, file);
	if (permissions.mcp_readonly === true) return false;
	return isFileAccessibleWithToken(obsidian, file, token, _request);
}

/**
 * Check if a directory is accessible using token-specific directory permissions
 */
export function isDirectoryAccessibleWithToken(dirPath: string, token: AuthToken): boolean {
	return isDirectoryAccessible(dirPath, { directoryPermissions: token.directoryPermissions });
}
