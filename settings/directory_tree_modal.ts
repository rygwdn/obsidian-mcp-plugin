import { Modal, TFolder, App } from "obsidian";
import { createMcpButton } from "./ui_components";

export class DirectoryTreeModal extends Modal {
	private currentPath: string;
	private startingPath: string;

	constructor(
		app: App,
		private callback: (action: "allow" | "block" | "cancel", path: string | null) => void,
		startingPath: string = ""
	) {
		super(app);
		this.startingPath = startingPath;
		this.currentPath = startingPath;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.renderCurrentDirectory();
	}

	renderCurrentDirectory() {
		const { contentEl } = this;
		contentEl.empty();

		const headerEl = contentEl.createDiv({ cls: "mcp-directory-modal-header" });

		headerEl.createEl("h2", {
			text: this.currentPath ? `Select subdirectory of ${this.currentPath}` : "Select a folder",
		});

		if (this.currentPath) {
			const breadcrumbsEl = contentEl.createDiv({ cls: "mcp-directory-breadcrumbs" });
			const pathParts = this.currentPath.split("/");

			const rootLink = breadcrumbsEl.createEl("span", {
				text: "root",
				cls: "mcp-breadcrumb-link",
			});
			rootLink.addEventListener("click", () => {
				this.currentPath = "";
				this.renderCurrentDirectory();
			});

			let currentPath = "";
			for (let i = 0; i < pathParts.length; i++) {
				if (!pathParts[i]) continue;

				breadcrumbsEl.createSpan({ text: " / " });

				currentPath += (currentPath ? "/" : "") + pathParts[i];
				const partLink = breadcrumbsEl.createEl("span", {
					text: pathParts[i],
					cls: "mcp-breadcrumb-link",
				});

				if (currentPath !== this.currentPath) {
					const pathForClick = currentPath;
					partLink.addEventListener("click", () => {
						this.currentPath = pathForClick;
						this.renderCurrentDirectory();
					});
				} else {
					partLink.addClass("mcp-breadcrumb-current");
				}
			}
		}

		const folderList = contentEl.createDiv({ cls: "mcp-folder-list" });

		const folders = this.app.vault
			.getAllLoadedFiles()
			.filter((file): file is TFolder => file instanceof TFolder);

		const childFolders = folders
			.filter((folder) => {
				if (!this.currentPath && !folder.path.includes("/")) {
					return true;
				}

				if (this.currentPath) {
					const parentPath = this.currentPath + "/";
					return (
						folder.path.startsWith(parentPath) &&
						folder.path.substring(parentPath.length).indexOf("/") === -1
					);
				}

				return false;
			})
			.sort((a, b) => a.name.localeCompare(b.name));

		if (childFolders.length === 0) {
			folderList.createEl("p", {
				text: "No subdirectories found",
				cls: "mcp-empty-folders-message",
			});
		}

		childFolders.forEach((folder) => {
			const folderEl = folderList.createDiv({ cls: "mcp-folder-item" });

			folderEl.addEventListener("click", (event) => {
				if (
					event.target instanceof HTMLButtonElement ||
					(event.target instanceof HTMLElement && event.target.closest("button"))
				) {
					return;
				}
				this.currentPath = folder.path;
				this.renderCurrentDirectory();
			});
			folderEl.addClass("mcp-folder-item-navigable");

			const folderNameEl = folderEl.createSpan({
				text: folder.name,
				cls: "mcp-folder-name",
			});

			const subfolders = folders.filter((f) => {
				return (
					f.path.startsWith(folder.path + "/") &&
					f.path.substring(folder.path.length + 1).indexOf("/") === -1
				);
			});

			if (subfolders.length > 0) {
				folderNameEl.createSpan({
					text: ` (${subfolders.length} subfolder${subfolders.length > 1 ? "s" : ""})`,
					cls: "mcp-subfolder-count",
				});
			}

			createMcpButton(folderEl, {
				text: "Allow",
				additionalClasses: ["mcp-toggle-button", "mcp-allowed"],
				onClick: () => {
					this.callback("allow", folder.path);
					this.close();
				},
			});

			createMcpButton(folderEl, {
				text: "Block",
				additionalClasses: ["mcp-toggle-button", "mcp-blocked"],
				onClick: () => {
					this.callback("block", folder.path);
					this.close();
				},
			});
		});

		const buttonRow = contentEl.createDiv({ cls: "mcp-directory-modal-buttons" });

		if (this.currentPath && !this.isCurrentPathSameAsStarting()) {
			createMcpButton(buttonRow, {
				text: `Allow "${this.currentPath}"`,
				additionalClasses: ["mcp-toggle-button", "mcp-allowed"],
				onClick: () => {
					this.callback("allow", this.currentPath);
					this.close();
				},
			});

			createMcpButton(buttonRow, {
				text: `Block "${this.currentPath}"`,
				additionalClasses: ["mcp-toggle-button", "mcp-blocked"],
				onClick: () => {
					this.callback("block", this.currentPath);
					this.close();
				},
			});
		}

		createMcpButton(buttonRow, {
			text: "Cancel",
			additionalClasses: [],
			onClick: () => {
				this.callback("cancel", null);
				this.close();
			},
		});
	}

	isCurrentPathSameAsStarting(): boolean {
		return this.currentPath === this.startingPath;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export function showDirectoryTreeModal(
	app: App,
	callback: (action: "allow" | "block" | "cancel", path: string | null) => void,
	startingPath: string = ""
): void {
	const modal = new DirectoryTreeModal(app, callback, startingPath);
	modal.open();
}
