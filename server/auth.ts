import { Request, Response, NextFunction } from "express";
import { MCPPluginSettings, AuthToken } from "../settings/types";
import { logger } from "../tools/logging";
import crypto from "crypto";

export interface AuthenticatedRequest extends Request {
	token?: AuthToken;
}

export class AuthManager {
	constructor(protected settings: MCPPluginSettings) {}

	public updateSettings(settings: MCPPluginSettings): void {
		this.settings = settings;
	}

	/**
	 * Express middleware to validate Bearer token authentication
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
			authReq.token = token;

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
