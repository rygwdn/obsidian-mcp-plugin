import { ToolAnnotations } from "@modelcontextprotocol/sdk/types";
import { z } from "zod";
import type { ObsidianInterface } from "../obsidian/obsidian_interface";

export interface ToolRegistration {
	annotations: ToolAnnotations;
	name: string;
	description: string;
	schema?: Record<string, z.ZodTypeAny>;
	handler: (obsidian: ObsidianInterface) => (args: Record<string, unknown>) => Promise<string>;
}
