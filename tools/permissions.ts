import type { TFile } from "../obsidian/obsidian_types";
import type { ObsidianInterface } from "../obsidian/obsidian_interface";

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

export function isFileAccessible(
	obsidian: ObsidianInterface,
	file: TFile,
	permissions?: { mcp_access?: boolean; mcp_readonly?: boolean }
): boolean {
	permissions = permissions || getFileFrontmatterPermissions(obsidian, file);
	if (permissions.mcp_access === false) return false;
	if (permissions.mcp_access === true) return true;

	const parentPath = file.path.includes("/")
		? file.path.substring(0, file.path.lastIndexOf("/"))
		: "/";

	return isDirectoryAccessible(parentPath, obsidian.settings);
}

export function isFileModifiable(obsidian: ObsidianInterface, file: TFile): boolean {
	const permissions = getFileFrontmatterPermissions(obsidian, file);
	if (permissions.mcp_readonly === true) return false;
	return isFileAccessible(obsidian, file, permissions);
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
