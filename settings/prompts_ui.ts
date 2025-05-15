import { createCollapsibleDetailsSection } from "./ui_components";

export function createPromptsInstructions(containerEl: HTMLElement): void {
	const detailsEl = createCollapsibleDetailsSection(containerEl, "Prompt Instructions & Examples");

	const promptsInfoDiv = detailsEl.createDiv({ cls: "mcp-info-box" });

	promptsInfoDiv.createEl("p", {
		text: "Prompts can use frontmatter metadata to customize their behavior:",
	});

	const metadataList = promptsInfoDiv.createEl("ul");
	metadataList.createEl("li", {
		text: "description: Add a description field to explain what the prompt does",
	});
	metadataList.createEl("li", {
		text: "args: Define parameters that can be passed to the prompt (as an array of strings)",
	});
	metadataList.createEl("li", {
		text: "Use {{parameter_name}} in your prompt content to insert parameter values",
	});

	promptsInfoDiv.createEl("p", {
		text: "Example frontmatter:",
	});

	const exampleCode = promptsInfoDiv.createEl("pre");
	exampleCode.createEl("code", {
		text: '---\ndescription: This prompt generates a meeting summary\nargs: ["date", "participants"]\n---\n\nSummarize the meeting held on {{date}} with {{participants}}.',
	});
}
