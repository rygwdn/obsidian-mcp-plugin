import { z } from "zod";

import type { AuthenticatedRequest } from "../server/auth";
import type { MCPPluginSettings } from "settings/types";

import type { CachedMetadata, TFile } from "./obsidian_types";

export interface ObsidianInterface {
	settings: MCPPluginSettings;

	getMarkdownFiles(request: AuthenticatedRequest): TFile[];
	getFileByPath(
		path: string,
		permissions: "read" | "write" | "create",
		request: AuthenticatedRequest
	): Promise<TFile>;
	cachedRead(file: TFile, request: AuthenticatedRequest): Promise<string>;
	read(file: TFile, request: AuthenticatedRequest): Promise<string>;
	create(path: string, data: string, request: AuthenticatedRequest): Promise<TFile>;
	modify(file: TFile, data: string, request: AuthenticatedRequest): Promise<void>;
	createFolder(path: string, request: AuthenticatedRequest): Promise<void>;
	getFileCache(file: TFile): CachedMetadata | null;
	checkFile(filePath: string, request: AuthenticatedRequest): Promise<CheckFileResult>;
	search(
		query: string,
		fuzzy: boolean,
		folder: string | undefined,
		request: AuthenticatedRequest
	): Promise<SearchResult[]>;

	/**
	 * Get prompt files without permission checks.
	 * Used only for prompt registration at server startup where request context is not available.
	 */
	unsafeGetPromptFiles(settings: MCPPluginSettings): TFile[];

	/**
	 * Get files accessible by ANY token.
	 * Used only for autocomplete callbacks where request context is not available.
	 */
	getFilesForAnyToken(settings: MCPPluginSettings): TFile[];

	/**
	 * Get file cache for prompt files without permission checks.
	 * Only works for files in the prompts folder.
	 * Used only for prompt registration at server startup where request context is not available.
	 */
	unsafeGetPromptFileCache(settings: MCPPluginSettings, file: TFile): CachedMetadata | null;

	onFileModified(
		callback: (operation: "create" | "modify" | "rename" | "delete", file: TFile) => void
	): void;

	getQuickAdd(request: AuthenticatedRequest): QuickAddInterface | null;
	getDataview(request: AuthenticatedRequest): DataviewInterface | null;
	getTaskNotes(request: AuthenticatedRequest): TaskNotesInterface | null;
	getTimeblocks(request: AuthenticatedRequest): TimeblocksInterface | null;
	dailyNotes: DailyNotesInterface | null;
}

export interface QuickAddInterface {
	getChoices(): QuickAddChoice[];
	executeChoice(choiceNameOrId: string, variables?: Record<string, string>): Promise<void>;
	formatTemplate(
		template: string,
		variables?: Record<string, unknown>,
		clearVariables?: boolean
	): Promise<string>;
}

export interface QuickAddChoice {
	name: string;
	id: string;
	type?: string;
	format?: {
		format?: string;
		enabled?: boolean;
	};
}

export interface DataviewInterface {
	queryMarkdown(source: string): Promise<{ successful: boolean; value?: string; error?: string }>;
}

export interface DailyNotesInterface {
	format: string;
	folder: string;
}

// TaskNotes Zod schemas - single source of truth for types and validation
// Use .nullish() to accept both null (from plugin API) and undefined
// Note: TaskNotes uses `path` as the primary identifier, not `id`
export const TaskInfoSchema = z.object({
	id: z.string().nullish(),
	title: z.string(),
	status: z.string(),
	priority: z.string(),
	due: z.string().nullish(),
	scheduled: z.string().nullish(),
	path: z.string(),
	archived: z.boolean(),
	tags: z.array(z.string()).nullish(),
	contexts: z.array(z.string()).nullish(),
	projects: z.array(z.string()).nullish(),
	recurrence: z.string().nullish(),
	completedDate: z.string().nullish(),
	timeEstimate: z.number().nullish(),
	totalTrackedTime: z.number().nullish(),
	isBlocked: z.boolean().nullish(),
	isBlocking: z.boolean().nullish(),
	dateCreated: z.string().nullish(),
	dateModified: z.string().nullish(),
});
export type TaskInfo = z.infer<typeof TaskInfoSchema>;

export const TaskStatsSchema = z.object({
	total: z.number(),
	completed: z.number(),
	active: z.number(),
	overdue: z.number(),
	archived: z.number(),
});
export type TaskStats = z.infer<typeof TaskStatsSchema>;

export const TaskFilterOptionsSchema = z.object({
	statuses: z.array(z.string()),
	priorities: z.array(z.string()),
});
export type TaskFilterOptions = z.infer<typeof TaskFilterOptionsSchema>;

export interface TaskFilter {
	status?: string[];
	priority?: string[];
	dueBefore?: string;
	archived?: boolean;
	tags?: string[];
	limit?: number;
}

export interface TaskNotesInterface {
	getTaskByPath(path: string): TaskInfo | null;
	queryTasks(filter: TaskFilter): Promise<TaskInfo[]>;
	createTask(data: { title: string; [key: string]: unknown }): Promise<TaskInfo>;
	updateTask(id: string, updates: Record<string, unknown>): Promise<TaskInfo>;
	getStats(): Promise<TaskStats>;
	getFilterOptions(): TaskFilterOptions;
}

export const TimeBlockSchema = z.object({
	id: z.string(),
	title: z.string(),
	startTime: z.string(),
	endTime: z.string(),
	attachments: z.array(z.string()).optional(),
	color: z.string().optional(),
	description: z.string().optional(),
});
export type TimeBlock = z.infer<typeof TimeBlockSchema>;

export interface TimeblocksInterface {
	getTimeblocks(date: string): Promise<TimeBlock[]>;
	createTimeblock(date: string, data: Omit<TimeBlock, "id">): Promise<TimeBlock>;
	updateTimeblock(
		date: string,
		id: string,
		updates: Partial<Omit<TimeBlock, "id">>
	): Promise<TimeBlock>;
	deleteTimeblock(date: string, id: string): Promise<void>;
}

export interface SearchResult {
	score: number;
	matches: [number, number][];
	cachedContents: string;
	file: TFile;
}

export interface CheckFileExistsResult {
	exists: true;
	file: TFile;
	isAccessible: boolean;
	isModifiable: boolean;
}

export type CheckFileResult = { exists: false } | CheckFileExistsResult;
