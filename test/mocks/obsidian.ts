import { vi } from "vitest";

// Mock obsidian module
export class TFile {
	path: string;
	contents: string;

	constructor(path: string, contents: string = "") {
		this.path = path;
		this.contents = contents;
	}
}

export class VaultAdapter {
	files: Map<string, { content: string; isFolder: boolean }> = new Map();

	exists = vi.fn(async (path: string) => this.files.has(path));

	stat = vi.fn(async (path: string) => {
		const file = this.files.get(path);
		if (!file) return null;
		return { type: file.isFolder ? "folder" : "file" };
	});

	read = vi.fn(async (path: string) => {
		const file = this.files.get(path);
		if (!file) throw new Error("File not found");
		return file.content;
	});

	write = vi.fn(async (path: string, content: string) => {
		this.files.set(path, { content, isFolder: false });
	});
}

export class Vault {
	files: TFile[] = [];
	adapter: VaultAdapter = new VaultAdapter();

	getFiles = vi.fn(() => this.files);
	getMarkdownFiles = vi.fn(() => this.files.filter((f) => f.path.endsWith(".md")));

	getAbstractFileByPath = vi.fn((path: string) => {
		return this.files.find((f) => f.path === path) || null;
	});

	cachedRead = vi.fn(async (file: TFile) => {
		return file.contents;
	});

	read = vi.fn(async (file: TFile) => {
		return file.contents;
	});

	createFolder = vi.fn(async (path: string) => {
		this.adapter.files.set(path, { content: "", isFolder: true });
	});
}

export class App {
	vault: Vault = new Vault();
	plugins = {
		enabledPlugins: new Set<string>(),
	};
}

export class EventRef {}

export class Workspace {
	on = vi.fn(() => new EventRef());
}

// Mock the Plugin class
export class Plugin {
	manifest: { version: string } = { version: "1.0.0" };
	app: App = new App();

	registerEvent() {
		return new EventRef();
	}
}

export function normalizePath(path: string): string {
	// Simple normalization for tests
	return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export function prepareSimpleSearch(query: string) {
	return (text: string) => {
		return text.toLowerCase().includes(query.toLowerCase());
	};
}
