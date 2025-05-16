import { MCPPluginSettings } from "settings/types";
import {
	CheckFileResult,
	DailyNotesInterface,
	DataviewInterface,
	ObsidianInterface,
	QuickAddChoice,
	QuickAddInterface,
	SearchResult,
} from "./obsidian_interface";
import { App, CachedMetadata, prepareFuzzySearch, prepareSimpleSearch, TFile } from "obsidian";
import ObsidianMCPPlugin from "main";
import { isDirectoryAccessible, isFileAccessible, isFileModifiable } from "tools/permissions";
import { getAPI as getDataviewAPI } from "obsidian-dataview";
import type { DailyNotesPlugin, PeriodicNotesPlugin } from "./obsidian_types";

export class ObsidianImpl implements ObsidianInterface {
	constructor(
		private app: App,
		private plugin: ObsidianMCPPlugin
	) {}

	get settings(): MCPPluginSettings {
		return this.plugin.settings;
	}

	async checkFile(filePath: string): Promise<CheckFileResult> {
		const file = this.app.vault.getFileByPath(filePath);
		if (!file) {
			return {
				exists: false,
			};
		}

		return {
			exists: true,
			isAccessible: isFileAccessible(this, file),
			isModifiable: isFileModifiable(this, file),
			file,
		};
	}

	getMarkdownFiles(): TFile[] {
		return this.app.vault.getMarkdownFiles().filter((file) => isFileAccessible(this, file));
	}

	async getFileByPath(filePath: string, permissions: "read" | "write" | "create"): Promise<TFile> {
		const file = this.app.vault.getFileByPath(filePath);
		if (!file && permissions === "create" && isDirectoryAccessible(filePath, this.settings)) {
			return await this.app.vault.create(filePath, "");
		}
		if (!file) {
			throw new Error(`File not found: ${filePath}`);
		}
		if (!isFileAccessible(this, file)) {
			throw new Error(`Access denied: ${filePath}`);
		}
		if (permissions === "write" && !isFileModifiable(this, file)) {
			throw new Error(`File is read-only: ${filePath}`);
		}

		return file;
	}

	async cachedRead(file: TFile): Promise<string> {
		return await this.app.vault.cachedRead(file);
	}

	async read(file: TFile): Promise<string> {
		return await this.app.vault.read(file);
	}

	async create(path: string, data: string): Promise<TFile> {
		if (!isDirectoryAccessible(path, this.settings)) {
			throw new Error(`Directory not accessible: ${path}`);
		}
		return await this.app.vault.create(path, data);
	}

	async modify(file: TFile, data: string): Promise<void> {
		if (!isFileModifiable(this, file)) {
			throw new Error(`File is read-only: ${file.path}`);
		}
		return await this.app.vault.modify(file, data);
	}

	async createFolder(path: string): Promise<void> {
		if (!isDirectoryAccessible(path, this.settings)) {
			throw new Error(`Directory not accessible: ${path}`);
		}
		await this.app.vault.createFolder(path);
	}

	getFileCache(file: TFile): CachedMetadata | null {
		return this.app.metadataCache.getFileCache(file);
	}

	async search(query: string, fuzzy: boolean, folder?: string): Promise<SearchResult[]> {
		const search = fuzzy ? prepareFuzzySearch(query) : prepareSimpleSearch(query);
		const results: SearchResult[] = [];

		for (const file of this.getMarkdownFiles()) {
			if (folder && !file.path.startsWith(folder)) {
				continue;
			}

			const cachedContents = await this.cachedRead(file);
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

	onFileModified(callback: (file: TFile) => void): void {
		this.app.vault.on("modify", (file: TFile) => {
			callback(file);
		});
	}

	get quickAdd(): QuickAddInterface | null {
		if (!this.settings.enabledTools.quickadd) {
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

	get dataview(): DataviewInterface | null {
		if (!this.settings.enabledTools.dataview_query) {
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
