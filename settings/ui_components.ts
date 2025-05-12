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

export function createInfoBox(containerEl: HTMLElement, title?: string): HTMLElement {
	const infoDiv = containerEl.createDiv({ cls: "mcp-info-box" });
	if (title) {
		infoDiv.createEl("h4", { text: title });
	}
	return infoDiv;
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
	const copyButton = codeBlock.createEl("button", { cls: "mcp-copy-button", text: "📋" });

	copyButton.addEventListener("click", (e) => {
		e.preventDefault();
		navigator.clipboard.writeText(code).then(() => {
			const originalText = copyButton.textContent;
			copyButton.textContent = "Copied!";
			setTimeout(() => {
				copyButton.textContent = originalText;
			}, 2000);
		});
	});

	return codeBlock;
}
