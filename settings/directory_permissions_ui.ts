import { Setting, Modal, TFolder, App } from "obsidian";
import ObsidianMCPPlugin from "../main";
import { createSection, createInfoBox } from "./ui_components";

export function createDirectoryPermissionsSection(
	plugin: ObsidianMCPPlugin,
	containerEl: HTMLElement
): void {
	createSection(containerEl, "Directory Permissions");

	const infoBox = createInfoBox(containerEl);
	infoBox.createEl("p", {
		text: "Control which directories can be accessed via MCP. You can either specify directories to block (blocklist mode) or directories to allow (allowlist mode).",
	});
	infoBox.createEl("p", {
		text: "Note: File permissions set in frontmatter (mcp_access, mcp_readonly) will override directory permissions.",
	});

	new Setting(containerEl)
		.setName("Permission Mode")
		.setDesc(
			"Choose whether to allow access to all directories except those blocked, or block access to all directories except those allowed."
		)
		.addDropdown((dropdown) => {
			dropdown
				.addOption("blocklist", "Blocklist (block specified directories)")
				.addOption("allowlist", "Allowlist (allow only specified directories)")
				.setValue(plugin.settings.directoryPermissions.mode)
				.onChange(async (value) => {
					plugin.settings.directoryPermissions.mode = value as "allowlist" | "blocklist";
					await plugin.saveSettings();
					containerEl.empty();
					createDirectoryPermissionsSection(plugin, containerEl);
				});
		});

	const modeDescEl = containerEl.createEl("p", { cls: "mcp-mode-description" });
	if (plugin.settings.directoryPermissions.mode === "allowlist") {
		modeDescEl.setText(
			"Allowlist mode: Only the directories listed below (and their subdirectories) will be accessible. All other directories will be blocked."
		);
	} else {
		modeDescEl.setText(
			"Blocklist mode: The directories listed below (and their subdirectories) will be blocked. All other directories will be accessible."
		);
	}

	const directoryListContainer = containerEl.createDiv({ cls: "mcp-directory-list" });

	plugin.settings.directoryPermissions.directories.forEach((dir, index) => {
		addDirectoryRow(plugin, directoryListContainer, dir, index);
	});

	const addButtonContainer = containerEl.createDiv({ cls: "mcp-add-directory-container" });
	const addButton = addButtonContainer.createEl("button", {
		text: "Add Directory",
		cls: "mcp-add-directory-button",
	});
	addButton.addEventListener("click", () => {
		showFolderSelectionDialog(plugin.app, (selectedPath) => {
			if (selectedPath) {
				plugin.settings.directoryPermissions.directories.push(selectedPath);
				addDirectoryRow(
					plugin,
					directoryListContainer,
					selectedPath,
					plugin.settings.directoryPermissions.directories.length - 1
				);
				plugin.saveSettings();
			}
		});
	});
}

function addDirectoryRow(
	plugin: ObsidianMCPPlugin,
	container: HTMLElement,
	dirPath: string,
	index: number
): void {
	const rowEl = container.createDiv({ cls: "mcp-directory-row" });

	const pathEl = rowEl.createSpan({ text: dirPath, cls: "mcp-directory-path" });

	const browseButton = rowEl.createEl("button", {
		text: "Browse",
		cls: "mcp-browse-directory-button",
	});
	browseButton.addEventListener("click", () => {
		showFolderSelectionDialog(plugin.app, (selectedPath) => {
			if (selectedPath) {
				plugin.settings.directoryPermissions.directories[index] = selectedPath;
				pathEl.setText(selectedPath);
				plugin.saveSettings();
			}
		});
	});

	const removeButton = rowEl.createEl("button", {
		text: "Remove",
		cls: "mcp-remove-directory-button",
	});
	removeButton.addEventListener("click", async () => {
		plugin.settings.directoryPermissions.directories.splice(index, 1);
		await plugin.saveSettings();
		const parentEl = container.parentElement!;
		parentEl.empty();
		createDirectoryPermissionsSection(plugin, parentEl);
	});
}

function showFolderSelectionDialog(app: App, callback: (path: string | null) => void): void {
	const modal = new FolderSelectionModal(app, callback);
	modal.open();
}

class FolderSelectionModal extends Modal {
	constructor(
		app: App,
		private callback: (path: string | null) => void
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Select a folder" });

		const folderList = contentEl.createDiv({ cls: "mcp-folder-list" });

		const folders = this.app.vault
			.getAllLoadedFiles()
			.filter((file): file is TFolder => file instanceof TFolder)
			.sort((a, b) => a.path.localeCompare(b.path));

		const rootEl = folderList.createDiv({ cls: "mcp-folder-item" });
		rootEl.createSpan({ text: "/ (root)" });
		rootEl.addEventListener("click", () => {
			this.callback("");
			this.close();
		});

		folders.forEach((folder) => {
			const folderEl = folderList.createDiv({ cls: "mcp-folder-item" });
			folderEl.createSpan({ text: folder.path });
			folderEl.addEventListener("click", () => {
				this.callback(folder.path);
				this.close();
			});
		});

		const cancelButton = contentEl.createEl("button", {
			text: "Cancel",
			cls: "mcp-cancel-button",
		});
		cancelButton.addEventListener("click", () => {
			this.callback(null);
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
