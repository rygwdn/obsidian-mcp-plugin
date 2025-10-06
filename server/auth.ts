import { Request, Response, NextFunction } from "express";
import { MCPPluginSettings, TokenPermission, AuthToken } from "../settings/types";
import { logger } from "../tools/logging";
import crypto from "crypto";

export interface AuthenticatedRequest extends Request {
	token?: AuthToken;
	hasPermission: (permission: TokenPermission) => boolean;
}

export class AuthManager {
	constructor(private settings: MCPPluginSettings) {}

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

			// Attach token and permission check to request
			const authReq = req as AuthenticatedRequest;
			authReq.token = token;
			authReq.hasPermission = (permission: TokenPermission) => {
				return token.permissions.includes(permission);
			};

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
	public createToken(name: string, permissions: TokenPermission[]): AuthToken {
		const token: AuthToken = {
			id: crypto.randomUUID(),
			name,
			token: AuthManager.generateToken(),
			permissions,
			createdAt: Date.now(),
		};

		this.settings.server.tokens.push(token);
		logger.log(`[Auth] Created token: ${name} with permissions: ${permissions.join(", ")}`);

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
	 * Update token permissions
	 */
	public updateTokenPermissions(id: string, permissions: TokenPermission[]): boolean {
		const token = this.settings.server.tokens.find((t) => t.id === id);
		if (!token) {
			return false;
		}

		token.permissions = permissions;
		logger.log(`[Auth] Updated token ${token.name} permissions: ${permissions.join(", ")}`);
		return true;
	}

	/**
	 * Get all tokens (without exposing the actual token values)
	 */
	public getTokens(): Omit<AuthToken, "token">[] {
		return this.settings.server.tokens.map((t) => ({
			id: t.id,
			name: t.name,
			permissions: t.permissions,
			createdAt: t.createdAt,
			lastUsed: t.lastUsed,
		}));
	}
}
