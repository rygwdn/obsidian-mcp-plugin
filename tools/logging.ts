/**
 * Utilities for logging MCP operations
 */

export const LogPrefix = "[MCP]";

/**
 * Log a message with MCP prefix
 */
export function log(message: string, ...args: any[]): void {
    console.log(`${LogPrefix} ${message}`, ...args);
}

/**
 * Log an error with MCP prefix
 */
export function logError(message: string, ...args: any[]): void {
    console.error(`${LogPrefix} ${message}`, ...args);
}

/**
 * Track performance of an operation and log the result
 */
export async function withPerformanceLogging<T>(
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
        log(`${successMessage || operationName} completed (${duration}ms)`);
        return result;
    } catch (error) {
        const duration = (performance.now() - startTime).toFixed(2);
        logError(`${errorMessage || `Error in ${operationName}`} (${duration}ms)`, error);
        throw error;
    }
}

/**
 * Log tool registration
 */
export function logToolRegistration(toolName: string): void {
    log(`Registering tool: ${toolName}`);
}

/**
 * Log resource registration
 */
export function logResourceRegistration(resourceName: string): void {
    log(`Registering resource: ${resourceName}`);
}

/**
 * Log prompt registration
 */
export function logPromptRegistration(promptName: string, description: string, args: string[]): void {
    log(`Registering prompt: ${promptName}`, { description, args });
}

/**
 * Log connection information
 */
export function logConnection(connectionType: string, sessionId: string, request: any): void {
    log(`New ${connectionType} connection established: ${sessionId}`);
    log(`Client IP: ${request.ip || 'unknown'}, User-Agent: ${request.get('User-Agent') || 'unknown'}`);
}

/**
 * Log connection close
 */
export function logConnectionClosed(connectionType: string, sessionId: string): void {
    log(`${connectionType} connection closed: ${sessionId}`);
}

/**
 * Higher-order function to wrap tool handlers with logging
 */
export function withToolLogging(toolName: string, handler: Function): Function {
    return async (...args: any[]) => {
        log(`Tool called: ${toolName}`, ...args);
        return withPerformanceLogging(
            toolName,
            () => handler(...args),
            {
                successMessage: `Tool completed: ${toolName}`,
                errorMessage: `Error in tool: ${toolName}`
            }
        );
    };
}

/**
 * Higher-order function to wrap resource handlers with logging
 */
export function withResourceLogging(resourceName: string, handler: Function): Function {
    return async (...args: any[]) => {
        log(`Resource requested: ${resourceName}`, ...args);
        return withPerformanceLogging(
            resourceName,
            () => handler(...args),
            {
                successMessage: `Resource request completed: ${resourceName}`,
                errorMessage: `Error in resource: ${resourceName}`
            }
        );
    };
}

/**
 * Higher-order function to wrap prompt handlers with logging
 */
export function withPromptLogging(promptName: string, handler: Function): Function {
    return async (...args: any[]) => {
        log(`Prompt requested: ${promptName}`, ...args);
        return withPerformanceLogging(
            promptName,
            () => handler(...args),
            {
                successMessage: `Prompt processed: ${promptName}`,
                errorMessage: `Error processing prompt: ${promptName}`
            }
        );
    };
}