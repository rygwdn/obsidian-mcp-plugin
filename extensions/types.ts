/**
 * Public extension API.
 *
 * These types form the stable contract between obsidian-mcp and third-party
 * extensions. They intentionally avoid library-specific types (Zod, MCP SDK)
 * so the underlying implementation can change without breaking extensions.
 */

// ---------------------------------------------------------------------------
// Tool parameter schema (JSON-Schema-like, library-independent)
// ---------------------------------------------------------------------------

/** Describes a single tool parameter. */
export interface ToolParameter {
	type: "string" | "number" | "boolean" | "array" | "object";
	description?: string;
	/** Restrict to a fixed set of allowed string values. */
	enum?: string[];
	/** Default value applied when the parameter is omitted. */
	default?: unknown;
	/** Element type when `type` is `"array"`. */
	items?: ToolParameter;
}

// ---------------------------------------------------------------------------
// Tool behaviour hints (protocol-independent)
// ---------------------------------------------------------------------------

/** Hints about what a tool does. Mapped to protocol-level annotations internally. */
export interface ToolHints {
	/** Tool only reads data, never modifies anything. */
	readOnly?: boolean;
	/** Tool may irreversibly change data. */
	destructive?: boolean;
	/** Calling the tool twice with the same args has the same effect as calling it once. */
	idempotent?: boolean;
}

// ---------------------------------------------------------------------------
// Tool context (passed to every handler at call-time)
// ---------------------------------------------------------------------------

/**
 * Runtime context handed to every tool handler.
 * Provides permission-checked helpers so extensions never need to deal
 * with raw auth tokens or internal interfaces.
 */
export interface ToolContext {
	/** Whether the file at `path` is readable by the current token. */
	isFileAccessible(path: string): Promise<boolean>;
	/** Whether the file at `path` is writable by the current token. */
	isFileModifiable(path: string): Promise<boolean>;
	/**
	 * Retrieve a plugin interface by name.
	 * Returns `null` when the plugin is unavailable or disabled for the token.
	 *
	 * Built-in names: `"dataview"`, `"quickadd"`, `"tasknotes"`, `"timeblocks"`.
	 */
	getPlugin(name: string): unknown;
}

// ---------------------------------------------------------------------------
// Extension tool definition
// ---------------------------------------------------------------------------

/** A single tool exposed by an extension. */
export interface ExtensionTool {
	/** MCP tool name (e.g. `"dataview_query"`). Must be unique across all extensions. */
	name: string;
	/** Short human-readable title shown in tool listings. */
	title?: string;
	/** Longer description sent to the model. */
	description: string;
	/**
	 * Parameter definitions keyed by parameter name.
	 * Omit for tools that take no arguments.
	 */
	parameters?: Record<string, ToolParameter>;
	/** Which parameter names are required (all others are optional). */
	required?: string[];
	/** Behavioural hints. */
	hints?: ToolHints;
	/** Tool implementation. Return a string that will be sent to the model. */
	handler(args: Record<string, unknown>, context: ToolContext): Promise<string>;
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

/**
 * An extension bundles related MCP tools under a single name and ID.
 * Extensions are registered via {@link ExtensionRegistry} and enabled/disabled
 * per-token using the extension ID as the key in `enabledTools`.
 */
export interface Extension {
	/** Unique identifier, used as the key in AuthToken.enabledTools. */
	id: string;
	/** Human-readable display name shown in settings UI. */
	name: string;
	/** Tools provided by this extension. */
	tools: ExtensionTool[];
}
