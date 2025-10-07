import {
	createInfoBox,
	createCopyableCode,
	createCollapsibleDetailsSection,
} from "./ui_components";
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

	const settings: ConnectionSettings = {
		protocol: plugin.settings.server.httpsEnabled ? "https" : "http",
		host: plugin.settings.server.host || "127.0.0.1",
		port: plugin.settings.server.port,
	};

	if (!plugin.settings.server.httpsEnabled) {
		createHttpWarning(infoBox);
	}

	const httpEndpointUrl = `${settings.protocol}://${settings.host}:${settings.port}/mcp`;

	displayBasicConnectionInfo(infoBox, httpEndpointUrl, settings);

	const detailsEl = createCollapsibleDetailsSection(infoBox, "Example Configuration");
	addHttpConfig(detailsEl, httpEndpointUrl, settings);
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

function displayBasicConnectionInfo(
	container: HTMLElement,
	httpEndpointUrl: string,
	settings: ConnectionSettings
): void {
	const httpRow = container.createDiv({ cls: "mcp-copyable-row" });
	httpRow.createEl("span", {
		text: "HTTP URL",
		cls: "mcp-copyable-inline-label",
	});
	createCopyableCode(httpRow, httpEndpointUrl);

	if (settings.authToken) {
		createCopyableCode(container, `Authorization: Bearer ${settings.authToken}`);
	}
}

function addHttpConfig(
	container: HTMLElement,
	httpEndpointUrl: string,
	settings: ConnectionSettings
): void {
	const httpConfigJson = {
		type: "streamableHttp",
		url: httpEndpointUrl,
		headers: settings.authToken ? { Authorization: `Bearer ${settings.authToken}` } : {},
	};

	container
		.createDiv({ cls: "mcp-copyable-label" })
		.createEl("span", { text: "HTTP Configuration" });
	createCopyableCode(container, JSON.stringify(httpConfigJson, null, 2));
}
