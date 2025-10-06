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

	const streamingEndpointUrl = `${settings.protocol}://${settings.host}:${settings.port}/mcp`;
	const sseEndpointUrl = `${settings.protocol}://${settings.host}:${settings.port}/sse`;

	displayBasicConnectionInfo(infoBox, streamingEndpointUrl, sseEndpointUrl, settings);

	const detailsEl = createCollapsibleDetailsSection(infoBox, "Example Configurations");
	addStreamingConfig(detailsEl, streamingEndpointUrl, settings);
	addSseConfig(detailsEl, sseEndpointUrl, settings);
	addSupergatewayConfig(detailsEl, sseEndpointUrl, settings);
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
	streamingEndpointUrl: string,
	sseEndpointUrl: string,
	settings: ConnectionSettings
): void {
	const streamingRow = container.createDiv({ cls: "mcp-copyable-row" });
	streamingRow.createEl("span", {
		text: "HTTP URL",
		cls: "mcp-copyable-inline-label",
	});
	createCopyableCode(streamingRow, streamingEndpointUrl);

	const sseRow = container.createDiv({ cls: "mcp-copyable-row" });
	sseRow.createEl("span", { text: "SSE URL", cls: "mcp-copyable-inline-label" });
	createCopyableCode(sseRow, sseEndpointUrl);

	if (settings.authToken) {
		createCopyableCode(container, `Authorization: Bearer ${settings.authToken}`);
	}
}

function addStreamingConfig(
	container: HTMLElement,
	streamingEndpointUrl: string,
	settings: ConnectionSettings
): void {
	const streamingConfigJson = {
		type: "streamableHttp",
		url: streamingEndpointUrl,
		headers: settings.authToken ? { Authorization: `Bearer ${settings.authToken}` } : {},
	};

	container
		.createDiv({ cls: "mcp-copyable-label" })
		.createEl("span", { text: "Streaming HTTP Configuration" });
	createCopyableCode(container, JSON.stringify(streamingConfigJson, null, 2));
}

function addSseConfig(
	container: HTMLElement,
	sseEndpointUrl: string,
	settings: ConnectionSettings
): void {
	const sseConfigJson = {
		type: "sse",
		url: sseEndpointUrl,
		headers: settings.authToken ? { Authorization: `Bearer ${settings.authToken}` } : {},
	};

	container
		.createDiv({ cls: "mcp-copyable-label" })
		.createEl("span", { text: "SSE Configuration" });
	createCopyableCode(container, JSON.stringify(sseConfigJson, null, 2));
}

function addSupergatewayConfig(
	container: HTMLElement,
	sseEndpointUrl: string,
	settings: ConnectionSettings
): void {
	const supergatewayJson = {
		type: "stdio",
		command: "npx",
		args: [
			"-y",
			"supergateway",
			"--sse",
			sseEndpointUrl,
			...(settings.authToken ? ["--oauth2Bearer", settings.authToken] : []),
		],
		env: {
			NODE_TLS_REJECT_UNAUTHORIZED: "0",
		},
	};

	container
		.createDiv({ cls: "mcp-copyable-label" })
		.createEl("span", { text: "STDIO Configuration (using Supergateway)" });
	createCopyableCode(container, JSON.stringify(supergatewayJson, null, 2));

	container.createEl("a", {
		text: "Learn more about supergateway",
		href: "https://github.com/supercorp-ai/supergateway",
		cls: "mcp-link",
	});
}
