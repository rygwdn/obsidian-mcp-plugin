import { MCPPluginSettings } from "settings/types";
import { TFile, CachedMetadata } from "./obsidian_types";
import { AuthenticatedRequest } from "../server/auth";

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
