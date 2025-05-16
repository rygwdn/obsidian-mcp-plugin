import { MCPPluginSettings } from "settings/types";
import { TFile, CachedMetadata } from "./obsidian_types";

export interface ObsidianInterface {
	settings: MCPPluginSettings;

	getMarkdownFiles(): TFile[];
	getFileByPath(path: string, permissions: "read" | "write" | "create"): Promise<TFile>;
	cachedRead(file: TFile): Promise<string>;
	read(file: TFile): Promise<string>;
	create(path: string, data: string): Promise<TFile>;
	modify(file: TFile, data: string): Promise<void>;
	createFolder(path: string): Promise<void>;
	getFileCache(file: TFile): CachedMetadata | null;
	checkFile(filePath: string): Promise<CheckFileResult>;
	search(query: string, fuzzy: boolean, folder?: string): Promise<SearchResult[]>;

	onFileModified(callback: (file: TFile) => void): void;

	quickAdd: QuickAddInterface | null;
	dataview: DataviewInterface | null;
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
