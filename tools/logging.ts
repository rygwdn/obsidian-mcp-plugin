import { ReadResourceTemplateCallback } from "@modelcontextprotocol/sdk/server/mcp";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol";
import { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types";
import { getRequest } from "server/auth";
import { TokenTracker } from "server/connection_tracker";

export class Logger {
	private prefix: string;
	public getVerboseSetting: (() => boolean) | null = null;
	public tokenTracker: TokenTracker | null = null;

	constructor(prefix: string = "[MCP]") {
		this.prefix = prefix;
	}

	private get isVerbose(): boolean {
		return this.getVerboseSetting?.() ?? false;
	}

	log(message: string, ...args: unknown[]): void {
		if (this.isVerbose) {
			console.log(`${this.prefix} ${message}`, ...args);
		}
	}

	logImportant(message: string, ...args: unknown[]): void {
		console.log(`${this.prefix} ${message}`, ...args);
	}

	logError(message: string, ...args: unknown[]): void {
		console.error(`${this.prefix} ${message}`, ...args);
	}

	async withPerformanceLogging<T>(
		operationName: string,
		fn: () => Promise<T>,
		logOptions: {
			successMessage?: string;
			errorMessage?: string;
		} = {}
	): Promise<T> {
		const startTime = performance.now();
		const { successMessage, errorMessage } = logOptions;

		try {
			const result = await fn();
			const duration = (performance.now() - startTime).toFixed(2);
			this.log(`${successMessage || operationName} completed (${duration}ms)`);
			return result;
		} catch (error) {
			const duration = (performance.now() - startTime).toFixed(2);
			this.logError(`${errorMessage || `Error in ${operationName}`} (${duration}ms)`, error);
			throw error;
		}
	}

	logConnection(
		connectionType: string,
		sessionId: string,
		request: {
			ip?: string;
			get: (header: string) => string | undefined;
		}
	): void {
		this.log(
			`${connectionType}:${sessionId}: connection established from ${request.ip || "unknown"}`
		);
	}

	logConnectionClosed(connectionType: string, sessionId: string): void {
		this.log(`${connectionType}:${sessionId}: connection closed`);
	}

	withResourceLogging<_T>(
		resourceName: string,
		handler: ReadResourceTemplateCallback
	): ReadResourceTemplateCallback {
		return async (uri, variables, extra) => {
			this.log(`Resource requested: ${resourceName}`, { uri, variables, extra });
			return this.withPerformanceLogging(
				resourceName,
				async () => {
					const result = await handler(uri, variables, extra);
					const request = getRequest(extra);
					request.trackAction({
						type: "resource",
						name: resourceName,
						success: result.isError ? false : true,
						details: { uri, variables, extra },
					});
					return result;
				},
				{
					successMessage: `Resource request completed: ${resourceName} ${uri} ${variables}`,
					errorMessage: `Error in resource: ${resourceName} ${uri} ${variables}`,
				}
			);
		};
	}

	withPromptLogging<T>(
		promptName: string,
		extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
		handler: (...args: unknown[]) => Promise<T>
	): (...args: unknown[]) => Promise<T> {
		return async (...args: unknown[]) => {
			this.log(`Prompt requested: ${promptName}`, ...args);
			return this.withPerformanceLogging(
				promptName,
				async () => {
					const result = await handler(...args);
					const request = getRequest(extra);
					request.trackAction({
						type: "prompt",
						name: promptName,
						success: true,
						details: { args },
					});
					return result;
				},
				{
					successMessage: `Prompt processed: ${promptName}`,
					errorMessage: `Error processing prompt: ${promptName}`,
				}
			);
		};
	}
}

export const logger = new Logger();
