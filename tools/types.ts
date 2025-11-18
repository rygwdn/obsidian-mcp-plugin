import { ToolAnnotations } from "@modelcontextprotocol/sdk/types";
import { ZodRawShape } from "zod";
import type { ObsidianInterface } from "../obsidian/obsidian_interface";
import { AuthenticatedRequest } from "server/auth";

export interface ToolRegistration {
	annotations: ToolAnnotations;
	name: string;
	description: string;
	schema?: ZodRawShape;
	handler: (
		obsidian: ObsidianInterface,
		request: AuthenticatedRequest,
		args: Record<string, unknown>
	) => Promise<string>;
}
