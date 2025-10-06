import * as https from "https";
import * as http from "http";
import express, { Express } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import forge, { pki } from "node-forge";
import { MCPPluginSettings, CryptoSettings } from "../settings/types";
import { logger } from "../tools/logging";
import { AuthManager } from "./auth";

const DEFAULT_BINDING_HOST = "127.0.0.1";
const CERT_NAME = "Obsidian MCP Plugin";

export class ServerManager {
	private secureServer: https.Server | null = null;
	private insecureServer: http.Server | null = null;
	private app: Express;
	private settings: MCPPluginSettings;
	private authManager: AuthManager;

	constructor(settings: MCPPluginSettings) {
		this.settings = settings;
		this.authManager = new AuthManager(settings);
		this.app = express();
		this.setupExpressMiddleware();
	}

	private setupExpressMiddleware(): void {
		this.app.use(cors());
		this.app.use(bodyParser.json({ limit: "50mb" }));
		this.app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));
		this.app.use(this.authManager.middleware());
	}

	public addRoute(path: string): express.IRoute {
		return this.app.route(path);
	}

	public async start(): Promise<void> {
		if (!this.settings.server.enabled) {
			logger.log("[MCP Server] Server disabled in settings");
			return;
		}

		await this.ensureCertificate();

		if (this.settings.server.httpsEnabled) {
			await this.startSecureServer();
		} else {
			await this.startInsecureServer();
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

	public async restart(): Promise<void> {
		logger.log("[MCP Server] Restarting server");
		await this.stop();
		await this.start();
	}

	public isRunning(): boolean {
		return this.secureServer !== null || this.insecureServer !== null;
	}

	public getServerUrl(): string {
		const protocol = this.settings.server.httpsEnabled ? "https" : "http";
		const host = this.settings.server.host || DEFAULT_BINDING_HOST;
		const port = this.settings.server.port;
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
			this.secureServer!.listen(
				this.settings.server.port,
				this.settings.server.host || DEFAULT_BINDING_HOST,
				() => {
					logger.log(`[MCP Server] HTTPS server listening on ${this.getServerUrl()}`);
					resolve();
				}
			);

			this.secureServer!.on("error", (error) => {
				logger.logError("[MCP Server] HTTPS server error:", error);
				reject(error);
			});
		});
	}

	private async startInsecureServer(): Promise<void> {
		this.insecureServer = http.createServer(this.app);

		await new Promise<void>((resolve, reject) => {
			this.insecureServer!.listen(
				this.settings.server.port,
				this.settings.server.host || DEFAULT_BINDING_HOST,
				() => {
					logger.log(`[MCP Server] HTTP server listening on ${this.getServerUrl()}`);
					resolve();
				}
			);

			this.insecureServer!.on("error", (error) => {
				logger.logError("[MCP Server] HTTP server error:", error);
				reject(error);
			});
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
}
