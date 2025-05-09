import { vi } from "vitest";
import yaml from "yaml";
import type * as Obsidian from "obsidian/obsidian.d.ts";

export class MockFile implements Obsidian.TFile, Obsidian.TFolder {
	name: string;
	stat: { ctime: number; mtime: number; size: number };
	basename: string;
	extension: string;
	parent: null = null;
	vault: Obsidian.Vault;

	get children(): Obsidian.TAbstractFile[] {
		return Array.from((this.vault as unknown as MockVault).files.entries())
			.filter(([path, _]) => path.startsWith(this.path))
			.filter(([_, file]) => !file.isFolder)
			.map(([_, file]) => file);
	}

	isRoot(): boolean {
		return this.path === "/";
	}

	constructor(
		public path: string,
		public contents: string = "",
		public isFolder: boolean = false
	) {
		this.name = path.split("/").pop() || "";
		this.basename = this.name.split(".")[0];
		this.extension = path.includes(".") ? path.split(".").pop() || "" : "";
		this.stat = {
			ctime: Date.now(),
			mtime: Date.now(),
			size: contents.length,
		};
	}
}

export class MockVaultAdapter implements Obsidian.DataAdapter {
	constructor(public vault: MockVault) {}

	append = vi.fn();
	process = vi.fn();
	trashSystem = vi.fn();
	trashLocal = vi.fn();
	copy = vi.fn();
	writeBinary = vi.fn();
	getResourcePath = vi.fn();
	mkdir = vi.fn();
	rmdir = vi.fn();
	remove = vi.fn();
	rename = vi.fn();
	readBinary = vi.fn();

	getName = vi.fn(() => "Test Vault");

	exists = vi.fn(async (path: string) => this.vault.files.has(path));

	stat = vi.fn(async (path: string) => {
		const file = this.vault.files.get(path);
		if (!file) return null;
		return {
			type: "file" as const,
			...file.stat,
			size: file.contents.length,
		};
	});

	read = vi.fn(async (path: string) => {
		const file = this.vault.files.get(path);
		if (!file) throw new Error("File not found");
		return file.contents;
	});

	write = vi.fn(async (path: string, content: string) => {
		const file = this.vault.files.get(path);
		if (!file) throw new Error("File not found");
		file.contents = content;
	});

	list = vi.fn(async () => {
		return {
			files: Array.from(this.vault.files.values())
				.filter((f) => !f.isFolder)
				.map((f) => f.path),
			folders: Array.from(this.vault.files.values())
				.filter((f) => f.isFolder)
				.map((f) => f.path),
		};
	});
}

class MockVault implements Obsidian.Vault {
	getRoot = vi.fn();
	create = vi.fn();
	createBinary = vi.fn();
	readBinary = vi.fn();
	getResourcePath = vi.fn();
	delete = vi.fn();
	trash = vi.fn();
	rename = vi.fn();
	modifyBinary = vi.fn();
	process = vi.fn();
	copy = vi.fn();
	getAllFolders = vi.fn();
	on = vi.fn();
	off = vi.fn();
	offref = vi.fn();
	trigger = vi.fn();
	tryTrigger = vi.fn();

	files: Map<string, MockFile> = new Map();
	adapter: Obsidian.DataAdapter = new MockVaultAdapter(this);
	configDir: string = "";

	getFiles = vi.fn(() => Array.from(this.files.values()));

	getAbstractFileByPath = vi.fn((path: string) => {
		const file = this.files.get(path);
		if (file) {
			return file;
		}
		return null;
	});

	cachedRead = vi.fn(async (file: Obsidian.TFile) => {
		if (file instanceof MockFile) {
			return file.contents;
		} else if (file) {
			throw new Error("Broken mock");
		}
		throw new Error("File not found");
	});

	read = vi.fn(async (file: Obsidian.TFile) => {
		if (file instanceof MockFile) {
			return file.contents;
		} else if (file) {
			throw new Error("Broken mock");
		}
		throw new Error("File not found");
	});

	createFolder = vi.fn(async (path: string) => {
		this.files.set(path, new MockFile(path, "", true));
		// Create and return a mock TFolder
		const folder: Partial<Obsidian.TFolder> = {
			path,
			name: path.split("/").pop() || "",
			children: [],
		};
		return folder as Obsidian.TFolder;
	});

