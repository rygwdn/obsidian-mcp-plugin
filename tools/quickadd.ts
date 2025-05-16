import { z } from "zod";
import { ToolRegistration } from "./types";
import type { ObsidianInterface, QuickAddChoice } from "../obsidian/obsidian_interface";

/**
 * Extracts variable names from a template string based on QuickAdd template syntax
 * Looks for patterns like:
 * - {{VALUE:<variable>}} or {{NAME:<variable>}}
 * - {{VDATE:<variable>, <format>}}
 * - {{VALUE}} or {{NAME}}
 *
 * @param templateString The template string to parse
 * @returns Array of unique variable names found in the template
 */
function extractVariablesFromTemplate(templateString: string): string[] {
	if (!templateString) return [];

	const variables: Set<string> = new Set();

	// Match {{VALUE:<variable>}} or {{NAME:<variable>}}
	const valueRegex = /{{(?:VALUE|NAME):([^},]+)(?:,[^}]+)?}}/g;
	let match: RegExpExecArray | null;

	while ((match = valueRegex.exec(templateString)) !== null) {
		variables.add(match[1].trim());
	}

	// Match {{VDATE:<variable>, <format>}}
	const vdateRegex = /{{VDATE:([^},]+),[^}]+}}/g;
	while ((match = vdateRegex.exec(templateString)) !== null) {
		variables.add(match[1].trim());
	}

	return Array.from(variables);
}

function formatChoicesAsMarkdown(choices: QuickAddChoice[]): string {
	let markdown = "# Available QuickAdd Choices\n\n";

	choices.forEach((choice) => {
		markdown += `- "${choice.name}"`;

		const templateFormat = choice.format?.enabled ? choice.format?.format : "";
		const variables = extractVariablesFromTemplate(templateFormat || "");

		if (variables.length > 0) {
			markdown += ` with variables: ${JSON.stringify(variables)}`;
		}

		markdown += "\n";
	});

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
	handler: (obsidian: ObsidianInterface) => async (_args: Record<string, unknown>) => {
		if (!obsidian.quickAdd) {
			throw new Error("QuickAdd plugin is not enabled");
		}

		const choices = obsidian.quickAdd.getChoices();
		if (choices.length === 0) {
			return "No QuickAdd choices found";
		}
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
	handler:
		(obsidian: ObsidianInterface) =>
		async (args: Record<string, unknown>): Promise<string> => {
			const { choice, template, variables } = args as {
				choice?: string;
				template?: string;
				variables?: Record<string, unknown>;
			};

			if (!obsidian.quickAdd) {
				throw new Error("QuickAdd plugin is not enabled");
			}

			if ((choice && template) || (!choice && !template)) {
				throw new Error("You must provide exactly one of 'choice' or 'template' parameters");
			}

			if (choice) {
				const choices = obsidian.quickAdd.getChoices();
				const targetChoice = choices.find((c) => c.id === choice || c.name === choice);

				if (!targetChoice) {
					const availableChoices = formatChoicesAsMarkdown(choices);
					throw new Error(
						`QuickAdd choice not found: ${choice}. Available choices:\n\n${availableChoices}`
					);
				}

				try {
					await obsidian.quickAdd.executeChoice(
						targetChoice.name,
						variables as Record<string, string>
					);
					return `Successfully executed QuickAdd choice: **${targetChoice.name}**`;
				} catch (error) {
					throw new Error(`Error executing QuickAdd choice: ${error.message}`);
				}
			} else {
				try {
					return await obsidian.quickAdd.formatTemplate(template!, variables, true);
				} catch (error) {
					throw new Error(`Error formatting template: ${error.message}`);
				}
			}
		},
};
