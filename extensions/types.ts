import type { ObsidianInterface } from "../obsidian/obsidian_interface";
import type { AuthenticatedRequest } from "../server/auth";
import type { ToolRegistration } from "../tools/types";

/**
 * An extension bundles related MCP tools and provides availability detection
 * for an Obsidian plugin integration.
 */
export interface Extension {
	/** Unique identifier, corresponds to a key in AuthToken.enabledTools */
	id: string;
	/** Human-readable display name */
	name: string;
	/** Tools provided by this extension */
	tools: ToolRegistration[];
	/**
	 * Whether the extension is available for the given request.
	 * Checks both token permissions and backing plugin availability.
	 */
	isAvailable(obsidian: ObsidianInterface, request: AuthenticatedRequest): boolean;
}
