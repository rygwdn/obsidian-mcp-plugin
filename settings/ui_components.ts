import { Setting } from "obsidian";

export function createTextSetting({
	containerEl,
	name,
	desc,
	placeholder,
	getValue,
	setValue,
	saveSettings,
}: {
	containerEl: HTMLElement;
	name: string;
	desc: string;
	placeholder: string;
	getValue: () => string;
	setValue: (value: string) => void;
	saveSettings: () => Promise<void>;
}): Setting {
	return new Setting(containerEl)
		.setName(name)
		.setDesc(desc)
		.addText((text) =>
			text
				.setPlaceholder(placeholder)
				.setValue(getValue())
				.onChange(async (value) => {
					setValue(value);
					await saveSettings();
				})
		);
}

export function createTextAreaSetting({
	containerEl,
	name,
	desc,
	placeholder,
	getValue,
	setValue,
	saveSettings,
	rows = 4,
	cols = 50,
}: {
	containerEl: HTMLElement;
	name: string;
	desc: string;
	placeholder: string;
	getValue: () => string;
	setValue: (value: string) => void;
	saveSettings: () => Promise<void>;
	rows?: number;
	cols?: number;
}): Setting {
	return new Setting(containerEl)
		.setName(name)
		.setDesc(desc)
		.addTextArea((text) => {
			text
				.setPlaceholder(placeholder)
				.setValue(getValue())
				.onChange(async (value) => {
					setValue(value);
					await saveSettings();
				});
			text.inputEl.rows = rows;
			text.inputEl.cols = cols;
		});
}

export function createToggleSetting({
	containerEl,
	name,
	desc,
	getValue,
	setValue,
	saveSettings,
	disabled = false,
}: {
	containerEl: HTMLElement;
	name: string;
	desc: string;
	getValue: () => boolean;
	setValue: (value: boolean) => void;
	saveSettings: () => Promise<void>;
	disabled?: boolean;
}): Setting {
	const setting = new Setting(containerEl).setName(name).setDesc(desc);

	setting.addToggle((toggle) => {
		toggle
			.setValue(getValue())
			.setDisabled(disabled)
			.onChange(async (value) => {
				setValue(value);
				await saveSettings();
			});
	});

	return setting;
}

export function createSection(containerEl: HTMLElement, title: string): void {
	containerEl.createEl("h2", { text: title, cls: "mcp-settings-heading" });
}

export function createCollapsibleDetailsSection(
	parentElement: HTMLElement,
	summaryText: string,
	detailsClass?: string,
	summaryClass?: string
): HTMLDetailsElement {
	const detailsEl = parentElement.createEl("details", {
		cls: detailsClass ?? "mcp-collapsible",
	});
	detailsEl.createEl("summary", {
		text: summaryText,
		cls: summaryClass ?? "mcp-collapsible-summary",
	});
	return detailsEl;
}

export function createInfoBox(containerEl: HTMLElement): HTMLElement {
	return containerEl.createDiv({ cls: "mcp-info-box" });
}

export function createRequiredPluginWarning(
	containerEl: HTMLElement,
	isInstalled: boolean,
	pluginId: string,
	pluginName: string
): void {
	if (!isInstalled) {
		const warningEl = containerEl.createEl("div", { cls: "mcp-warning" });
		warningEl.createEl("p", {
			text: `⚠️ The ${pluginName} plugin is not installed or enabled. This plugin requires ${pluginName} to function properly.`,
			cls: "mcp-warning-text",
		});

		warningEl.createEl("a", {
			text: `Install or enable the ${pluginName} plugin`,
			href: `obsidian://show-plugin?id=${pluginId}`,
		});

		containerEl.createEl("hr");
	}
}

export function createCopyableCode(container: HTMLElement, code: string): HTMLElement {
	const codeBlock = container.createEl("pre", { cls: "mcp-copyable-code" });
	codeBlock.createEl("code", { text: code });

	const copyButton = createMcpButton(codeBlock, {
		text: "📋",
		additionalClasses: "mcp-copy-button",
		onClick: (e) => {
			e.preventDefault();
			navigator.clipboard.writeText(code).then(() => {
				copyButton.setText("Copied!");
				setTimeout(() => {
					copyButton.setText("📋");
				}, 2000);
			});
		},
	});

	return codeBlock;
}

export interface McpButtonOptions {
	text?: string;
	onClick: (event: MouseEvent) => void;
	additionalClasses?: string | string[];
}

export function createMcpButton(
	parentElement: HTMLElement,
	options: McpButtonOptions
): HTMLButtonElement {
	const button = parentElement.createEl("button");

	button.addClass("mcp-button");
	button.setText(options.text ?? "");
	button.addEventListener("click", options.onClick);

	if (options.additionalClasses) {
		if (Array.isArray(options.additionalClasses)) {
			button.addClasses(options.additionalClasses);
		} else {
			button.addClass(options.additionalClasses);
		}
	}

	return button;
}
