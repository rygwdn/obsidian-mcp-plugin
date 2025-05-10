import { ToolAnnotations } from "@modelcontextprotocol/sdk/types";
import { App } from "obsidian";
import { ZodRawShape } from "zod";

export interface ToolRegistration {
	annotations: ToolAnnotations;
	name: string;
	description: string;
	schema?: ZodRawShape;
	// Use a less strict type that allows any object with string keys
	handler: (app: App) => (args: Record<string, unknown>) => Promise<string>;
}
