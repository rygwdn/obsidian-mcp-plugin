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

	const endpointUrl = `https://${apiSettings.bindingHost}:${apiSettings.port}/mcp`;
	const vaultNameForCommand = app.vault.getName().replace(/\s+/g, "");

	displayBasicConnectionInfo(infoBox, endpointUrl, apiSettings);

	const detailsEl = infoBox.createEl("details", { cls: "mcp-collapsible" });
	addClaudeCommand(detailsEl, vaultNameForCommand, endpointUrl, apiSettings);
	addStandardMcpConfig(detailsEl, endpointUrl, apiSettings);
	addSupergatewayConfig(detailsEl, vaultNameForCommand, endpointUrl, apiSettings);
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
	endpointUrl: string,
	apiSettings: LocalRestApiSettings
): void {
	const codeContainer = container.createDiv({ cls: "mcp-copyable-container" });
	createCopyableCode(codeContainer, endpointUrl);
	if (apiSettings.authToken) {
		createCopyableCode(codeContainer, `Authorization: Bearer ${apiSettings.authToken}`);
	}
}

function addClaudeCommand(
	container: HTMLElement,
	vaultName: string,
	endpointUrl: string,
	apiSettings: LocalRestApiSettings
): void {
	const claudeCommand = `claude mcp add -H 'Authorization: Bearer ${apiSettings.authToken}' -t sse ${vaultName} ${endpointUrl}`;

	const commandContainer = container.createDiv({ cls: "mcp-copyable-container" });
	commandContainer
		.createDiv({ cls: "mcp-copyable-label" })
		.createEl("span", { text: "Claude MCP Command" });
	createCopyableCode(commandContainer, claudeCommand);
}

function addStandardMcpConfig(
	container: HTMLElement,
	endpointUrl: string,
	apiSettings: LocalRestApiSettings
): void {
	const mcpConfigJson = {
		type: "sse",
		url: endpointUrl,
		headers: apiSettings.authToken ? { Authorization: `Bearer ${apiSettings.authToken}` } : {},
	};

	const jsonContainer = container.createDiv({ cls: "mcp-copyable-container" });
	jsonContainer
		.createDiv({ cls: "mcp-copyable-label" })
		.createEl("span", { text: "MCP JSON Configuration" });
	createCopyableCode(jsonContainer, JSON.stringify(mcpConfigJson, null, 2));
}

function addSupergatewayConfig(
	container: HTMLElement,
	vaultName: string,
	endpointUrl: string,
	apiSettings: LocalRestApiSettings
): void {
	const supergatewayJson = {
		[`${vaultName}`]: {
			type: "stdio",
			command: "npx",
			args: [
				"-y",
				"supergateway",
				"--sse",
				endpointUrl,
				...(apiSettings.authToken ? ["--oauth2Bearer", apiSettings.authToken] : []),
			],
			env: {
				NODE_TLS_REJECT_UNAUTHORIZED: "0",
			},
		},
	};

	const supergatewayContainer = container.createDiv({ cls: "mcp-copyable-container" });
	supergatewayContainer
		.createDiv({ cls: "mcp-copyable-label" })
		.createEl("span", { text: "Use supergateway to connect with STDIO" });
	createCopyableCode(supergatewayContainer, JSON.stringify(supergatewayJson, null, 2));

	const linkEl = supergatewayContainer.createEl("a", {
		text: "Learn more about supergateway",
		href: "https://github.com/supercorp-ai/supergateway",
	});
	linkEl.style.display = "block";
	linkEl.style.marginTop = "5px";
}
