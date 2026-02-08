import type { ObsidianInterface } from "../obsidian/obsidian_interface";
import type { AuthenticatedRequest } from "../server/auth";
import type { ToolRegistration } from "../tools/types";

/**
 * Minimal structural type for the subset of Obsidian's App used by setting toggles.
 * Avoids importing from 'obsidian' directly (restricted by eslint).
 */
export interface SettingsApp {
	plugins: { enabledPlugins: Set<string> };
}

/**
 * Describes a settings toggle rendered in the per-token feature configuration.
 * Each toggle maps to a key in AuthToken.enabledTools.
 */
export interface ExtensionSettingToggle {
	/** Key in AuthToken.enabledTools that this toggle controls */
	key: string;
	/** Emoji icon shown in the token row feature summary */
	icon: string;
	/** Display name for the settings toggle (e.g., "📊 Dataview Integration") */
	name: string;
	/** Description shown when the backing plugin is available */
	description: string;
	/** Optional warning text appended to the description */
	warning?: string;
	/** Whether the backing Obsidian plugin is installed and enabled */
	isPluginAvailable(app: SettingsApp): boolean;
	/** Description shown when the backing plugin is not available */
	unavailableDescription(app: SettingsApp): string;
}

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
	/** Settings UI toggle configurations. One per enabledTools key this extension controls. */
	settingsUI?: ExtensionSettingToggle[];
}
