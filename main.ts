import { Plugin, TFile, prepareSimpleSearch, normalizePath, App } from "obsidian";
import { getAPI, LocalRestApiPublicApi } from "obsidian-local-rest-api";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z, ZodError, ZodRawShape, ZodTypeAny } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types";
import { IncomingMessage, ServerResponse } from "http";

export default class ObsidianMCPPlugin extends Plugin {
	private api: LocalRestApiPublicApi;

	async registerRoutes() {
		this.api = getAPI(this.app, this.manifest);

		this.api.addRoute("/mcp").all(async (request, response) => {
			try {
				const server = new ObsidianMcpServer(this.app, {version: this.manifest.version});
				server.handleRequest(request, response);
			} catch (error) {
				console.error("Error handling MCP request:", error);
				response.status(500).json({
					jsonrpc: "2.0",
					error: {
						code: -32603,
						message: "Internal error"
					},
					id: null
				});
			}
		});
	}

	async onload() {
		if (this.app.plugins.enabledPlugins.has("obsidian-local-rest-api")) {
			await this.registerRoutes();
		}

		this.registerEvent(
			this.app.workspace.on(
				"obsidian-local-rest-api:loaded",
				this.registerRoutes.bind(this)
			)
		);
	}

	onunload() {
		if (this.api) {
			this.api.unregister();
		}
	}
}

class ObsidianMcpServer {
	private server: McpServer;
	private transport: StreamableHTTPServerTransport;

	constructor(private app: App, {version}: {version: string}) {
		this.server = new McpServer({
			name: "Obsidian MCP Plugin",
			version,
		});

		this.registerTools(this.server);

		this.transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		});
	}

	handleRequest(request: IncomingMessage & { body: unknown }, response: ServerResponse) {
		this.server.connect(this.transport);

		response.on("close", () => {
			this.server.close();
			this.transport.close();
		});

		this.transport.handleRequest(request, response, request.body);
	}

	private registerTools(server: McpServer) {
		server.tool("list_files",
			"Lists all files and directories in a specific Obsidian directory (relative to vault root)",
			{
				path: z.string().optional().describe("Path to list files from (relative to vault root). Defaults to root.")
			},
			this.wrapTool(this.listFilesTool)
		);

		server.tool("get_file_contents",
			"Gets the content of a file from the vault",
			{
				path: z.string().describe("Path to the file (relative to vault root)")
			},
			this.wrapTool(this.getFileContentsTool)
		);

		server.tool("search",
			"Searches vault files for the given query and returns matching files",
			{
				query: z.string().describe("Search query")
			},
			this.wrapTool(this.searchTool)
		);

		server.tool("append_content",
			"Appends content to the end of a file (creates the file if it doesn't exist)",
			{
				path: z.string().describe("Path to the file (relative to vault root)"),
				content: z.string().describe("Content to append to the file")
			},
			this.wrapTool(this.appendContentTool)
		);
	}

	private get adapter() {
		return this.app.vault.adapter;
	}

	private listFilesTool = async (args: { path?: string }) => {
		const dirPath = args.path ? normalizePath(args.path) : "";

		const files = [
			...new Set(
				this.app.vault
					.getFiles()
					.map((e) => e.path)
					.filter((filename) => filename.startsWith(dirPath))
					.map((filename) => {
						const subPath = filename.slice(dirPath.length);
						if (subPath.indexOf("/") > -1) {
							return subPath.slice(0, subPath.indexOf("/") + 1);
						}
						return subPath;
					})
			),
		];
		files.sort();

		if (files.length === 0) {
			throw new Error("No files found in path: " + dirPath);
		}

		return files.join("\n");
	};

	private getFileContentsTool = async (args: { path: string }) => {
		const filePath = normalizePath(args.path);
		const fileExists = await this.adapter.exists(filePath);

		if (fileExists && (await this.adapter.stat(filePath))?.type === "file") {
			const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
			const content = await this.app.vault.cachedRead(file);
			return content;
		} else {
			throw new Error("File not found: " + filePath);
		}
	};

	private searchTool = async (args: { query: string }) => {
		const query = args.query;
		const results = [];

		const search = prepareSimpleSearch(query);

			for (const file of this.app.vault.getMarkdownFiles()) {
				const cachedContents = await this.app.vault.cachedRead(file);
				const result = search(cachedContents);
				if (result) {
				results.push({
					filename: file.path
				});
			}
		}

		if (results.length === 0) {
			throw new Error("No results found for query: " + query);
		}

		return results.map(r => r.filename).join("\n");
	};

	private appendContentTool = async (args: { path: string, content: string }) => {
		const filePath = normalizePath(args.path);
		const content = args.content;

		try {
			await this.app.vault.createFolder(filePath.substring(0, filePath.lastIndexOf("/")));
		} catch {
			// the folder/file already exists, but we don't care
		}

		let fileContents = "";
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) {
			fileContents = await this.app.vault.read(file);
			if (!fileContents.endsWith("\n")) {
				fileContents += "\n";
			}
		}

		fileContents += content;

		await this.adapter.write(filePath, fileContents);

		return "Content appended successfully";
	};

	private wrapTool<Args extends ZodRawShape>(
		tool: (args: z.objectOutputType<Args, ZodTypeAny>) => Promise<string>
	) {
		return async (args: z.objectOutputType<Args, ZodTypeAny>): Promise<CallToolResult> => {
			try {
				const data = await tool(args);
				return {content: [{type: "text", text: data}]}
			} catch (error) {
				return {
					isError: true,
					content: [{
						type: "text",
						text: error instanceof ZodError ? error.message : error.toString(),
					}]
				};
			}
		};
	}

}

declare module "obsidian" {
	interface App {
		plugins: {
			enabledPlugins: Set<string>;
		};
	}
	interface Workspace {
		on(
			name: "obsidian-local-rest-api:loaded",
			callback: () => void,
			ctx?: any
		): EventRef;
	}
}
