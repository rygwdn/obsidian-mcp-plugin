import { type NextFunction, type Request, type Response } from "express";
import crypto from "crypto";

import type { AuthToken, MCPPluginSettings } from "../settings/types";
import { logger } from "../tools/logging";

import type { TokenTracker } from "./connection_tracker";

export const AUTHENTICATED_REQUEST_KEY = "__authenticatedRequest__";

export interface AuthenticatedRequest extends Request {
	[AUTHENTICATED_REQUEST_KEY]: true;
	token: AuthToken;
	trackAction(action: {
		type: "tool" | "resource" | "prompt" | "error" | "jsonrpc";
		name: string;
		duration?: number;
		success: boolean;
		error?: string;
		details?: Record<string, unknown>;
	}): void;
}

function isAuthenticatedRequest(value: unknown): value is AuthenticatedRequest {
	return (
		typeof value === "object" &&
		value !== null &&
		AUTHENTICATED_REQUEST_KEY in value &&
		(value as AuthenticatedRequest)[AUTHENTICATED_REQUEST_KEY] === true
	);
}

export function getRequest(
	value:
		| { authInfo?: { extra?: { request?: AuthenticatedRequest } } }
		| AuthenticatedRequest
		| undefined
): AuthenticatedRequest {
	if (isAuthenticatedRequest(value)) {
		return value;
	}

	if (isAuthenticatedRequest(value?.authInfo?.extra?.request)) {
		return value.authInfo.extra.request;
	}

	throw new Error("Authenticated request not found in context");
}

function createTrackAction(
	request: AuthenticatedRequest,
	tokenTracker: TokenTracker | null
): AuthenticatedRequest["trackAction"] {
	return (action: {
		type: "tool" | "resource" | "prompt" | "error" | "jsonrpc";
		name: string;
		duration?: number;
		success: boolean;
		error?: string;
		details?: Record<string, unknown>;
	}): void => {
		if (tokenTracker) {
			tokenTracker.trackActionFromRequest(request, action);
		}
	};
}

export class AuthManager {
	private tokenTracker: TokenTracker | null = null;

	constructor(protected settings: MCPPluginSettings) {}

	public setTokenTracker(tokenTracker: TokenTracker): void {
		this.tokenTracker = tokenTracker;
	}

	public updateSettings(settings: MCPPluginSettings): void {
		this.settings = settings;
	}

	/**
	 * Express middleware to validate Bearer token authentication
	 * Sets up the AuthenticatedRequest with token, obsidian, and permission methods
	 */
	public middleware() {
		return (req: Request, res: Response, next: NextFunction) => {
			// If no tokens configured, deny access
			if (this.settings.server.tokens.length === 0) {
				logger.log("[Auth] No tokens configured - access denied");
				return res.status(401).json({
					error: "Unauthorized",
					message: "Authentication required but no tokens configured",
				});
			}

			// Extract token from Authorization header
			const authHeader = req.headers.authorization;
			if (!authHeader || !authHeader.startsWith("Bearer ")) {
				logger.log("[Auth] Missing or invalid Authorization header");
				return res.status(401).json({
					error: "Unauthorized",
					message: "Missing or invalid Authorization header",
				});
			}

			const providedToken = authHeader.substring(7); // Remove "Bearer " prefix

			// Find matching token
			const token = this.settings.server.tokens.find((t) => t.token === providedToken);

			if (!token) {
				logger.log("[Auth] Invalid token");
				return res.status(401).json({
					error: "Unauthorized",
					message: "Invalid token",
				});
			}

			// Update last used timestamp
			token.lastUsed = Date.now();

			const authReq = req as AuthenticatedRequest;
			authReq[AUTHENTICATED_REQUEST_KEY] = true;
			authReq.token = token;
			authReq.trackAction = createTrackAction(authReq, this.tokenTracker);

			logger.log(`[Auth] Authenticated: ${token.name}`);
			next();
		};
	}

	/**
	 * Generate a secure random token
	 */
	public static generateToken(): string {
		return crypto.randomBytes(32).toString("base64url");
	}

	/**
	 * Create a new auth token
	 */
	public createToken(name: string): AuthToken {
		const token: AuthToken = {
			id: crypto.randomUUID(),
			name,
			token: AuthManager.generateToken(),
			createdAt: Date.now(),
			enabledTools: {
				file_access: true,
				search: true,
				update_content: true,
				dataview_query: true,
				quickadd: true,
				tasknotes: false,
			},
			directoryPermissions: {
				rules: [],
				rootPermission: true,
			},
		};

		this.settings.server.tokens.push(token);
		logger.log(`[Auth] Created token: ${name}`);

		return token;
	}

	/**
	 * Delete a token by ID
	 */
	public deleteToken(id: string): boolean {
		const index = this.settings.server.tokens.findIndex((t) => t.id === id);
		if (index === -1) {
			return false;
		}

		const token = this.settings.server.tokens[index];
		this.settings.server.tokens.splice(index, 1);
		logger.log(`[Auth] Deleted token: ${token.name}`);
		return true;
	}

	/**
	 * Get all tokens (without exposing the actual token values)
	 */
	public getTokens(): Omit<AuthToken, "token">[] {
		return this.settings.server.tokens.map((t) => ({
			id: t.id,
			name: t.name,
			createdAt: t.createdAt,
			lastUsed: t.lastUsed,
			enabledTools: t.enabledTools,
			directoryPermissions: t.directoryPermissions,
		}));
	}
}
