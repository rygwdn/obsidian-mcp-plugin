import { createInfoBox, createCopyableCode } from "./ui_components";
import ObsidianMCPPlugin from "../main";

interface ConnectionSettings {
	protocol: string;
	host: string;
	port: number;
	authToken?: string;
}

export function createConnectionInfoSection(
	plugin: ObsidianMCPPlugin,
	containerEl: HTMLElement
): void {
	const infoBox = createInfoBox(containerEl);

	if (!plugin.settings.server.enabled) {
		createServerDisabledWarning(infoBox);
		return;
	}

	// Use port 27126 for HTTPS, otherwise use configured port (default 27125)
	const port = plugin.settings.server.httpsEnabled ? 27126 : plugin.settings.server.port;
	const settings: ConnectionSettings = {
		protocol: plugin.settings.server.httpsEnabled ? "https" : "http",
		host: plugin.settings.server.host || "127.0.0.1",
		port: port,
	};

	if (!plugin.settings.server.httpsEnabled) {
		createHttpWarning(infoBox);
	}

	const httpEndpointUrl = `${settings.protocol}://${settings.host}:${settings.port}/mcp`;

	displayBasicConnectionInfo(infoBox, httpEndpointUrl);
}

function createServerDisabledWarning(container: HTMLElement): void {
	const warningEl = container.createEl("div", { cls: "mcp-warning" });
	warningEl.createEl("p", {
		text: "⚠️ The MCP server is currently disabled. Enable it in the Server Configuration section below to use MCP features.",
		cls: "mcp-warning-text",
	});
}

function createHttpWarning(container: HTMLElement): void {
	const warningEl = container.createEl("div", { cls: "mcp-warning" });
	warningEl.createEl("p", {
		text: "⚠️ HTTP mode is active. MCP clients typically require HTTPS. Consider enabling HTTPS in Server Configuration for better compatibility.",
		cls: "mcp-warning-text",
	});
}

function displayBasicConnectionInfo(container: HTMLElement, httpEndpointUrl: string): void {
	const httpRow = container.createDiv({ cls: "mcp-copyable-row" });
	httpRow.createEl("span", {
		text: "HTTP URL",
		cls: "mcp-copyable-inline-label",
	});
	createCopyableCode(httpRow, httpEndpointUrl);
}
