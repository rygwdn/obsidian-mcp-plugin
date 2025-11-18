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
import { DEFAULT_SETTINGS, MCPPluginSettings, AuthToken } from "settings/types";
import { AuthenticatedRequest, AUTHENTICATED_REQUEST_KEY } from "../server/auth";
import { isFileAccessibleWithToken, isFileModifiableWithToken } from "../tools/permissions";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types";
import { vi } from "vitest";

export class MockObsidian implements ObsidianInterface {
	public markdownFiles: Map<string, MockFile> = new Map();
	public settings: MCPPluginSettings;

	constructor(settingsOverride: Partial<MCPPluginSettings> = {}) {
		this.settings = {
			...DEFAULT_SETTINGS,
			...settingsOverride,
		};
	}

	async search(
		query: string,
		fuzzy: boolean,
		folder: string | undefined,
		request: AuthenticatedRequest
	): Promise<SearchResult[]> {
		const results: SearchResult[] = [];
		for (const file of this.getMarkdownFiles(request)) {
			if (folder && !file.path.startsWith(folder)) {
				continue;
			}
			const cachedContents = await this.cachedRead(file, request);
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

	async checkFile(filePath: string, request: AuthenticatedRequest): Promise<CheckFileResult> {
		const file = this.markdownFiles.get(filePath);
		if (!file) {
			return { exists: false };
		}
		return {
			exists: true,
			file,
			isAccessible: isFileAccessibleWithToken(this, file, request.token, request),
			isModifiable: isFileModifiableWithToken(this, file, request.token, request),
		};
	}

	setFiles(files: Record<string, string>) {
		for (const [path, content] of Object.entries(files)) {
			this.markdownFiles.set(path, new MockFile(path, content, false, this));
		}
	}

	getMarkdownFiles(request: AuthenticatedRequest): TFile[] {
		return Array.from(this.markdownFiles.values())
			.filter((file) => file.path.endsWith(".md"))
			.filter((file) => isFileAccessibleWithToken(this, file, request.token, request));
	}

	async getFileByPath(
		path: string,
		permissions: "read" | "write" | "create",
		request: AuthenticatedRequest
	): Promise<TFile> {
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

		if (!isFileAccessibleWithToken(this, file, request.token, request)) {
			throw new Error(`Access denied: ${path}`);
		}

		if (permissions === "write" && !isFileModifiableWithToken(this, file, request.token, request)) {
			throw new Error(`File is read-only: ${path}`);
		}

		return Promise.resolve(file);
	}

	cachedRead(file: TFile, request: AuthenticatedRequest): Promise<string> {
		if (!isFileAccessibleWithToken(this, file, request.token, request)) {
			throw new Error(`Access denied: ${file.path}`);
		}
		return Promise.resolve((file as MockFile).contents);
	}

	read(file: TFile, request: AuthenticatedRequest): Promise<string> {
		if (!isFileAccessibleWithToken(this, file, request.token, request)) {
			throw new Error(`Access denied: ${file.path}`);
		}
		return Promise.resolve((file as MockFile).contents);
	}

	async create(path: string, data: string, _request: AuthenticatedRequest): Promise<TFile> {
		const file = new MockFile(path, data, false, this);
		this.markdownFiles.set(path, file);
		return Promise.resolve(file);
	}

	async modify(file: TFile, data: string, request: AuthenticatedRequest): Promise<void> {
		if (!isFileModifiableWithToken(this, file, request.token, request)) {
			throw new Error(`File is read-only: ${file.path}`);
		}
		(file as MockFile).contents = data;
		return Promise.resolve();
	}

	async createFolder(path: string, _request: AuthenticatedRequest): Promise<void> {
		const file = new MockFile(path, "", true, this);
		this.markdownFiles.set(path, file);
		return Promise.resolve();
	}
	getFileCache(file: TFile): CachedMetadata | null {
		// Note: Permission checks should be done before calling this method
		// to avoid circular dependencies. This method just returns the cache.
		if (file instanceof MockFile) {
			return file.getMetadata();
		} else {
			throw new Error(`Unexpected file type in getFileCache: ${file}`);
		}
	}

	unsafeGetPromptFiles(settings: MCPPluginSettings): TFile[] {
		return Array.from(this.markdownFiles.values())
			.filter((file) => file.path.endsWith(".md"))
			.filter((file) => file.path.startsWith(settings.promptsFolder));
	}

	getFilesForAnyToken(_settings: MCPPluginSettings): TFile[] {
		// For mock, return all markdown files since we don't have real token checking
		return Array.from(this.markdownFiles.values()).filter((file) => file.path.endsWith(".md"));
	}

	unsafeGetPromptFileCache(settings: MCPPluginSettings, file: TFile): CachedMetadata | null {
		if (!file.path.startsWith(settings.promptsFolder)) {
			return null;
		}
		if (file instanceof MockFile) {
			return file.getMetadata();
		} else {
			throw new Error(`Unexpected file type in unsafeGetPromptFileCache: ${file}`);
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
		const allFiles = Array.from(this.markdownFiles.values()).filter((file) =>
			file.path.endsWith(".md")
		);
		for (const file of allFiles) {
			this.deleteFile(file.path);
		}
	}

	getQuickAdd(request: AuthenticatedRequest): QuickAddInterface | null {
		if (!request.token.enabledTools.quickadd) {
			return null;
		}
		return this.quickAdd;
	}

	getDataview(request: AuthenticatedRequest): DataviewInterface | null {
		if (!request.token.enabledTools.dataview_query) {
			return null;
		}
		return this.dataview;
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

/**
 * Create a mock AuthenticatedRequest for testing
 * @param obsidian The ObsidianInterface instance
 * @param tokenOverride Optional token to override default mock token
 * @returns A mock AuthenticatedRequest with permission methods
 */
export function createMockRequest(
	obsidian: ObsidianInterface,
	tokenOverride?: Partial<AuthToken>
): AuthenticatedRequest {
	const defaultToken: AuthToken = {
		id: "test-token-id",
		name: "Test Token",
		token: "test-token-value",
		createdAt: Date.now(),
		enabledTools: {
			file_access: true,
			search: true,
			update_content: true,
			dataview_query: true,
			quickadd: true,
		},
		directoryPermissions: {
			rules: [],
			rootPermission: true,
		},
		...tokenOverride,
	};

	const request: AuthenticatedRequest = {
		[AUTHENTICATED_REQUEST_KEY]: true,
		token: defaultToken,
		trackAction: () => {
			// Mock implementation - no-op for tests
		},
	} satisfies Partial<AuthenticatedRequest> as unknown as AuthenticatedRequest;

	return request;
}

export function createMockExtra(
	request: AuthenticatedRequest
): RequestHandlerExtra<ServerRequest, ServerNotification> {
	return {
		signal: new AbortController().signal,
		requestId: "test-request-id",
		sendNotification: vi.fn(),
		sendRequest: vi.fn(),
		authInfo: {
			token: request.token.token,
			clientId: "test-client",
			scopes: ["*"],
			extra: {
				request,
			},
		},
	};
}