	getName = vi.fn(() => "Test Vault");
	getFileByPath = vi.fn((path: string) => (this.files.get(path) ?? null) as Obsidian.TFile | null);
	getFolderByPath = vi.fn((path: string) => {
		if (this.files.has(path) && this.files.get(path)?.isFolder) {
			const folder: Partial<Obsidian.TFolder> = {
				path,
				name: path.split("/").pop() || "",
				children: [],
			};
			return folder as Obsidian.TFolder;
		}
		return null;
	});

	getMarkdownFiles = vi.fn(() =>
		Array.from(this.files.values()).filter((f) => f.extension === "md")
	);
	getAllLoadedFiles = vi.fn(() => Array.from(this.files.values()).filter((f) => !f.isFolder));
	modify = vi.fn(async (file: Obsidian.TFile, data: string) => {
		(file as MockFile).contents = data;
		this.files.set(file.path, new MockFile(file.path, data, false));
	});
	append = vi.fn(async (file: Obsidian.TFile, data: string) => {
		(file as MockFile).contents += data;
		const existingData = this.files.get(file.path);
		if (existingData) {
			this.files.set(file.path, new MockFile(file.path, existingData.contents + data, false));
		}
	});
}

export const Vault = MockVault as unknown as typeof Obsidian.Vault;

export class MockApp implements Obsidian.App {
	keymap = vi.fn()();
	scope = vi.fn()();
	metadataCache = {
		getFileCache: vi.fn((file: Obsidian.TFile) => {
			if (file instanceof MockFile) {
				const [frontdoc, bodydoc] = yaml.parseAllDocuments(file.contents);
				if (!bodydoc) {
					return {
						frontmatter: {},
						frontmatterPosition: { end: { offset: 0 } },
					};
				}

				const frontmatter = frontdoc.toJS();
				return {
					frontmatter,
					frontmatterPosition: {
						end: { offset: bodydoc.contents?.range[0] },
					},
				};
			}
			throw new Error("File not found");
		}),
		getCache: vi.fn(),
		getFirstLinkpathDest: vi.fn(),
		fileToLinktext: vi.fn(),
	} as unknown as Obsidian.MetadataCache;

	fileManager = vi.fn()();
	lastEvent = vi.fn()();

	loadLocalStorage = vi.fn();
	saveLocalStorage = vi.fn();
	prepareSimpleSearch = prepareSimpleSearch;
	prepareFuzzySearch = prepareFuzzySearch;

	mockVault: MockVault = new MockVault();
	get mockFiles() {
		return this.mockVault.files;
	}
	setFiles(files: { [path: string]: string }) {
		Object.entries(files).forEach(([path, contents]) => {
			this.mockVault.files.set(path, new MockFile(path, contents));
		});
	}

	vault: Obsidian.Vault = this.mockVault as unknown as Obsidian.Vault;
	plugins = {
		enabledPlugins: new Set<string>(),
		plugins: {},
	};
	workspace: Obsidian.Workspace = new Workspace() as unknown as Obsidian.Workspace;
}

export class EventRef implements Partial<Obsidian.EventRef> {}

class MockWorkspace implements Partial<Obsidian.Workspace> {
	on = vi.fn(() => new EventRef());
}

export const Workspace = MockWorkspace as unknown as typeof Obsidian.Workspace;
export const App = MockApp as unknown as typeof Obsidian.App;

export function normalizePath(path: string): string {
	return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export type SearchMatchPart = [number, number];

export function prepareSimpleSearch(query: string) {
	const lowercaseQuery = query.toLowerCase();

	return (text: string) => {
		const lowercaseText = text.toLowerCase();
		const index = lowercaseText.indexOf(lowercaseQuery);

		if (index === -1) {
			return null;
		}

		const matches: SearchMatchPart[] = [[index, index + query.length]];

		return {
			score: 1,
			matches: matches,
		};
	};
}

export function prepareFuzzySearch(query: string) {
	return prepareSimpleSearch(query); // Simplified for tests
}

export class PluginSettingTab implements Obsidian.PluginSettingTab {
	containerEl: HTMLElement;
	plugin: Obsidian.Plugin;

	constructor(plugin: Obsidian.Plugin) {
		this.plugin = plugin;
	}
	app: Obsidian.App;

	hide(): void {
		throw new Error("Method not implemented.");
	}

	display() {
		throw new Error("Method not implemented.");
	}
}
