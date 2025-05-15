import { TFile } from "obsidian";
import ObsidianMCPPlugin from "../main";
import { createSection, createCollapsibleDetailsSection, createMcpButton } from "./ui_components";
import { showDirectoryTreeModal } from "./directory_tree_modal";
import { DirectoryRule } from "./types";
import { isFileAccessible } from "tools/permissions";

export class DirectoryPermissionsUI {
	private plugin: ObsidianMCPPlugin;
	private containerEl: HTMLElement;
	private rulesListContainer!: HTMLElement;
	private examplesContainer!: HTMLElement | null;
	private draggedRule: DirectoryRule | null = null;
	private hoveredOverRule: DirectoryRule | null = null;
	private lastRenderedRules: DirectoryRule[] = [];

	constructor(plugin: ObsidianMCPPlugin, containerEl: HTMLElement) {
		this.plugin = plugin;
		this.containerEl = containerEl;
		this.createDirectoryPermissionsSection();
	}

	private async _saveAndRefreshUI(): Promise<void> {
		await this.plugin.saveSettings();
		this._refreshUI();
	}

	private _refreshUI(): void {
		this.lastRenderedRules = [...this.plugin.settings.directoryPermissions.rules];
		this.rulesListContainer.empty();
		this.renderRulesList();
		this.updateExamples();
	}

	private createDirectoryPermissionsSection(): void {
		createSection(this.containerEl, "Directory Permissions");
		this.renderInfoSection(this.containerEl);

		this.rulesListContainer = this.containerEl.createDiv({ cls: "mcp-directory-rules-list" });
		this.renderRulesList();

		const addButtonContainer = this.containerEl.createDiv({ cls: "mcp-add-directory-container" });

		createMcpButton(addButtonContainer, {
			text: "Add Directory Rule",
			additionalClasses: "mcp-add-directory-button",
			onClick: async () => {
				showDirectoryTreeModal(this.plugin.app, async (action, path) => {
					if (action === "cancel" || !path) {
						return;
					}

					this.plugin.settings.directoryPermissions.rules.push({
						path: path,
						allowed: action === "allow",
					});
					await this._saveAndRefreshUI();
				});
			},
		});

		this.updateExamples();
	}

	private renderInfoSection(settingsContainer: HTMLElement): void {
		const infoDetails = createCollapsibleDetailsSection(
			settingsContainer,
			"Information & Examples"
		);

		const infoBox = infoDetails.createDiv({ cls: "mcp-info-box" });

		infoBox.createEl("p", {
			text: "Control which directories can be accessed via MCP by creating rules that are applied in order (first match wins).",
		});
		infoBox.createEl("p", {
			text: "Note: File permissions set in frontmatter (mcp_access, mcp_readonly) will override directory permissions.",
		});

		this.examplesContainer = infoDetails.createDiv({
			cls: "mcp-examples-container mcp-compact-examples",
		});
	}

	private renderRulesList(): void {
		const rules = this.plugin.settings.directoryPermissions.rules;

		if (rules.length === 0) {
			const emptyRow = this.rulesListContainer.createDiv({ cls: "mcp-directory-row" });

			emptyRow.createSpan({ cls: "mcp-drag-handle-placeholder" });
			emptyRow.createSpan({
				text: "Add your rules using the button below.",
				cls: "mcp-directory-path mcp-empty-rules-message",
			});

			emptyRow.createDiv({ cls: "mcp-button-container" });
		} else {
			rules.forEach((rule) => {
				this.addRuleRow(rule);
			});
		}

		this.addRootRuleRow();
	}

