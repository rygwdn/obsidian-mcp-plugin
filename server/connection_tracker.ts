import { logger } from "../tools/logging";
import { AuthenticatedRequest } from "./auth";

interface ActionParams {
	type: "tool" | "resource" | "prompt" | "error" | "jsonrpc";
	name: string;
	duration?: number;
	success: boolean;
	error?: string;
	details?: Record<string, unknown>;
}

export interface TokenAction extends ActionParams {
	id: string;
	timestamp: number;
	ip?: string;
	userAgent?: string;
}

export interface Token {
	tokenName: string;
	connectedAt: number;
	actions: TokenAction[];
	readonly lastActivityAt: number;
}

export class TokenTracker {
	private tokens: Map<string, Token> = new Map();
	private maxTokens = 100;
	private maxActionsPerToken = 500;

	private trackToken(tokenName: string): Token {
		const existing = this.tokens.get(tokenName);

		if (existing) {
			return existing;
		}

		const token: Token = {
			tokenName,
			connectedAt: Date.now(),
			actions: [],
			get lastActivityAt(): number {
				return this.actions[this.actions.length - 1]?.timestamp ?? Date.now();
			},
		};

		this.tokens.set(tokenName, token);
		this.pruneTokens();

		logger.log(`Token established: ${tokenName}`);

		return token;
	}

	public trackActionFromRequest(request: AuthenticatedRequest, action: ActionParams): void {
		const token: Token = this.trackToken(request.token?.name ?? "anonymous");
		const ip = request.ip ?? request.socket?.remoteAddress ?? undefined;
		const userAgent = request.headers?.["user-agent"] ?? undefined;

		const actionEntry: TokenAction = {
			...action,
			timestamp: Date.now(),
			id: `${token.tokenName}-${token.actions.length}`,
			ip,
			userAgent,
		};

		token.actions.push(actionEntry);

		if (token.actions.length > this.maxActionsPerToken) {
			token.actions.shift();
		}

		const logMessage = `${action.type.toUpperCase()}: ${action.name} (${action.success ? "success" : "failed"}${action.duration ? `, ${action.duration.toFixed(0)}ms` : ""})`;
		if (action.success) {
			logger.log(`[Token ${token.tokenName}] ${logMessage}`);
		} else {
			logger.logError(
				`[Token ${token.tokenName}] ${logMessage}${action.error ? `: ${action.error}` : ""}`
			);
		}
	}

	public getAllTokens(limit: number = 50): Token[] {
		return Array.from(this.tokens.values())
			.sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0))
			.slice(0, limit);
	}

	public getToken(tokenName: string | undefined): Token | undefined {
		const tokenKey = tokenName || "anonymous";
		return this.tokens.get(tokenKey);
	}

	private pruneTokens(): void {
		if (this.tokens.size <= this.maxTokens) return;

		const sorted = Array.from(this.tokens.entries()).sort(([, a], [, b]) => {
			return a.lastActivityAt - b.lastActivityAt;
		});

		const toRemove = sorted.slice(0, this.tokens.size - this.maxTokens);
		for (const [id] of toRemove) {
			this.tokens.delete(id);
		}
	}

	public clear(): void {
		this.tokens.clear();
	}
}
