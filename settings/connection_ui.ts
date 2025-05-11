import { App } from "obsidian";
import { createInfoBox, createCopyableCode } from "./ui_components";
import { getLocalRestApiSettings } from "./local_rest_api";

export function createConnectionInfoSection(app: App, containerEl: HTMLElement): void {
	const infoBox = createInfoBox(containerEl);

	const apiSettings = getLocalRestApiSettings(app);
	if (!apiSettings) {
		return;
	}

	if (!apiSettings.secureServerEnabled) {
		const warningEl = infoBox.createEl("div", { cls: "mcp-warning" });
		warningEl.createEl("p", {
			text: "⚠️ The Local REST API plugin must have 'Enable secure server' option enabled. MCP requires HTTPS for security.",
			cls: "mcp-warning-text",
		});

		warningEl.createEl("a", {
			text: "Configure Local REST API plugin",
			href: "obsidian://show-plugin?id=obsidian-local-rest-api",
		});
		return;
	}

	const endpointUrl = `https://${apiSettings.bindingHost}:${apiSettings.port}/mcp`;

	const codeContainer = infoBox.createDiv({ cls: "mcp-copyable-container" });
	createCopyableCode(codeContainer, endpointUrl);
	if (apiSettings.authToken) {
		createCopyableCode(codeContainer, `Authorization: Bearer ${apiSettings.authToken}`);
	}

	const detailsEl = infoBox.createEl("details", { cls: "mcp-collapsible" });

	const vaultNameForCommand = app.vault.getName().replace(/\s+/g, "");
	const claudeCommand = `claude mcp add -H 'Authorization: Bearer ${apiSettings.authToken}' -t sse ${vaultNameForCommand} ${endpointUrl}`;
	const mcpConfigJson = {
		type: "sse",
		url: endpointUrl,
		headers: apiSettings.authToken ? { Authorization: `Bearer ${apiSettings.authToken}` } : {},
	};

	const jsonContainer = detailsEl.createDiv({ cls: "mcp-copyable-container" });
	jsonContainer
		.createDiv({ cls: "mcp-copyable-label" })
		.createEl("span", { text: "MCP JSON Configuration" });
	createCopyableCode(jsonContainer, JSON.stringify(mcpConfigJson));

	const commandContainer = detailsEl.createDiv({ cls: "mcp-copyable-container" });
	commandContainer
		.createDiv({ cls: "mcp-copyable-label" })
		.createEl("span", { text: "Claude MCP Command" });
	createCopyableCode(commandContainer, claudeCommand);
}