	private addRootRuleRow(): void {
		const rootRow = this.rulesListContainer.createDiv({ cls: "mcp-directory-row" });

		rootRow.createSpan({ cls: "mcp-drag-handle-placeholder" });

		rootRow.createSpan({
			text: "Root Directory (Default)",
			cls: "mcp-directory-path",
		});

		const toggleContainer = rootRow.createDiv({ cls: "mcp-button-container" });
		const rootToggleButton = createMcpButton(toggleContainer, {
			additionalClasses: "mcp-toggle-button",
			onClick: async () => {
				const newState = !this.plugin.settings.directoryPermissions.rootPermission;
				this.plugin.settings.directoryPermissions.rootPermission = newState;
				this.updateStateButton(rootToggleButton, newState);
				await this.plugin.saveSettings();
				this.updateExamples();
			},
		});
		this.updateStateButton(
			rootToggleButton,
			this.plugin.settings.directoryPermissions.rootPermission
		);

		rootRow.createDiv({ cls: "mcp-button-container" });
	}

	private updateStateButton(button: HTMLElement, newState: boolean): void {
		button.setText(newState ? "Allow" : "Block");
		button.removeClass(newState ? "mcp-blocked" : "mcp-allowed");
		button.addClass(newState ? "mcp-allowed" : "mcp-blocked");
	}

	private addRuleRow(rule: DirectoryRule): void {
		const realIndex = this.plugin.settings.directoryPermissions.rules.findIndex((r) => r === rule);

		const rowEl = this.rulesListContainer.createDiv({ cls: "mcp-directory-row" });
		rowEl.toggleClass("dragging", this.draggedRule === rule);

		const dragHandle = rowEl.createSpan({ cls: "mcp-drag-handle" });
		dragHandle.innerHTML = "⋮⋮";
		dragHandle.setAttribute("draggable", "true");

		this.setupDragEvents(dragHandle, rowEl, rule);

		rowEl.createSpan({
			text: rule.path,
			cls: "mcp-directory-path",
		});

		const toggleContainer = rowEl.createDiv({ cls: "mcp-button-container" });
		const toggleButton = createMcpButton(toggleContainer, {
			additionalClasses: "mcp-toggle-button",
			onClick: async () => {
				const newState = !rule.allowed;
				if (this.plugin.settings.directoryPermissions.rules[realIndex]) {
					this.plugin.settings.directoryPermissions.rules[realIndex].allowed = newState;
					this.updateStateButton(toggleButton, newState);
					await this.plugin.saveSettings();
					this.updateExamples();
				}
			},
		});
		this.updateStateButton(toggleButton, rule.allowed);

		const removeContainer = rowEl.createDiv({ cls: "mcp-button-container" });
		createMcpButton(removeContainer, {
			text: "Remove",
			additionalClasses: "mcp-remove-directory-button",
			onClick: async () => {
				if (this.plugin.settings.directoryPermissions.rules[realIndex] === rule) {
					this.plugin.settings.directoryPermissions.rules.splice(realIndex, 1);
					await this._saveAndRefreshUI();
				}
			},
		});
	}

	private refreshNextTick(force: boolean = false): void {
		const needsRefresh = (): boolean => {
			const currentRules = this.plugin.settings.directoryPermissions.rules;
			return (
				force ||
				this.lastRenderedRules.length !== currentRules.length ||
				this.lastRenderedRules.some((rule, index) => rule !== currentRules[index])
			);
		};

		if (!needsRefresh()) {
			return;
		}

		setTimeout(() => {
			if (needsRefresh()) {
				this._refreshUI();
			}
		}, 1);
	}

