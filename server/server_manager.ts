import * as https from "https";
import * as http from "http";
import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import forge, { pki } from "node-forge";
import { MCPPluginSettings, CryptoSettings } from "../settings/types";
import { logger } from "../tools/logging";
import { AuthManager, AuthenticatedRequest } from "./auth";
import type { TokenTracker } from "./connection_tracker";

const DEFAULT_BINDING_HOST = "127.0.0.1";
const CERT_NAME = "Obsidian MCP Plugin";

export class ServerManager {
	private secureServer: https.Server | null = null;
	private insecureServer: http.Server | null = null;
	private app: Express;
	private settings: MCPPluginSettings;
	private authManager: AuthManager;
	private tokenTracker: TokenTracker | null = null;
	private lastError: Error | null = null;

	constructor(settings: MCPPluginSettings, tokenTracker?: TokenTracker) {
		this.settings = settings;
		this.authManager = new AuthManager(settings);
		this.tokenTracker = tokenTracker || null;
		this.app = express();
		this.setupExpressMiddleware();
	}

	private setupExpressMiddleware(): void {
		this.app.use(cors());
		this.app.use(bodyParser.json({ limit: "50mb" }));
		this.app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));
		this.app.use(this.authManager.middleware());
		this.app.use(this.jsonRpcTrackingMiddleware());
	}

	private jsonRpcTrackingMiddleware() {
		return (req: Request, res: Response, next: NextFunction) => {
			if (!this.tokenTracker) {
				return next();
			}

			if (req.path !== "/mcp" || req.method !== "POST") {
				return next();
			}

			const authReq = req as AuthenticatedRequest;

			try {
				const body = req.body;
				if (!body) {
					return next();
				}

				const requests = Array.isArray(body) ? body : [body];

				for (const request of requests) {
					if (request && typeof request === "object" && request.jsonrpc === "2.0") {
						if (!request.method) {
							continue;
						}

						this.tokenTracker.trackActionFromRequest(authReq, {
							type: "jsonrpc",
							name: request.method,
							success: true,
							details: {
								params: request.params || {},
								requestId: request.id,
							},
						});
					}
				}
			} catch (error) {
				logger.logError("[ServerManager] Error tracking JSON-RPC request:", error);
			}

			next();
		};
	}

	public addRoute(path: string): express.IRoute {
		return this.app.route(path);
	}

	public async start(): Promise<void> {
		// Clear any previous error
		this.lastError = null;

		if (!this.settings.server.enabled) {
			logger.log("[MCP Server] Server disabled in settings");
			return;
		}

		if (this.settings.server.tokens.length === 0) {
			logger.log("[MCP Server] Server requires at least one authentication token to start");
			return;
		}

		try {
			await this.ensureCertificate();

			if (this.settings.server.httpsEnabled) {
				await this.startSecureServer();
			} else {
				await this.startInsecureServer();
			}
		} catch (error) {
			this.lastError = error instanceof Error ? error : new Error(String(error));
			// Attempt to close any partially started servers
			await this.cleanupFailedStart();
			throw error;
		}
	}

	public async stop(): Promise<void> {
		if (this.secureServer) {
			await new Promise<void>((resolve) => {
				this.secureServer?.close(() => {
					logger.log("[MCP Server] Secure server stopped");
					resolve();
				});
			});
			this.secureServer = null;
		}

		if (this.insecureServer) {
			await new Promise<void>((resolve) => {
				this.insecureServer?.close(() => {
					logger.log("[MCP Server] Insecure server stopped");
					resolve();
				});
			});
			this.insecureServer = null;
		}
	}

	private async cleanupFailedStart(): Promise<void> {
		// Attempt to close any servers that might have been partially started
		const cleanupPromises: Promise<void>[] = [];

		if (this.secureServer) {
			cleanupPromises.push(
				new Promise<void>((resolve) => {
					try {
						this.secureServer?.close(() => {
							logger.log("[MCP Server] Cleaned up failed secure server");
							resolve();
						});
						// If close callback doesn't fire, resolve after a timeout
						setTimeout(() => resolve(), 100);
					} catch (error) {
						logger.logError("[MCP Server] Error cleaning up secure server:", error);
						resolve();
					}
				})
			);
		}

		if (this.insecureServer) {
			cleanupPromises.push(
				new Promise<void>((resolve) => {
					try {
						this.insecureServer?.close(() => {
							logger.log("[MCP Server] Cleaned up failed insecure server");
							resolve();
						});
						// If close callback doesn't fire, resolve after a timeout
						setTimeout(() => resolve(), 100);
					} catch (error) {
						logger.logError("[MCP Server] Error cleaning up insecure server:", error);
						resolve();
					}
				})
			);
		}

		await Promise.all(cleanupPromises);

		// Ensure servers are set to null after cleanup
		this.secureServer = null;
		this.insecureServer = null;
	}

	public async restart(): Promise<void> {
		logger.log("[MCP Server] Restarting server");
		await this.stop();
		await this.start();
	}

	public isRunning(): boolean {
		return this.secureServer !== null || this.insecureServer !== null;
	}

	public getLastError(): Error | null {
		return this.lastError;
	}

	public clearError(): void {
		this.lastError = null;
	}

	public updateSettings(settings: MCPPluginSettings): void {
		this.settings = settings;
		this.authManager.updateSettings(settings);
	}

	private getPort(): number {
		if (this.settings.server.httpsEnabled) {
			return 27126;
		}
		return this.settings.server.port;
	}

	public getServerUrl(): string {
		const protocol = this.settings.server.httpsEnabled ? "https" : "http";
		const host = this.settings.server.host || DEFAULT_BINDING_HOST;
		const port = this.getPort();
		return `${protocol}://${host}:${port}`;
	}

	public getAuthManager(): AuthManager {
		return this.authManager;
	}

	private async startSecureServer(): Promise<void> {
		if (!this.settings.server.crypto) {
			throw new Error("Cannot start secure server: no certificate available");
		}

		this.secureServer = https.createServer(
			{
				key: this.settings.server.crypto.privateKey,
				cert: this.settings.server.crypto.cert,
			},
			this.app
		);

		await new Promise<void>((resolve, reject) => {
			const port = this.getPort();
			this.secureServer!.listen(port, this.settings.server.host || DEFAULT_BINDING_HOST, () => {
				logger.log(`[MCP Server] HTTPS server listening on ${this.getServerUrl()}`);
				resolve();
			});

			this.secureServer!.on("error", (error) => {
				logger.logError("[MCP Server] HTTPS server error:", error);
				// Attempt to close the server before rejecting
				const server = this.secureServer;
				this.secureServer = null;
				if (server) {
					try {
						server.close(() => {
							logger.log("[MCP Server] Closed failed secure server");
						});
					} catch (closeError) {
						logger.logError("[MCP Server] Error closing failed secure server:", closeError);
					}
				}
				reject(error);
			});
		});
	}

	private async startInsecureServer(): Promise<void> {
		this.insecureServer = http.createServer(this.app);

		await new Promise<void>((resolve, reject) => {
			const port = this.getPort();
			this.insecureServer!.listen(port, this.settings.server.host || DEFAULT_BINDING_HOST, () => {
				logger.log(`[MCP Server] HTTP server listening on ${this.getServerUrl()}`);
				resolve();
			});
			// this.insecureServer!.on("")

			this.insecureServer!.on("error", (error) => {
				logger.logError("[MCP Server] HTTP server error:", error);
				// Attempt to close the server before rejecting
				const server = this.insecureServer;
				this.insecureServer = null;
				if (server) {
					try {
						server.close(() => {
							logger.log("[MCP Server] Closed failed insecure server");
						});
					} catch (closeError) {
						logger.logError("[MCP Server] Error closing failed insecure server:", closeError);
					}
				}
				reject(error);
			});

			// TODO: add a middleware that watches request and response and tracks the jsonrpc method and parameters in the tokentracker?
		});
	}

	private async ensureCertificate(): Promise<void> {
		if (!this.settings.server.httpsEnabled) {
			return;
		}

		if (this.settings.server.crypto) {
			return;
		}

		logger.log("[MCP Server] Generating self-signed certificate");
		this.settings.server.crypto = this.generateCertificate();
	}

	public generateCertificate(): CryptoSettings {
		const expiry = new Date();
		const today = new Date();
		expiry.setDate(today.getDate() + 365);

		const keypair = pki.rsa.generateKeyPair(2048);
		const attrs = [
			{
				name: "commonName",
				value: CERT_NAME,
			},
			{
				name: "organizationName",
				value: "Obsidian MCP Plugin",
			},
			{
				name: "organizationalUnitName",
				value: "Self-Signed Certificate",
			},
		];
		const certificate = pki.createCertificate();
		certificate.setIssuer(attrs);
		certificate.setSubject(attrs);

		const subjectAltNames: Array<{ type: number; ip?: string; value?: string }> = [
			{
				type: 7, // IP
				ip: DEFAULT_BINDING_HOST,
			},
			{
				type: 2, // DNS
				value: "localhost",
			},
		];

		if (
			this.settings.server.host &&
			this.settings.server.host !== "0.0.0.0" &&
			this.settings.server.host !== DEFAULT_BINDING_HOST
		) {
			subjectAltNames.push({
				type: 7, // IP
				ip: this.settings.server.host,
			});
		}

		if (this.settings.server.subjectAltNames) {
			for (const name of this.settings.server.subjectAltNames.split("\n")) {
				const trimmedName = name.trim();
				if (trimmedName) {
					subjectAltNames.push({
						type: 2,
						value: trimmedName,
					});
				}
			}
		}

		certificate.setExtensions([
			{
				name: "basicConstraints",
				cA: true,
				critical: true,
			},
			{
				name: "keyUsage",
				keyCertSign: true,
				digitalSignature: true,
				nonRepudiation: true,
				keyEncipherment: false,
				dataEncipherment: false,
				critical: true,
			},
			{
				name: "extKeyUsage",
				serverAuth: true,
				clientAuth: true,
				codeSigning: true,
				emailProtection: true,
				timeStamping: true,
			},
			{
				name: "nsCertType",
				client: true,
				server: true,
				email: true,
				objsign: true,
				sslCA: true,
				emailCA: true,
				objCA: true,
			},
			{
				name: "subjectAltName",
				altNames: subjectAltNames,
			},
		]);

		certificate.serialNumber = "1";
		certificate.publicKey = keypair.publicKey;
		certificate.validity.notAfter = expiry;
		certificate.validity.notBefore = today;
		certificate.sign(keypair.privateKey, forge.md.sha256.create());

		return {
			cert: pki.certificateToPem(certificate),
			privateKey: pki.privateKeyToPem(keypair.privateKey),
			publicKey: pki.publicKeyToPem(keypair.publicKey),
		};
	}

	public getCertificateInfo(): {
		notBefore: Date;
		notAfter: Date;
		daysRemaining: number;
	} | null {
		if (!this.settings.server.crypto) {
			return null;
		}

		try {
			const cert = pki.certificateFromPem(this.settings.server.crypto.cert);
			const now = new Date();
			const notAfter = cert.validity.notAfter;
			const daysRemaining = Math.floor(
				(notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
			);

			return {
				notBefore: cert.validity.notBefore,
				notAfter: cert.validity.notAfter,
				daysRemaining,
			};
		} catch (error) {
			logger.logError("[MCP Server] Error parsing certificate:", error);
			return null;
		}
	}

	public async serveCertificateTemporarily(cert: string): Promise<number> {
		return new Promise((resolve, reject) => {
			// Find an available port
			const tempServer = express();
			tempServer.disable("x-powered-by");

			// Serve the certificate
			tempServer.get("/certificate.pem", (_req, res) => {
				res.setHeader("Content-Type", "application/x-pem-file");
				res.setHeader("Content-Disposition", "attachment; filename=obsidian-mcp-plugin.pem");
				res.send(cert);
			});

			// Start server on random available port
			const server = tempServer.listen(0, "127.0.0.1", () => {
				const address = server.address();
				if (!address || typeof address === "string") {
					reject(new Error("Failed to get server address"));
					return;
				}

				const port = address.port;
				logger.log(`[MCP Server] Serving certificate temporarily on port ${port}`);

				// Stop server after 30 seconds
				setTimeout(() => {
					server.close(() => {
						logger.log(`[MCP Server] Temporary certificate server closed`);
					});
				}, 30000);

				resolve(port);
			});

			server.on("error", (error) => {
				logger.logError("[MCP Server] Error starting temporary certificate server:", error);
				reject(error);
			});
		});
	}
}
