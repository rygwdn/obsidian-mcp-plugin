import { TFile, CachedMetadata, FileStats, TFolder, Vault, TAbstractFile } from "obsidian";
import * as yaml from "yaml";
import {
	CheckFileResult,
	DailyNotesInterface,
	DataviewInterface,
	ObsidianInterface,
	QuickAddInterface,
	SearchResult,
} from "../obsidian/obsidian_interface";
import { DEFAULT_SETTINGS, MCPPluginSettings } from "settings/types";

export class MockObsidian implements ObsidianInterface {
	public markdownFiles: Map<string, MockFile> = new Map();
	public settings: MCPPluginSettings;

	constructor(
		settingsOverride: Partial<Omit<MCPPluginSettings, "enabledTools">> & {
			enabledTools?: Partial<MCPPluginSettings["enabledTools"]>;
		} = {}
	) {
		this.settings = {
			...DEFAULT_SETTINGS,
			...settingsOverride,
			enabledTools: {
				...DEFAULT_SETTINGS.enabledTools,
				...settingsOverride.enabledTools,
			},
			directoryPermissions: {
				...DEFAULT_SETTINGS.directoryPermissions,
				...settingsOverride.directoryPermissions,
			},
		};
	}

	async search(query: string, fuzzy: boolean, folder?: string): Promise<SearchResult[]> {
		const results: SearchResult[] = [];
		for (const file of this.getMarkdownFiles()) {
			if (folder && !file.path.startsWith(folder)) {
				continue;
			}
			const cachedContents = await this.cachedRead(file);
			const result = cachedContents.matchAll(new RegExp(query, "gi"));
			const matches = Array.from(result).map(
				(match) => [match.index, match.index + match[0].length] satisfies [number, number]
			);
			if (matches.length > 0) {
				results.push({ file, matches, cachedContents, score: 0 });
			}
		}
		return results;
	}

	async checkFile(filePath: string): Promise<CheckFileResult> {
		const file = this.markdownFiles.get(filePath);
		if (!file) {
			return { exists: false };
		}
		return {
			exists: true,
			file,
			isAccessible: true,
			isModifiable: true,
		};
	}

	setFiles(files: Record<string, string>) {
		for (const [path, content] of Object.entries(files)) {
			this.markdownFiles.set(path, new MockFile(path, content, false, this));
		}
	}

	getMarkdownFiles(): TFile[] {
		return Array.from(this.markdownFiles.values()).filter((file) => file.path.endsWith(".md"));
	}
	getFileByPath(path: string, permissions: "read" | "write" | "create"): Promise<TFile> {
		// Check if path is a directory (has files under it)
		const isDirectory = Array.from(this.markdownFiles.keys()).some((existingPath) =>
			existingPath.startsWith(path + "/")
		);

		// Reading directories directly should fail
		if (isDirectory && permissions === "read") {
			throw new Error(`File not found: ${path}`);
		}

		const file = this.markdownFiles.get(path);
		if (!file) {
			if (permissions === "create") {
				const newFile = new MockFile(path, "", false, this);
				this.markdownFiles.set(path, newFile);
				return Promise.resolve(newFile);
			}
			throw new Error(`File not found: ${path}`);
		}
		return Promise.resolve(file);
	}
	cachedRead(file: TFile): Promise<string> {
		return Promise.resolve((file as MockFile).contents);
	}
	read(file: TFile): Promise<string> {
		return Promise.resolve((file as MockFile).contents);
	}
	create(path: string, data: string): Promise<TFile> {
		const file = new MockFile(path, data, false, this);
		this.markdownFiles.set(path, file);
		return Promise.resolve(file);
	}
	modify(file: TFile, data: string): Promise<void> {
		(file as MockFile).contents = data;
		return Promise.resolve();
	}
	createFolder(path: string): Promise<void> {
		const file = new MockFile(path, "", true, this);
		this.markdownFiles.set(path, file);
		return Promise.resolve();
	}
	getFileCache(file: TFile): CachedMetadata | null {
		if (file instanceof MockFile) {
			return file.getMetadata();
		} else {
			throw new Error(`Unexpected file type in getFileCache: ${file}`);
		}
	}

	public modifiedCallback:
		| ((operation: "create" | "modify" | "rename" | "delete", file: TFile) => void)
		| null = null;

	onFileModified(
		callback: (operation: "create" | "modify" | "rename" | "delete", file: TFile) => void
	): void {
		if (this.modifiedCallback) {
			throw new Error("onFileModified already set");
		}
		this.modifiedCallback = callback;
	}

	deleteFile(path: string): void {
		const file = this.markdownFiles.get(path);
		if (file) {
			this.markdownFiles.delete(path);
			this.modifiedCallback?.("delete", file);
		}
	}

	clearFiles(): void {
		for (const file of this.getMarkdownFiles()) {
			this.deleteFile(file.path);
		}
	}

	quickAdd: QuickAddInterface | null;
	dataview: DataviewInterface | null;
	dailyNotes: DailyNotesInterface | null;
}

export class MockFile implements TFile, TFolder {
	parent: null = null;
	get vault(): Vault {
		throw new Error("Method not implemented.");
	}

	get children(): TAbstractFile[] {
		return Array.from(this.obsidian.markdownFiles.values()).filter(
			(file) => file.path.startsWith(this.path) && !file.isFolder
		);
	}

	get stat(): FileStats {
		return {
			ctime: new Date("2025-01-01").getTime(),
			mtime: new Date("2025-02-01").getTime(),
			size: this.contents.length,
		};
	}

	get name(): string {
		return this.path.split("/").pop() || "";
	}

	get basename(): string {
		return this.name.split(".")[0];
	}

	get extension(): string {
		return this.name.split(".").pop() || "";
	}

	isRoot(): boolean {
		return this.path === "/";
	}

	getMetadata(): CachedMetadata {
		const [frontdoc, bodydoc] = yaml.parseAllDocuments(this.contents);

		let line = 0;
		const matches = Array.from(this.contents.matchAll(/(#+)\s+(.*)/g) || []);

		const headings = Array.from(matches).map((match) => ({
			heading: match[2],
			level: match[1].length,
			position: {
				start: { offset: match.index, line: line++, col: 0 },
				end: { offset: match.index + match[0].length, line: line, col: 0 },
			},
		}));

		if (!bodydoc) {
			return { headings };
		}

		const frontmatter = frontdoc.toJS();
		return {
			headings,
			tags: (frontmatter.tags || []).map((tag: string) => ({ tag })),
			frontmatter,
			frontmatterPosition: {
				start: { offset: bodydoc.contents?.range[0] || 0, line: 0, col: 0 },
				end: { offset: bodydoc.contents?.range[0] || 0, line: 0, col: 0 },
			},
		};
	}

	constructor(
		public path: string,
		public contents: string = "",
		public isFolder: boolean = false,
		public obsidian: MockObsidian
	) {}
}