	private setupDragEvents(
		dragHandle: HTMLElement,
		rowEl: HTMLElement,
		ruleForThisRow: DirectoryRule
	): void {
		dragHandle.addEventListener("dragstart", () => {
			this.draggedRule = ruleForThisRow;
			this.hoveredOverRule = null;
			this.refreshNextTick(true);
		});

		dragHandle.addEventListener("dragend", () => {
			this.draggedRule = null;
			this.hoveredOverRule = null;
			this.refreshNextTick(true);
		});

		rowEl.addEventListener("dragover", (event) => {
			event.preventDefault();

			if (
				this.hoveredOverRule === ruleForThisRow ||
				!this.draggedRule ||
				this.draggedRule === ruleForThisRow
			) {
				return;
			}

			this.hoveredOverRule = ruleForThisRow;
			const rules = this.plugin.settings.directoryPermissions.rules;
			const draggedIndex = rules.indexOf(this.draggedRule);

			if (draggedIndex === -1) {
				console.error("Dragged rule not found in settings. Aborting dragover data update.");
				return;
			}

			rules.splice(draggedIndex, 1);
			const effectiveTargetIndex = rules.indexOf(ruleForThisRow);

			if (effectiveTargetIndex === -1) {
				console.error("Target rule not found after source removal. Reverting data change.");
				rules.splice(draggedIndex, 0, this.draggedRule);
				this.refreshNextTick();
				return;
			}

			const insertionIndex = Math.max(
				0,
				Math.min(
					effectiveTargetIndex < draggedIndex ? effectiveTargetIndex : effectiveTargetIndex + 1,
					rules.length
				)
			);

			rules.splice(insertionIndex, 0, this.draggedRule);

			this.refreshNextTick();
		});

		rowEl.addEventListener("dragleave", () => {
			if (this.hoveredOverRule === ruleForThisRow) {
				this.hoveredOverRule = null;
			}
			this.refreshNextTick(true);
		});

		rowEl.addEventListener("drop", (event) => {
			event.preventDefault();
			this.refreshNextTick(true);
		});
	}

	private updateExamples(): void {
		if (!this.examplesContainer) return;

		this.examplesContainer.empty();

		const markdownFiles = this.plugin.app.vault.getMarkdownFiles();
		if (markdownFiles.length === 0) return;

		const allowedContainer = this.examplesContainer.createDiv({ cls: "mcp-allowed-files" });
		allowedContainer.createEl("h4", { text: "Example Allowed Files", cls: "mcp-allowed-heading" });
		const allowedList = allowedContainer.createEl("ul", { cls: "mcp-file-list" });

		const blockedContainer = this.examplesContainer.createDiv({ cls: "mcp-blocked-files" });
		blockedContainer.createEl("h4", { text: "Example Blocked Files", cls: "mcp-blocked-heading" });
		const blockedList = blockedContainer.createEl("ul", { cls: "mcp-file-list" });

		const { allowedFiles, blockedFiles } = this.getSampleFilesByAccess(markdownFiles);

		allowedFiles.slice(0, 3).forEach((file) => {
			const li = allowedList.createEl("li", { cls: "mcp-file-example" });
			li.createSpan({ text: file.path, cls: "mcp-file-path-truncate" });
		});

		if (allowedFiles.length === 0) {
			allowedList.createEl("li", {
				text: "No files are allowed based on current rules",
				cls: "mcp-file-example",
			});
		}

		blockedFiles.slice(0, 3).forEach((file) => {
			const li = blockedList.createEl("li", { cls: "mcp-file-example" });
			li.createSpan({ text: file.path, cls: "mcp-file-path-truncate" });
		});

		if (blockedFiles.length === 0) {
			blockedList.createEl("li", {
				text: "No files are blocked based on current rules",
				cls: "mcp-file-example",
			});
		}
	}

	private getSampleFilesByAccess(files: TFile[]): { allowedFiles: TFile[]; blockedFiles: TFile[] } {
		const allowedFiles: TFile[] = [];
		const blockedFiles: TFile[] = [];

		for (const file of files) {
			if (isFileAccessible(this.plugin.app, file, this.plugin.settings)) {
				allowedFiles.push(file);
			} else {
				blockedFiles.push(file);
			}

			if (allowedFiles.length >= 3 && blockedFiles.length >= 3) {
				break;
			}
		}

		return { allowedFiles, blockedFiles };
	}
}

export function createDirectoryPermissionsSection(
	plugin: ObsidianMCPPlugin,
	containerEl: HTMLElement
): void {
	new DirectoryPermissionsUI(plugin, containerEl);
}
