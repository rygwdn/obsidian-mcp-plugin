import { App } from "obsidian";
import { z } from "zod";
import { ToolRegistration } from "./types";

interface QuickAddChoice {
	name: string;
	id: string;
	type?: string;
	command?: {
		name?: string;
		type?: string;
		templatePath?: string;
		format?: string;
		folder?: string;
		fileNameFormat?: string;
		caption?: string;
	};
	macros?: Array<unknown>;
	checkboxes?: Array<unknown>;
	captureToActiveFile?: boolean;
	// Add any other known properties here
}

interface QuickAddPlugin {
	api: {
		executeChoice: (choiceId: string, variables?: Record<string, string>) => Promise<void>;
		getChoices: () => QuickAddChoice[];
		format: (
			input: string,
			variables?: Record<string, unknown>,
			shouldClearVariables?: boolean
		) => Promise<string>;
	};
}

// Helper function to get and validate QuickAdd plugin instance
function getQuickAddPlugin(app: App): QuickAddPlugin {
	// Check if QuickAdd plugin is enabled
	if (!app.plugins.plugins.quickadd) {
		throw new Error("QuickAdd plugin is not enabled");
	}

	const quickAdd = app.plugins.plugins.quickadd as QuickAddPlugin;

	if (!quickAdd.api) {
		throw new Error("QuickAdd API is not available");
	}

	return quickAdd;
}

// Get choices from QuickAdd plugin settings
function getQuickAddChoices(app: App): QuickAddChoice[] {
	if (!app.plugins.plugins.quickadd) {
		throw new Error("QuickAdd plugin is not enabled");
	}

	const quickAddPlugin = app.plugins.plugins.quickadd as any;
	if (!quickAddPlugin.settings || !quickAddPlugin.settings.choices) {
		throw new Error("QuickAdd settings or choices not available");
	}

	return quickAddPlugin.settings.choices as QuickAddChoice[];
}

function formatChoicesAsMarkdown(choices: QuickAddChoice[]): string {
	if (choices.length === 0) {
		return "No QuickAdd choices found";
	}

	let markdown = "# Available QuickAdd Choices\n\n";

	// Group choices by type
	const choicesByType: Record<string, QuickAddChoice[]> = {};

	choices.forEach((choice) => {
		const type = choice.type || "Unknown";
		if (!choicesByType[type]) {
			choicesByType[type] = [];
		}
		choicesByType[type].push(choice);
	});

	// Format each type group
	Object.entries(choicesByType).forEach(([type, typeChoices]) => {
		markdown += `## ${type} Choices\n\n`;

		typeChoices.forEach((choice) => {
			markdown += `### ${choice.name}\n`;
			markdown += `- **ID**: \`${choice.id}\`\n`;

			if (choice.command) {
				markdown += "- **Command**:\n";
				Object.entries(choice.command).forEach(([key, value]) => {
					if (value !== undefined) {
						markdown += `  - ${key}: ${value}\n`;
					}
				});
			}

			if (choice.macros && choice.macros.length > 0) {
				markdown += `- **Macros**: ${choice.macros.length} defined\n`;
			}

			if (choice.checkboxes && choice.checkboxes.length > 0) {
				markdown += `- **Checkboxes**: ${choice.checkboxes.length} defined\n`;
			}

			if (choice.captureToActiveFile !== undefined) {
				markdown += `- **Capture to Active File**: ${choice.captureToActiveFile ? "Yes" : "No"}\n`;
			}

			markdown += "\n";
		});
	});

	markdown += "## Usage\n\n";
	markdown += "To execute a choice:\n";
	markdown += '```json\n{\n  "choice": "My Choice Name"\n}\n```\n\n';
	markdown += "You can also pass variables to the choice:\n";
	markdown +=
		'```json\n{\n  "choice": "My Choice Name",\n  "variables": {\n    "title": "My Document",\n    "tags": "tag1, tag2"\n  }\n}\n```\n\n';
	markdown += "To format a template:\n";
	markdown +=
		'```json\n{\n  "template": "Hello {{name}}!",\n  "variables": {\n    "name": "World"\n  }\n}\n```\n';

	return markdown;
}

export const quickAddListTool: ToolRegistration = {
	name: "quickadd_list",
	description: "List available QuickAdd choices",
	annotations: {
		title: "QuickAdd List Tool",
		readOnlyHint: true,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false,
	},
	schema: undefined,
	handler: (app: App) => async (_args: Record<string, unknown>) => {
		const choices = getQuickAddChoices(app);
		return formatChoicesAsMarkdown(choices);
	},
};

export const quickAddExecuteTool: ToolRegistration = {
	name: "quickadd_execute",
	description: "Execute a QuickAdd choice or format a template with optional variables",
	annotations: {
		title: "QuickAdd Execute Tool",
		readOnlyHint: false,
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: false,
	},
	schema: {
		choice: z.string().optional().describe("The name or ID of the QuickAdd choice to execute"),
		template: z.string().optional().describe("The template content to format"),
		variables: z
			.record(z.union([z.string(), z.number(), z.boolean()]))
			.optional()
			.describe("Optional variables to pass to the QuickAdd choice or template"),
	},
	handler: (app: App) => async (args: Record<string, unknown>) => {
		const { choice, template, variables } = args as {
			choice?: string;
			template?: string;
			variables?: Record<string, unknown>;
		};

		const quickAdd = getQuickAddPlugin(app);

		// Check if exactly one of choice or template is provided
		if ((choice && template) || (!choice && !template)) {
			throw new Error("You must provide exactly one of 'choice' or 'template' parameters");
		}

		if (choice) {
			const choices = getQuickAddChoices(app);
			const targetChoice = choices.find((c) => c.id === choice || c.name === choice);

			if (!targetChoice) {
				const availableChoices = formatChoicesAsMarkdown(choices);
				throw new Error(
					`QuickAdd choice not found: ${choice}. Available choices:\n\n${availableChoices}`
				);
			}

			try {
				await quickAdd.api.executeChoice(targetChoice.name, variables as Record<string, string>);
				return `Successfully executed QuickAdd choice: **${targetChoice.name}**`;
			} catch (error) {
				throw new Error(`Error executing QuickAdd choice: ${error.message}`);
			}
		} else {
			// Format template (template must be defined based on the check above)
			try {
				// Always clear variables (true as the third parameter)
				const result = await quickAdd.api.format(template!, variables, true);
				return result;
			} catch (error) {
				throw new Error(`Error formatting template: ${error.message}`);
			}
		}
	},
};

export function isQuickAddEnabled(app: App): boolean {
	return app.plugins.plugins.quickadd !== undefined;
}
