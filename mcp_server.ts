import crypto from "crypto";
import type { Request, Response } from "express";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types";
import { z } from "zod";
import type { ZodTypeAny } from "zod";

import type { ObsidianInterface } from "./obsidian/obsidian_interface";
import type { AuthenticatedRequest } from "./server/auth";
import { getRequest } from "./server/auth";
import { DEFAULT_SETTINGS } from "./settings/types";
import type { ExtensionRegistry } from "extensions/registry";
import type { ExtensionTool, ToolContext, ToolHints, ToolParameter } from "extensions/types";
import { FileMetadataResource, getFileMetadataTool } from "tools/file_metadata";
import { getContentsTool } from "tools/get_contents";
import { logger } from "tools/logging";
import { searchTool } from "tools/search";
import type { ToolRegistration } from "tools/types";
import { updateContentTool } from "tools/update_content";
import { VaultDailyNoteResource, VaultFileResource } from "tools/vault_file_resource";

// ---------------------------------------------------------------------------
// Bridge: ExtensionTool → MCP SDK types
// ---------------------------------------------------------------------------

/** Convert a ToolParameter to a Zod schema. */
function paramToZod(param: ToolParameter, isRequired: boolean): ZodTypeAny {
	let schema: ZodTypeAny;

	if (param.enum) {
		schema = z.enum(param.enum as [string, ...string[]]);
	} else {
		switch (param.type) {
			case "string":
				schema = z.string();
				break;
			case "number":
				schema = z.number();
				break;
			case "boolean":
				schema = z.boolean();
				break;
			case "array":
				schema = z.array(param.items ? paramToZod(param.items, true) : z.unknown());
				break;
			case "object":
				schema = z.record(z.string(), z.unknown());
				break;
		}
	}

	if (param.description) schema = schema.describe(param.description);
	if (param.default !== undefined) schema = schema.default(param.default);
	if (!isRequired && param.default === undefined) schema = schema.optional();

	return schema;
}

/** Convert ExtensionTool.parameters → Record<string, ZodTypeAny> for the MCP SDK. */
function extensionParamsToZod(tool: ExtensionTool): Record<string, ZodTypeAny> | undefined {
	if (!tool.parameters) return undefined;
	const shape: Record<string, ZodTypeAny> = {};
	for (const [key, param] of Object.entries(tool.parameters)) {
		shape[key] = paramToZod(param, tool.required?.includes(key) ?? false);
	}
	return shape;
}

/** Convert ToolHints → MCP ToolAnnotations. */
function hintsToAnnotations(tool: ExtensionTool): ToolAnnotations {
	const h: ToolHints = tool.hints ?? {};
	return {
		title: tool.title,
		readOnlyHint: h.readOnly ?? false,
		destructiveHint: h.destructive ?? false,
		idempotentHint: h.idempotent ?? false,
		openWorldHint: false,
	};
}

// ---------------------------------------------------------------------------
// ToolContext implementation
// ---------------------------------------------------------------------------

class ToolContextImpl implements ToolContext {
	constructor(
		private obsidian: ObsidianInterface,
		private request: AuthenticatedRequest
	) {}

	async isFileAccessible(path: string): Promise<boolean> {
		const result = await this.obsidian.checkFile(path, this.request);
		return result.exists && result.isAccessible;
	}

	async isFileModifiable(path: string): Promise<boolean> {
		const result = await this.obsidian.checkFile(path, this.request);
		return result.exists && result.isModifiable;
	}

	getPlugin(name: string): unknown {
		switch (name) {
			case "dataview":
				return this.obsidian.getDataview(this.request);
			case "quickadd":
				return this.obsidian.getQuickAdd(this.request);
			case "tasknotes":
				return this.obsidian.getTaskNotes(this.request);
			case "timeblocks":
				return this.obsidian.getTimeblocks(this.request);
			default:
				return null;
		}
	}
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

export class ObsidianMcpServer {
	private transports: StreamableHTTPServerTransport[] = [];

	constructor(
		private obsidian: ObsidianInterface,
		private manifest: { version: string; name: string },
		private registry: ExtensionRegistry
	) {}

