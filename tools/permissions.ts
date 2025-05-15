import { App, TFile } from "obsidian";
import { MCPPluginSettings } from "../settings/types";

export function getAccessibleMarkdownFiles(
	app: App,
	settings: MCPPluginSettings,
	permission: "read" | "write"
): TFile[] {
	return app.vault
		.getMarkdownFiles()
		.filter((file) =>
			permission === "read"
				? isFileAccessible(app, file, settings)
				: isFileModifiable(app, file, settings)
		);
}

export async function getAccessibleFile(
	filePath: string,
	permissions: "read" | "write" | "create",
	app: App,
	settings: MCPPluginSettings
): Promise<TFile> {
	const file = app.vault.getFileByPath(filePath);
	if (!file && permissions === "create" && isDirectoryAccessible(filePath, settings)) {
		return await app.vault.create(filePath, "");
	}
	if (!file) {
		throw new Error(`File not found: ${filePath}`);
	}
	if (!isFileAccessible(app, file, settings)) {
		throw new Error(`Access denied: ${filePath}`);
	}
	if (permissions === "write" && !isFileModifiable(app, file, settings)) {
		throw new Error(`File is read-only: ${filePath}`);
	}

	return file;
}

export function getFileFrontmatterPermissions(
	app: App,
	file: TFile
): { mcp_access?: boolean; mcp_readonly?: boolean } {
	const fileCache = app.metadataCache.getFileCache(file);
	const frontmatter = fileCache?.frontmatter || {};
	const permissions = {
		mcp_access: frontmatter.mcp_access,
		mcp_readonly: frontmatter.mcp_readonly,
	};

	return permissions;
}

export function isFileAccessible(
	app: App,
	file: TFile,
	settings: MCPPluginSettings,
	permissions?: { mcp_access?: boolean; mcp_readonly?: boolean }
): boolean {
	permissions = permissions || getFileFrontmatterPermissions(app, file);
	if (permissions.mcp_access === false) return false;
	if (permissions.mcp_access === true) return true;

	const parentPath = file.path.includes("/")
		? file.path.substring(0, file.path.lastIndexOf("/"))
		: "/";

	return isDirectoryAccessible(parentPath, settings);
}

export function isFileModifiable(app: App, file: TFile, settings: MCPPluginSettings): boolean {
	const permissions = getFileFrontmatterPermissions(app, file);
	if (permissions.mcp_readonly === true) return false;
	return isFileAccessible(app, file, settings, permissions);
}

export function isDirectoryAccessible(dirPath: string, settings: MCPPluginSettings): boolean {
	const { rules, rootPermission } = settings.directoryPermissions;

	for (const rule of rules) {
		if (dirPath === rule.path || dirPath.startsWith(rule.path + "/")) {
			return rule.allowed;
		}
	}

	return rootPermission;
}
