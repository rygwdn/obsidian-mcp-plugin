import type { App, CachedMetadata, TFile } from "obsidian";
import { prepareFuzzySearch, prepareSimpleSearch } from "obsidian";
import { getAPI as getDataviewAPI } from "obsidian-dataview";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import type ObsidianMCPPlugin from "main";
import type { AuthenticatedRequest } from "../server/auth";
import type { MCPPluginSettings } from "settings/types";
import type {
	TaskInfo as OfficialTaskInfo,
	TaskCreationData as OfficialTaskCreationData,
	FilterOptions as OfficialFilterOptions,
} from "../vendor/tasknotes-types";

// TaskNotes plugin service interfaces - only methods we actually use
interface TaskNotesCacheManager {
	getTaskByPath(path: string): OfficialTaskInfo | null;
	getAllTasks(): Promise<Map<string, OfficialTaskInfo> | OfficialTaskInfo[]>;
	getAllStatuses(): string[];
	getAllPriorities(): string[];
}

interface TaskNotesTaskService {
	createTask(data: OfficialTaskCreationData): Promise<{ file: TFile; taskInfo: OfficialTaskInfo }>;
	updateTask(
		originalTask: OfficialTaskInfo,
		updates: Partial<OfficialTaskInfo>
	): Promise<OfficialTaskInfo>;
}

interface TaskNotesFilterService {
	getFilterOptions(): OfficialFilterOptions;
}

interface TaskNotesPlugin {
	cacheManager: TaskNotesCacheManager;
	taskService: TaskNotesTaskService;
	filterService: TaskNotesFilterService;
}

// Type guard to validate TaskNotes plugin structure
function isTaskNotesPlugin(plugin: unknown): plugin is TaskNotesPlugin {
	if (!plugin || typeof plugin !== "object") {
		return false;
	}
	const p = plugin as Record<string, unknown>;

	const hasMethod = (obj: unknown, method: string): boolean =>
		obj !== null &&
		typeof obj === "object" &&
		typeof (obj as Record<string, unknown>)[method] === "function";

	return (
		typeof p.cacheManager === "object" &&
		p.cacheManager !== null &&
		hasMethod(p.cacheManager, "getTaskByPath") &&
		hasMethod(p.cacheManager, "getAllTasks") &&
		typeof p.taskService === "object" &&
		p.taskService !== null &&
		hasMethod(p.taskService, "createTask") &&
		hasMethod(p.taskService, "updateTask") &&
		typeof p.filterService === "object" &&
		p.filterService !== null &&
		hasMethod(p.filterService, "getFilterOptions")
	);
}
import {
	isDirectoryAccessibleWithToken,
	isFileAccessibleWithToken,
	isFileModifiableWithToken,
} from "tools/permissions";