	public async handleHttpRequest(request: Request, response: Response) {
		const authReq = request as AuthenticatedRequest;

		const reqSession = request.header("mcp-session-id");
		let transport = this.transports.find((transport) => transport.sessionId === reqSession);

		if (!transport) {
			const server = this.createServer(authReq);
			transport = new StreamableHTTPServerTransport({
				sessionIdGenerator: () => crypto.randomBytes(16).toString("hex"),
				enableJsonResponse: true,
			});
			await server.connect(transport);
			this.transports.push(transport);
		}

		try {
			await logger.withPerformanceLogging(
				"HTTP request",
				async () => {
					(authReq as AuthenticatedRequest & { auth: AuthInfo }).auth = {
						token: reqSession || "unknown",
						clientId: "client",
						scopes: ["*"],
						extra: { request: authReq },
					} satisfies AuthInfo;
					await transport.handleRequest(authReq, response, authReq.body);
				},
				{
					successMessage: `HTTP request completed: ${transport.sessionId} ${JSON.stringify(request.body)} ${JSON.stringify(request.headers)}`,
					errorMessage: `Error handling HTTP request ${transport.sessionId} ${JSON.stringify(request.body)}`,
				}
			);
		} catch (error) {
			authReq.trackAction({
				type: "error",
				name: "HTTP Request Error",
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	public async close() {
		logger.log("Shutting down MCP server");
		for (const transport of this.transports) {
			await transport.close();
		}
		logger.log("MCP server closed");
	}

	private createServer(request: AuthenticatedRequest) {
		logger.log(`Initializing MCP server v${this.manifest.version}`);
		const vaultDescription =
			this.obsidian.settings.vaultDescription ?? DEFAULT_SETTINGS.vaultDescription;

		const server = new McpServer(
			{ name: this.manifest.name, version: this.manifest.version },
			{ instructions: vaultDescription }
		);

		server.server.onerror = (error) => {
			request.trackAction({
				type: "error",
				name: "Server Error",
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
		};

		this.registerTools(server, request);

		return server;
	}

	private registerTools(server: McpServer, request: AuthenticatedRequest) {
		const enabledTools = request.token.enabledTools;

		if (enabledTools.file_access) {
			new VaultFileResource(this.obsidian).register(server);
			new VaultDailyNoteResource(this.obsidian).register(server);
			new FileMetadataResource(this.obsidian).register(server);
			this.registerCoreTool(server, getContentsTool);
			this.registerCoreTool(server, getFileMetadataTool);
			this.registerCoreTool(server, searchTool);
		}

		if (enabledTools.update_content) {
			this.registerCoreTool(server, updateContentTool);
		}

		const allEnabledTools = enabledTools as Record<string, boolean>;
		for (const extension of this.registry.getAll()) {
			if (allEnabledTools[extension.id] !== false) {
				for (const tool of extension.tools) {
					this.registerExtensionTool(server, tool, extension.id, request);
				}
			}
		}
	}

	private registerExtensionTool(
		server: McpServer,
		tool: ExtensionTool,
		extensionId: string,
		request: AuthenticatedRequest
	) {
		const toolName = tool.name;
		const context = new ToolContextImpl(this.obsidian, request);

		const handler: ToolCallback = async (...cbArgs) => {
			const extra = cbArgs[cbArgs.length - 1];
			const req = getRequest(extra);

			const trackerParams = {
				type: "tool",
				name: toolName,
				details: { args: cbArgs },
			} as const;

			try {
				if (!this.registry.getAll().some((e) => e.id === extensionId)) {
					throw new Error(`Extension "${extensionId}" has been unregistered`);
				}
				const data = await tool.handler(cbArgs[0], context);
				req.trackAction({ ...trackerParams, success: true });
				return { content: [{ type: "text", text: data }] };
			} catch (error) {
				req.trackAction({ ...trackerParams, success: false, error: error.toString() });
				return { isError: true, content: [{ type: "text", text: error.toString() }] };
			}
		};

		const zodShape = extensionParamsToZod(tool);
		const annotations = hintsToAnnotations(tool);

		if (zodShape) {
			server.tool(toolName, tool.description, zodShape, annotations, handler);
		} else {
			server.tool(toolName, tool.description, annotations, handler);
		}
	}

	/** Register an internal core tool (uses the old ToolRegistration interface). */
	private registerCoreTool(server: McpServer, toolReg: ToolRegistration) {
		const toolName = toolReg.name;

		const handler: ToolCallback = async (...args) => {
			const extra = args[args.length - 1];
			const request = getRequest(extra);

			const trackerParams = {
				type: "tool",
				name: toolName,
				details: { args },
			} as const;

			try {
				const data = await toolReg.handler(this.obsidian, request, args[0]);
				request.trackAction({ ...trackerParams, success: true });
				return { content: [{ type: "text", text: data }] };
			} catch (error) {
				request.trackAction({ ...trackerParams, success: false, error: error.toString() });
				return {
					isError: true,
					content: [{ type: "text", text: error.toString() }],
				};
			}
		};

		if (toolReg.schema) {
			server.tool(toolName, toolReg.description, toolReg.schema, toolReg.annotations, handler);
		} else {
			server.tool(toolName, toolReg.description, toolReg.annotations, handler);
		}
	}
}
