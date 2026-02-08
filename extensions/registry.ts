import { logger } from "../tools/logging";

import type { Extension } from "./types";

/**
 * Event name triggered on `app.workspace` when the extension registry is ready.
 * The callback receives the `ExtensionRegistry` instance as its argument.
 *
 * Third-party plugins should listen for this event to handle the case where
 * they load before the MCP plugin:
 *
 * ```ts
 * this.registerEvent(
 *   this.app.workspace.on("obsidian-mcp:registry-ready", (registry) => {
 *     registry.register(myExtension);
 *   })
 * );
 * ```
 */
export const REGISTRY_READY_EVENT = "obsidian-mcp:registry-ready";

/**
 * Registry for MCP extensions. Built-in extensions are registered during
 * plugin startup, and third-party plugins can register extensions at any time.
 *
 * Because MCP sessions are created on-demand per HTTP request, extensions
 * registered after the server starts are automatically picked up by the next
 * session. This makes registration load-order independent — a third-party
 * plugin can register before or after the MCP plugin loads.
 *
 * ### Usage from another Obsidian plugin
 *
 * ```ts
 * // In your plugin's onload():
 * const mcpPlugin = this.app.plugins.plugins["obsidian-mcp-plugin"];
 * if (mcpPlugin?.extensionRegistry) {
 *   // MCP plugin already loaded — register directly
 *   mcpPlugin.extensionRegistry.register(myExtension);
 * } else {
 *   // MCP plugin not yet loaded — wait for the event
 *   this.registerEvent(
 *     this.app.workspace.on("obsidian-mcp:registry-ready", (registry) => {
 *       registry.register(myExtension);
 *     })
 *   );
 * }
 *
 * // In your plugin's onunload():
 * const mcpPlugin = this.app.plugins.plugins["obsidian-mcp-plugin"];
 * mcpPlugin?.extensionRegistry?.unregister(myExtension.id);
 * ```
 */
export class ExtensionRegistry {
	private extensions: Map<string, Extension> = new Map();

	register(extension: Extension): void {
		if (this.extensions.has(extension.id)) {
			logger.logImportant(
				`[ExtensionRegistry] Replacing existing extension: ${extension.id} (${extension.name})`
			);
		} else {
			logger.logImportant(
				`[ExtensionRegistry] Registered extension: ${extension.id} (${extension.name})`
			);
		}
		this.extensions.set(extension.id, extension);
	}

	unregister(id: string): void {
		if (this.extensions.delete(id)) {
			logger.logImportant(`[ExtensionRegistry] Unregistered extension: ${id}`);
		}
	}

	getAll(): Extension[] {
		return Array.from(this.extensions.values());
	}
}
