import { App } from "obsidian";
import { ZodRawShape } from "zod";

export interface ToolRegistration {
  name: string;
  description: string;
  schema: ZodRawShape;
  handler: (app: App) => (args: any) => Promise<string>;
};
