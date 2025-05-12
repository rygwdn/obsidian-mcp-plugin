import { App } from "obsidian";
import { createInfoBox, createCopyableCode } from "./ui_components";
import { getLocalRestApiSettings, LocalRestApiSettings } from "./local_rest_api";

export function createConnectionInfoSection(app: App, containerEl: HTMLElement): void {
	const infoBox = createInfoBox(containerEl);

	const apiSettings = getLocalRestApiSettings(app);
	if (!apiSettings) {
		return;
	}

	if (!apiSettings.secureServerEnabled) {
		createSecureServerWarning(infoBox);
		return;
	}

	const streamingEndpointUrl = `https://${apiSettings.bindingHost}:${apiSettings.port}/mcp`;
	const sseEndpointUrl = `https://${apiSettings.bindingHost}:${apiSettings.port}/sse`;

	displayBasicConnectionInfo(infoBox, streamingEndpointUrl, sseEndpointUrl, apiSettings);

	const detailsEl = infoBox.createEl("details", { cls: "mcp-collapsible" });
	addConnectionConfigs(detailsEl, streamingEndpointUrl, sseEndpointUrl, apiSettings);
	addSupergatewayConfig(detailsEl, sseEndpointUrl, apiSettings);
}

function createSecureServerWarning(container: HTMLElement): void {
	const warningEl = container.createEl("div", { cls: "mcp-warning" });
	warningEl.createEl("p", {
		text: "⚠️ The Local REST API plugin must have 'Enable secure server' option enabled. MCP requires HTTPS for security.",
		cls: "mcp-warning-text",
	});

	warningEl.createEl("a", {
		text: "Configure Local REST API plugin",
		href: "obsidian://show-plugin?id=obsidian-local-rest-api",
	});
}

function displayBasicConnectionInfo(
	container: HTMLElement,
	streamingEndpointUrl: string,
	sseEndpointUrl: string,
	apiSettings: LocalRestApiSettings
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

	if (apiSettings.authToken) {
		createCopyableCode(container, `Authorization: Bearer ${apiSettings.authToken}`);
	}
}

function addConnectionConfigs(
	container: HTMLElement,
	streamingEndpointUrl: string,
	sseEndpointUrl: string,
	apiSettings: LocalRestApiSettings
): void {
	const streamingConfigJson = {
		type: "streamableHttp",
		url: streamingEndpointUrl,
		headers: apiSettings.authToken ? { Authorization: `Bearer ${apiSettings.authToken}` } : {},
	};

	container
		.createDiv({ cls: "mcp-copyable-label" })
		.createEl("span", { text: "Streaming HTTP Configuration" });
	createCopyableCode(container, JSON.stringify(streamingConfigJson, null, 2));

	const sseConfigJson = {
		type: "sse",
		url: sseEndpointUrl,
		headers: apiSettings.authToken ? { Authorization: `Bearer ${apiSettings.authToken}` } : {},
	};

	container
		.createDiv({ cls: "mcp-copyable-label" })
		.createEl("span", { text: "SSE Configuration" });
	createCopyableCode(container, JSON.stringify(sseConfigJson, null, 2));
}

function addSupergatewayConfig(
	container: HTMLElement,
	sseEndpointUrl: string,
	apiSettings: LocalRestApiSettings
): void {
	const supergatewayJson = {
		type: "stdio",
		command: "npx",
		args: [
			"-y",
			"supergateway",
			"--sse",
			sseEndpointUrl,
			...(apiSettings.authToken ? ["--oauth2Bearer", apiSettings.authToken] : []),
		],
		env: {
			NODE_TLS_REJECT_UNAUTHORIZED: "0",
		},
	};

	container
		.createDiv({ cls: "mcp-copyable-label" })
		.createEl("span", { text: "STDIO Configuration (using Supergateway)" });
	createCopyableCode(container, JSON.stringify(supergatewayJson, null, 2));

	const linkEl = container.createEl("a", {
		text: "Learn more about supergateway",
		href: "https://github.com/supercorp-ai/supergateway",
	});
	linkEl.style.display = "block";
	linkEl.style.marginTop = "5px";
}
