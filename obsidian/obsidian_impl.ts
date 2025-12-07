import type { App, CachedMetadata, TFile } from "obsidian";
import { prepareFuzzySearch, prepareSimpleSearch } from "obsidian";
import { getAPI as getDataviewAPI } from "obsidian-dataview";

import type ObsidianMCPPlugin from "main";
import type { AuthenticatedRequest } from "../server/auth";
import type { MCPPluginSettings } from "settings/types";
import {
	isDirectoryAccessibleWithToken,
	isFileAccessibleWithToken,
	isFileModifiableWithToken,
} from "tools/permissions";

import type {
	CheckFileResult,
	DailyNotesInterface,
	DataviewInterface,
	ObsidianInterface,
	QuickAddChoice,
	QuickAddInterface,
	SearchResult,
} from "./obsidian_interface";
import type { DailyNotesPlugin, PeriodicNotesPlugin } from "./obsidian_types";

export class ObsidianImpl implements ObsidianInterface {
	constructor(
		private app: App,
		private plugin: ObsidianMCPPlugin
	) {}

	get settings(): MCPPluginSettings {
		return this.plugin.settings;
	}

	async checkFile(filePath: string, request: AuthenticatedRequest): Promise<CheckFileResult> {
		const file = this.app.vault.getFileByPath(filePath);
		if (!file) {
			return {
				exists: false,
			};
		}

		return {
			exists: true,
			isAccessible: isFileAccessibleWithToken(this, file, request.token, request),
			isModifiable: isFileModifiableWithToken(this, file, request.token, request),
			file,
		};
	}

	getMarkdownFiles(request: AuthenticatedRequest): TFile[] {
		return this.app.vault
			.getMarkdownFiles()
			.filter((file) => isFileAccessibleWithToken(this, file, request.token, request));
	}

	async getFileByPath(
		filePath: string,
		permissions: "read" | "write" | "create",
		request: AuthenticatedRequest
	): Promise<TFile> {
		const file = this.app.vault.getFileByPath(filePath);
		if (!file && permissions === "create") {
			const parentPath = filePath.includes("/")
				? filePath.substring(0, filePath.lastIndexOf("/"))
				: "/";
			if (!isDirectoryAccessibleWithToken(parentPath === "/" ? "" : parentPath, request.token)) {
				throw new Error(`Directory not accessible: ${parentPath}`);
			}
			return await this.app.vault.create(filePath, "");
		}
		if (!file) {
			throw new Error(`File not found: ${filePath}`);
		}
		if (!isFileAccessibleWithToken(this, file, request.token, request)) {
			throw new Error(`Access denied: ${filePath}`);
		}
		if (permissions === "write" && !isFileModifiableWithToken(this, file, request.token, request)) {
			throw new Error(`File is read-only: ${filePath}`);
		}

		return file;
	}

	async cachedRead(file: TFile, request: AuthenticatedRequest): Promise<string> {
		if (!isFileAccessibleWithToken(this, file, request.token, request)) {
			throw new Error(`Access denied: ${file.path}`);
		}
		return await this.app.vault.cachedRead(file);
	}

	async read(file: TFile, request: AuthenticatedRequest): Promise<string> {
		if (!isFileAccessibleWithToken(this, file, request.token, request)) {
			throw new Error(`Access denied: ${file.path}`);
		}
		return await this.app.vault.read(file);
	}

	async create(path: string, data: string, request: AuthenticatedRequest): Promise<TFile> {
		const parentPath = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "/";
		if (!isDirectoryAccessibleWithToken(parentPath === "/" ? "" : parentPath, request.token)) {
			throw new Error(`Directory not accessible: ${parentPath}`);
		}
		return await this.app.vault.create(path, data);
	}

	async modify(file: TFile, data: string, request: AuthenticatedRequest): Promise<void> {
		if (!isFileModifiableWithToken(this, file, request.token, request)) {
			throw new Error(`File is read-only: ${file.path}`);
		}
		return await this.app.vault.modify(file, data);
	}

	async createFolder(path: string, request: AuthenticatedRequest): Promise<void> {
		if (!isDirectoryAccessibleWithToken(path, request.token)) {
			throw new Error(`Directory not accessible: ${path}`);
		}
		await this.app.vault.createFolder(path);
	}

	getFileCache(file: TFile): CachedMetadata | null {
		// Note: Permission checks should be done before calling this method
		// to avoid circular dependencies. This method just returns the cache.
		return this.app.metadataCache.getFileCache(file);
	}

