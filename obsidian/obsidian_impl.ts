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

import {
	TaskInfoSchema,
	TaskStatsSchema,
	TaskFilterOptionsSchema,
	type CheckFileResult,
	type DailyNotesInterface,
	type DataviewInterface,
	type ObsidianInterface,
	type QuickAddChoice,
	type QuickAddInterface,
	type SearchResult,
	type TaskFilter,
	type TaskNotesInterface,
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

	getTaskNotes(request: AuthenticatedRequest): TaskNotesInterface | null {
		if (!request.token.enabledTools.tasknotes) {
			return null;
		}
		const plugin = this.app.plugins.plugins["tasknotes"] as Record<string, unknown> | undefined;
		if (!plugin) {
			return null;
		}

		// TaskNotes v4.x API structure:
		// - cacheManager (TaskManager): getTaskByPath, getAllTasks, getAllStatuses, etc.
		// - taskService (TaskService): createTask, updateTask, toggleStatus, toggleRecurringTaskComplete
		// - filterService (FilterService): getFilterOptions, sortTasks, etc.

		if (
			!plugin.cacheManager ||
			!plugin.taskService ||
			!plugin.filterService ||
			typeof plugin.cacheManager !== "object" ||
			typeof plugin.taskService !== "object" ||
			typeof plugin.filterService !== "object"
		) {
			return null;
		}

		const cacheManager = plugin.cacheManager as {
			getTaskByPath(path: string): unknown | null;
			getAllTasks(): Promise<unknown>; // Returns Promise of Map, object, or array
			getAllStatuses(): string[];
			getAllPriorities(): string[];
			getAllContexts(): string[];
			getAllProjects(): string[];
		};

		const taskService = plugin.taskService as {
			createTask(data: unknown): Promise<unknown>;
			updateTask(path: string, updates: unknown): Promise<unknown>;
			toggleStatus(path: string): Promise<unknown>;
			toggleRecurringTaskComplete(path: string, date?: string): Promise<unknown>;
		};

		const filterService = plugin.filterService as {
			getFilterOptions(): unknown;
		};

		// Validate required methods exist
		const hasMethod = (obj: unknown, method: string) =>
			obj &&
			typeof obj === "object" &&
			typeof (obj as Record<string, unknown>)[method] === "function";

		if (
			!hasMethod(cacheManager, "getTaskByPath") ||
			!hasMethod(cacheManager, "getAllTasks") ||
			!hasMethod(taskService, "createTask") ||
			!hasMethod(taskService, "updateTask") ||
			!hasMethod(taskService, "toggleStatus") ||
			!hasMethod(filterService, "getFilterOptions")
		) {
			return null;
		}

		// Helper to filter tasks based on our filter interface
		const filterTasks = (tasks: unknown[], filter: TaskFilter): unknown[] => {
			let filtered = [...tasks];

			if (filter.status && filter.status.length > 0) {
				filtered = filtered.filter((t) => {
					const task = t as { status?: string };
					return task.status && filter.status!.includes(task.status);
				});
			}

			if (filter.priority && filter.priority.length > 0) {
				filtered = filtered.filter((t) => {
					const task = t as { priority?: string };
					return task.priority && filter.priority!.includes(task.priority);
				});
			}

			if (filter.contexts && filter.contexts.length > 0) {
				filtered = filtered.filter((t) => {
					const task = t as { contexts?: string[] };
					return task.contexts && filter.contexts!.some((ctx) => task.contexts!.includes(ctx));
				});
			}

			if (filter.projects && filter.projects.length > 0) {
				filtered = filtered.filter((t) => {
					const task = t as { projects?: string[] };
					return task.projects && filter.projects!.some((proj) => task.projects!.includes(proj));
				});
			}

			if (filter.tags && filter.tags.length > 0) {
				filtered = filtered.filter((t) => {
					const task = t as { tags?: string[] };
					return task.tags && filter.tags!.some((tag) => task.tags!.includes(tag));
				});
			}

			if (filter.archived !== undefined) {
				filtered = filtered.filter((t) => {
					const task = t as { archived?: boolean };
					return task.archived === filter.archived;
				});
			}

			if (filter.due) {
				if (filter.due.before) {
					const before = filter.due.before;
					filtered = filtered.filter((t) => {
						const task = t as { due?: string };
						return task.due && task.due <= before;
					});
				}
				if (filter.due.after) {
					const after = filter.due.after;
					filtered = filtered.filter((t) => {
						const task = t as { due?: string };
						return task.due && task.due >= after;
					});
				}
			}

			if (filter.scheduled) {
				if (filter.scheduled.before) {
					const before = filter.scheduled.before;
					filtered = filtered.filter((t) => {
						const task = t as { scheduled?: string };
						return task.scheduled && task.scheduled <= before;
					});
				}
				if (filter.scheduled.after) {
					const after = filter.scheduled.after;
					filtered = filtered.filter((t) => {
						const task = t as { scheduled?: string };
						return task.scheduled && task.scheduled >= after;
					});
				}
			}

			// Apply limit and offset
			if (filter.offset) {
				filtered = filtered.slice(filter.offset);
			}
			if (filter.limit) {
				filtered = filtered.slice(0, filter.limit);
			}

			return filtered;
		};

		return {
			getTaskByPath: (path) => {
				const result = cacheManager.getTaskByPath(path);
				// Check for null, undefined, or empty object (TaskNotes returns {} for non-task files)
				if (
					result === null ||
					result === undefined ||
					(typeof result === "object" && Object.keys(result as object).length === 0)
				) {
					return null;
				}
				// Use safeParse to gracefully handle unexpected task data formats
				const parsed = TaskInfoSchema.safeParse(result);
				return parsed.success ? parsed.data : null;
			},
			queryTasks: async (filter) => {
				const allTasksRaw = await cacheManager.getAllTasks();
				// Handle case where getAllTasks returns a Map, object, or array
				let allTasks: unknown[];
				if (Array.isArray(allTasksRaw)) {
					allTasks = allTasksRaw;
				} else if (allTasksRaw instanceof Map) {
					allTasks = Array.from(allTasksRaw.values());
				} else if (allTasksRaw && typeof allTasksRaw === "object") {
					allTasks = Object.values(allTasksRaw);
				} else {
					allTasks = [];
				}

				const filtered = filterTasks(allTasks, filter);
				return filtered.map((task) => TaskInfoSchema.parse(task));
			},
			createTask: async (data) => {
				const result = await taskService.createTask(data);
				return TaskInfoSchema.parse(result);
			},
			updateTask: async (id, updates) => {
				const result = await taskService.updateTask(id, updates);
				return TaskInfoSchema.parse(result);
			},
			toggleStatus: async (id) => {
				const result = await taskService.toggleStatus(id);
				return TaskInfoSchema.parse(result);
			},
			completeInstance: async (id, date) => {
				// Use toggleRecurringTaskComplete for recurring task completion
				const result = await taskService.toggleRecurringTaskComplete(id, date);
				return TaskInfoSchema.parse(result);
			},
			getStats: async () => {
				// Compute stats from all tasks
				const allTasksRaw = await cacheManager.getAllTasks();
				let allTasks: unknown[];
				if (Array.isArray(allTasksRaw)) {
					allTasks = allTasksRaw;
				} else if (allTasksRaw instanceof Map) {
					allTasks = Array.from(allTasksRaw.values());
				} else if (allTasksRaw && typeof allTasksRaw === "object") {
					allTasks = Object.values(allTasksRaw);
				} else {
					allTasks = [];
				}

				let completed = 0;
				let active = 0;
				let overdue = 0;
				let archived = 0;
				const today = new Date().toISOString().split("T")[0];

				for (const t of allTasks) {
					const task = t as { status?: string; archived?: boolean; due?: string };
					if (task.archived) {
						archived++;
					} else if (task.status === "completed" || task.status === "done") {
						completed++;
					} else {
						active++;
						if (task.due && task.due < today) {
							overdue++;
						}
					}
				}

				return TaskStatsSchema.parse({
					total: allTasks.length,
					completed,
					active,
					overdue,
					archived,
				});
			},
			getFilterOptions: () => {
				// Get filter options from filterService or build from cacheManager
				try {
					const options = filterService.getFilterOptions();
					return TaskFilterOptionsSchema.parse(options);
				} catch {
					// Fallback: build from cacheManager methods
					return TaskFilterOptionsSchema.parse({
						statuses: cacheManager.getAllStatuses(),
						priorities: cacheManager.getAllPriorities(),
						contexts: cacheManager.getAllContexts(),
						projects: cacheManager.getAllProjects(),
					});
				}
			},
		} satisfies TaskNotesInterface;
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