import {
	TaskInfoSchema,
	TaskStatsSchema,
	TaskFilterOptionsSchema,
	TimeBlockSchema,
	type CheckFileResult,
	type DailyNotesInterface,
	type DataviewInterface,
	type ObsidianInterface,
	type QuickAddChoice,
	type QuickAddInterface,
	type SearchResult,
	type TaskFilter,
	type TaskNotesInterface,
	type TimeblocksInterface,
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
		const plugin = this.app.plugins.plugins["tasknotes"];
		if (!isTaskNotesPlugin(plugin)) {
			return null;
		}

		// After type guard, these are properly typed without 'as' casts
		const { cacheManager, taskService, filterService } = plugin;

		// Helper to filter tasks based on our filter interface
		const filterTasks = (tasks: OfficialTaskInfo[], filter: TaskFilter): OfficialTaskInfo[] => {
			let filtered = [...tasks];

			if (filter.status && filter.status.length > 0) {
				filtered = filtered.filter((task) => task.status && filter.status!.includes(task.status));
			}

			if (filter.priority && filter.priority.length > 0) {
				filtered = filtered.filter(
					(task) => task.priority && filter.priority!.includes(task.priority)
				);
			}

			if (filter.tags && filter.tags.length > 0) {
				filtered = filtered.filter(
					(task) => task.tags && filter.tags!.some((tag) => task.tags!.includes(tag))
				);
			}

			if (filter.archived !== undefined) {
				filtered = filtered.filter((task) => task.archived === filter.archived);
			}

			if (filter.dueBefore) {
				const before = filter.dueBefore;
				filtered = filtered.filter((task) => {
					// Include tasks due OR scheduled on or before the date
					return (task.due && task.due <= before) || (task.scheduled && task.scheduled <= before);
				});
			}

			if (filter.limit) {
				filtered = filtered.slice(0, filter.limit);
			}

			return filtered;
		};

		// Helper to convert getAllTasks result to array (handles Map, object, or array)
		const toTaskArray = async (): Promise<OfficialTaskInfo[]> => {
			const raw = await cacheManager.getAllTasks();
			if (Array.isArray(raw)) {
				return raw;
			} else if (raw instanceof Map) {
				return Array.from(raw.values());
			}
			return [];
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
				const allTasks = await toTaskArray();
				const filtered = filterTasks(allTasks, filter);
				return filtered.map((task) => TaskInfoSchema.parse(task));
			},
			createTask: async (data) => {
				const result = await taskService.createTask(data);
				// TaskNotes returns { file, taskInfo } - extract taskInfo
				const taskInfo = result.taskInfo;
				const parsed = TaskInfoSchema.safeParse(taskInfo);
				if (!parsed.success) {
					throw new Error(
						`TaskNotes plugin returned invalid data after creating task: ${parsed.error.message}`
					);
				}
				return parsed.data;
			},
			updateTask: async (path, updates) => {
				// TaskNotes expects (originalTask, updates), not (path, updates)
				// First try getTaskByPath, but fall back to searching all tasks
				let originalTask = cacheManager.getTaskByPath(path);

				// Check for null, undefined, or empty object (TaskNotes returns {} for non-task files)
				if (
					!originalTask ||
					(typeof originalTask === "object" && Object.keys(originalTask as object).length === 0)
				) {
					// Fallback: search all tasks for matching path
					const allTasks = await toTaskArray();
					originalTask = allTasks.find((t) => t.path === path) ?? null;
				}

				if (!originalTask) {
					throw new Error(`Task not found: ${path}`);
				}
				const result = await taskService.updateTask(originalTask, updates);
				const parsed = TaskInfoSchema.safeParse(result);
				if (!parsed.success) {
					throw new Error(
						`TaskNotes plugin returned invalid data after updating task: ${parsed.error.message}`
					);
				}
				return parsed.data;
			},
			getStats: async () => {
				// Compute stats from all tasks
				const allTasks = await toTaskArray();

				let completed = 0;
				let active = 0;
				let overdue = 0;
				let archived = 0;
				const today = new Date().toISOString().split("T")[0];

				for (const task of allTasks) {
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
				// Get filter options from filterService
				// Official FilterOptions has StatusConfig[] and PriorityConfig[], we extract the value strings
				try {
					const options = filterService.getFilterOptions();
					return TaskFilterOptionsSchema.parse({
						statuses: options.statuses.map((s) => s.value),
						priorities: options.priorities.map((p) => p.value),
					});
				} catch {
					// Fallback: build from cacheManager methods
					return TaskFilterOptionsSchema.parse({
						statuses: cacheManager.getAllStatuses(),
						priorities: cacheManager.getAllPriorities(),
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

	getTimeblocks(request: AuthenticatedRequest): TimeblocksInterface | null {
		if (!request.token.enabledTools.timeblocks) {
			return null;
		}
		if (!this.dailyNotes) {
			return null;
		}

		const ALIASES: Record<string, () => moment.Moment> = {
			today: () => window.moment(),
			yesterday: () => window.moment().subtract(1, "day"),
			tomorrow: () => window.moment().add(1, "day"),
		};

		const parseDate = (dateStr: string): moment.Moment => {
			if (Object.keys(ALIASES).includes(dateStr)) {
				return ALIASES[dateStr]();
			}
			const format = this.dailyNotes?.format || "YYYY-MM-DD";
			return window.moment(dateStr, format);
		};

		const getDailyNotePath = (date: moment.Moment): string => {
			const format = this.dailyNotes?.format || "YYYY-MM-DD";
			const folder = this.dailyNotes?.folder || "";
			const filename = date.format(format);
			const folderPath = folder ? `${folder}/` : "";
			return `${folderPath}${filename}.md`;
		};

		const parseFrontmatter = (
			content: string
		): { frontmatter: Record<string, unknown>; body: string } => {
			const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
			if (!match) {
				return { frontmatter: {}, body: content };
			}
			try {
				const frontmatter = parseYaml(match[1]) as Record<string, unknown>;
				return { frontmatter, body: match[2] };
			} catch {
				return { frontmatter: {}, body: content };
			}
		};

		const serializeWithFrontmatter = (
			frontmatter: Record<string, unknown>,
			body: string
		): string => {
			const yaml = stringifyYaml(frontmatter);
			return `---\n${yaml}---\n${body}`;
		};

		const validateTime = (time: string): boolean => {
			return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
		};

		const validateTimeRange = (startTime: string, endTime: string): boolean => {
			if (!validateTime(startTime) || !validateTime(endTime)) {
				return false;
			}
			const [startHour, startMin] = startTime.split(":").map(Number);
			const [endHour, endMin] = endTime.split(":").map(Number);
			const startMinutes = startHour * 60 + startMin;
			const endMinutes = endHour * 60 + endMin;
			return endMinutes > startMinutes;
		};

		return {
			getTimeblocks: async (date: string) => {
				const dateMoment = parseDate(date);
				if (!dateMoment.isValid()) {
					throw new Error(`Invalid date: ${date}`);
				}

				const filePath = getDailyNotePath(dateMoment);
				const file = this.app.vault.getFileByPath(filePath);
				if (!file) {
					return [];
				}

				const content = await this.read(file, request);
				const { frontmatter } = parseFrontmatter(content);
				const timeblocks = frontmatter.timeblocks;

				if (!timeblocks || !Array.isArray(timeblocks)) {
					return [];
				}

				const parsed = TimeBlockSchema.array().safeParse(timeblocks);
				return parsed.success ? parsed.data : [];
			},

			createTimeblock: async (date: string, data) => {
				const dateMoment = parseDate(date);
				if (!dateMoment.isValid()) {
					throw new Error(`Invalid date: ${date}`);
				}

				if (!validateTimeRange(data.startTime, data.endTime)) {
					throw new Error(
						`Invalid time range: ${data.startTime} to ${data.endTime}. Times must be in HH:MM format and endTime must be after startTime.`
					);
				}

				const id = `tb-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
				const newTimeblock = { id, ...data };

				const filePath = getDailyNotePath(dateMoment);
				let file = this.app.vault.getFileByPath(filePath);
				let content: string;
				let frontmatter: Record<string, unknown>;
				let body: string;

				if (!file) {
					file = await this.create(filePath, "", request);
					frontmatter = {};
					body = "";
				} else {
					content = await this.read(file, request);
					({ frontmatter, body } = parseFrontmatter(content));
				}

				const timeblocks = Array.isArray(frontmatter.timeblocks) ? frontmatter.timeblocks : [];
				timeblocks.push(newTimeblock);
				frontmatter.timeblocks = timeblocks;

				const newContent = serializeWithFrontmatter(frontmatter, body);
				await this.modify(file, newContent, request);

				return TimeBlockSchema.parse(newTimeblock);
			},

			updateTimeblock: async (date: string, id: string, updates) => {
				const dateMoment = parseDate(date);
				if (!dateMoment.isValid()) {
					throw new Error(`Invalid date: ${date}`);
				}

				const filePath = getDailyNotePath(dateMoment);
				const file = this.app.vault.getFileByPath(filePath);
				if (!file) {
					throw new Error(`Daily note not found for date: ${date}`);
				}

				const content = await this.read(file, request);
				const { frontmatter, body } = parseFrontmatter(content);

				if (!Array.isArray(frontmatter.timeblocks)) {
					throw new Error(`No timeblocks found for date: ${date}`);
				}

				const timeblocks = frontmatter.timeblocks as Record<string, unknown>[];
				const index = timeblocks.findIndex((tb) => tb.id === id);
				if (index === -1) {
					throw new Error(`Timeblock not found: ${id}`);
				}

				const updatedTimeblock = { ...timeblocks[index], ...updates };

				if (
					updates.startTime !== undefined ||
					updates.endTime !== undefined ||
					timeblocks[index].startTime !== undefined ||
					timeblocks[index].endTime !== undefined
				) {
					const startTime =
						updates.startTime !== undefined
							? updates.startTime
							: (timeblocks[index].startTime as string);
					const endTime =
						updates.endTime !== undefined ? updates.endTime : (timeblocks[index].endTime as string);
					if (!validateTimeRange(startTime, endTime)) {
						throw new Error(
							`Invalid time range: ${startTime} to ${endTime}. Times must be in HH:MM format and endTime must be after startTime.`
						);
					}
				}

				timeblocks[index] = updatedTimeblock;
				frontmatter.timeblocks = timeblocks;

				const newContent = serializeWithFrontmatter(frontmatter, body);
				await this.modify(file, newContent, request);

				return TimeBlockSchema.parse(updatedTimeblock);
			},

			deleteTimeblock: async (date: string, id: string) => {
				const dateMoment = parseDate(date);
				if (!dateMoment.isValid()) {
					throw new Error(`Invalid date: ${date}`);
				}

				const filePath = getDailyNotePath(dateMoment);
				const file = this.app.vault.getFileByPath(filePath);
				if (!file) {
					throw new Error(`Daily note not found for date: ${date}`);
				}

				const content = await this.read(file, request);
				const { frontmatter, body } = parseFrontmatter(content);

				if (!Array.isArray(frontmatter.timeblocks)) {
					throw new Error(`No timeblocks found for date: ${date}`);
				}

				const timeblocks = frontmatter.timeblocks as Record<string, unknown>[];
				const index = timeblocks.findIndex((tb) => tb.id === id);
				if (index === -1) {
					throw new Error(`Timeblock not found: ${id}`);
				}

				timeblocks.splice(index, 1);
				frontmatter.timeblocks = timeblocks;

				const newContent = serializeWithFrontmatter(frontmatter, body);
				await this.modify(file, newContent, request);
			},
		};
	}
}

declare module "obsidian" {
	interface App {
		internalPlugins: {
			plugins: Record<string, { [key: string]: unknown } | undefined>;
		};
	}
}