	unsafeGetPromptFiles(settings: MCPPluginSettings): TFile[] {
		return this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.startsWith(settings.promptsFolder));
	}

	getFilesForAnyToken(settings: MCPPluginSettings): TFile[] {
		const allFiles = this.app.vault.getMarkdownFiles();
		const tokens = settings.server.tokens;

		if (tokens.length === 0) {
			return [];
		}

		return allFiles.filter((file) => {
			return tokens.some((token) => {
				const fileCache = this.app.metadataCache.getFileCache(file);
				const frontmatter = fileCache?.frontmatter || {};
				if (frontmatter.mcp_access === false) return false;
				if (frontmatter.mcp_access === true) return true;

				// Check directory permissions
				const parentPath = file.path.includes("/")
					? file.path.substring(0, file.path.lastIndexOf("/"))
					: "/";
				const { rules, rootPermission } = token.directoryPermissions;
				for (const rule of rules) {
					if (parentPath === rule.path || parentPath.startsWith(rule.path + "/")) {
						return rule.allowed;
					}
				}
				return rootPermission;
			});
		});
	}

	unsafeGetPromptFileCache(settings: MCPPluginSettings, file: TFile): CachedMetadata | null {
		if (!file.path.startsWith(settings.promptsFolder)) {
			return null;
		}
		return this.app.metadataCache.getFileCache(file);
	}

	async search(
		query: string,
		fuzzy: boolean,
		folder: string | undefined,
		request: AuthenticatedRequest
	): Promise<SearchResult[]> {
		const search = fuzzy ? prepareFuzzySearch(query) : prepareSimpleSearch(query);
		const results: SearchResult[] = [];

		for (const file of this.getMarkdownFiles(request)) {
			if (folder && !file.path.startsWith(folder)) {
				continue;
			}

			const cachedContents = await this.cachedRead(file, request);
			const result = search(cachedContents);
			if (result) {
				results.push({
					score: result.score,
					matches: result.matches,
					cachedContents,
					file,
				});
			}
		}
		return results;
	}

	onFileModified(
		callback: (operation: "create" | "modify" | "rename" | "delete", file: TFile) => void
	): void {
		this.app.vault.on("create", (file: TFile) => {
			callback("create", file);
		});
		this.app.vault.on("modify", (file: TFile) => {
			callback("modify", file);
		});
		this.app.vault.on("rename", (file: TFile) => {
			callback("rename", file);
		});
		this.app.vault.on("delete", (file: TFile) => {
			callback("delete", file);
		});
	}

	getQuickAdd(request: AuthenticatedRequest): QuickAddInterface | null {
		if (!request.token.enabledTools.quickadd) {
			return null;
		}
		const plugin = this.app.plugins.plugins["quickadd"];
		if (plugin && "api" in plugin && "settings" in plugin) {
			const api = plugin.api as Omit<QuickAddInterface, "getChoices">;
			return {
				getChoices: () => (plugin.settings as { choices?: QuickAddChoice[] }).choices ?? [],
				executeChoice: (...args) => api.executeChoice?.(...args),
				formatTemplate: (...args) => api.formatTemplate?.(...args),
			} satisfies QuickAddInterface;
		}
		return null;
	}

	getDataview(request: AuthenticatedRequest): DataviewInterface | null {
		if (!request.token.enabledTools.dataview_query) {
			return null;
		}
		const api = getDataviewAPI(this.app);
		if (!api) {
			return null;
		}

		return {
			queryMarkdown: (query) => api.queryMarkdown(query),
		};
	}

	get dailyNotes(): DailyNotesInterface | null {
		const defaultFormat = "YYYY-MM-DD";
		const defaultFolder = "";

		const periodicNotes = this.app.plugins.plugins["periodic-notes"] as PeriodicNotesPlugin | null;
		if (periodicNotes) {
			return {
				format: periodicNotes.settings?.daily?.format ?? defaultFormat,
				folder: periodicNotes.settings?.daily?.folder ?? defaultFolder,
			};
		}

		const plugin = this.app.internalPlugins.plugins["daily-notes"] as DailyNotesPlugin | undefined;
		if (plugin?.enabled) {
			return {
				format: plugin.instance.options.format ?? defaultFormat,
				folder: plugin.instance.options.folder ?? defaultFolder,
			};
		}

		return null;
	}
}

declare module "obsidian" {
	interface App {
		internalPlugins: {
			plugins: Record<string, { [key: string]: unknown } | undefined>;
		};
	}
}
