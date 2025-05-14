import { ToolAnnotations } from "@modelcontextprotocol/sdk/types";
import { App } from "obsidian";
import { ZodRawShape } from "zod";
import { MCPPluginSettings } from "../settings/types";

export interface ToolRegistration {
	annotations: ToolAnnotations;
	name: string;
	description: string;
	schema?: ZodRawShape;
	handler: (
		app: App,
		settings: MCPPluginSettings
	) => (args: Record<string, unknown>) => Promise<string>;
}
