import type { ToolRegistration } from "../tools/types";

/**
 * An extension bundles related MCP tools under a single name and ID.
 * Extensions are registered via {@link ExtensionRegistry} and enabled/disabled
 * per-token using the extension ID as the key in `enabledTools`.
 */
export interface Extension {
	/** Unique identifier, used as the key in AuthToken.enabledTools */
	id: string;
	/** Human-readable display name shown in settings UI */
	name: string;
	/** Tools provided by this extension */
	tools: ToolRegistration[];
}
