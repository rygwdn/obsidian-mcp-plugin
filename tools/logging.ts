export class Logger {
	private prefix: string;
	public getVerboseSetting: (() => boolean) | null = null;

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

	logToolRegistration(toolName: string): void {
		this.log(`Registering tool: ${toolName}`);
	}

	logResourceRegistration(resourceName: string): void {
		this.log(`Registering resource: ${resourceName}`);
	}

	logPromptRegistration(promptName: string, description: string, args: string[]): void {
		this.log(`Registering prompt: ${promptName}`, { description, args });
	}

	logConnection(
		connectionType: string,
		sessionId: string,
		request: {
			ip?: string;
			get: (header: string) => string | undefined;
		}
	): void {
		this.log(`New ${connectionType} connection established: ${sessionId}`);
		this.log(
			`Client IP: ${request.ip || "unknown"}, User-Agent: ${request.get("User-Agent") || "unknown"}`
		);
	}

	logConnectionClosed(connectionType: string, sessionId: string): void {
		this.log(`${connectionType} connection closed: ${sessionId}`);
	}

	withToolLogging<T>(
		toolName: string,
		handler: (...args: unknown[]) => Promise<T>
	): (...args: unknown[]) => Promise<T> {
		return async (...args: unknown[]) => {
			this.log(`Tool called: ${toolName}`, ...args);
			return this.withPerformanceLogging(toolName, () => handler(...args), {
				successMessage: `Tool completed: ${toolName}`,
				errorMessage: `Error in tool: ${toolName}`,
			});
		};
	}

	withResourceLogging<T>(
		resourceName: string,
		handler: (...args: unknown[]) => Promise<T>
	): (...args: unknown[]) => Promise<T> {
		return async (...args: unknown[]) => {
			this.log(`Resource requested: ${resourceName}`, ...args);
			return this.withPerformanceLogging(resourceName, () => handler(...args), {
				successMessage: `Resource request completed: ${resourceName}`,
				errorMessage: `Error in resource: ${resourceName}`,
			});
		};
	}

	withPromptLogging<T>(
		promptName: string,
		handler: (...args: unknown[]) => Promise<T>
	): (...args: unknown[]) => Promise<T> {
		return async (...args: unknown[]) => {
			this.log(`Prompt requested: ${promptName}`, ...args);
			return this.withPerformanceLogging(promptName, () => handler(...args), {
				successMessage: `Prompt processed: ${promptName}`,
				errorMessage: `Error processing prompt: ${promptName}`,
			});
		};
	}
}

export const logger = new Logger();
