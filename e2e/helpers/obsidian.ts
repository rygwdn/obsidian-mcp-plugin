import { _electron as electron, ElectronApplication, Page } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { E2E_MCP_PORT } from "../playwright.config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const E2E_DIR = path.join(__dirname, "..");
const TEST_VAULT_PATH = path.join(E2E_DIR, "test-vault");
const UNPACKED_PATH = path.join(E2E_DIR, ".obsidian-unpacked");
const UNPACKED_MAIN = path.join(UNPACKED_PATH, "main.js");
const ELECTRON_PATH = "/app/node_modules/electron/dist/electron";

export interface ObsidianTestContext {
	app: ElectronApplication;
	window: Page;
}

/**
 * Launch Obsidian with the test vault in Docker container
 * Requires running setup-obsidian.sh first (done during Docker build)
 */
export async function launchObsidian(): Promise<ObsidianTestContext> {
	if (!fs.existsSync(UNPACKED_MAIN)) {
		throw new Error(`Unpacked Obsidian not found at ${UNPACKED_PATH}. Run: npm run e2e:setup`);
	}

	const absoluteVaultPath = path.resolve(TEST_VAULT_PATH);
	const workspaceFile = path.join(absoluteVaultPath, ".obsidian/workspace.json");

	// Remove workspace file to start fresh
	if (fs.existsSync(workspaceFile)) {
		fs.unlinkSync(workspaceFile);
	}

	console.log(`Launching unpacked Obsidian from: ${UNPACKED_MAIN}`);
	console.log(`Opening vault: ${absoluteVaultPath}`);

	// Launch Electron with GPU disabled for container/emulation compatibility
	const app = await electron.launch({
		executablePath: ELECTRON_PATH,
		args: [
			UNPACKED_MAIN,
			absoluteVaultPath,
			"--disable-gpu",
			"--disable-gpu-compositing",
			"--disable-gpu-sandbox",
			"--disable-software-rasterizer",
			"--in-process-gpu",
			"--no-sandbox",
		],
		timeout: 60000,
	});

	console.log("Waiting for window...");
	const window = await app.firstWindow();
	console.log("Got window");

	// Capture MCP-related and error console logs
	window.on("console", (msg) => {
		const type = msg.type();
		const text = msg.text();
		if (text.includes("[MCP]") || type === "error") {
			console.log(`[Obsidian ${type}] ${text}`);
		}
	});

	window.on("pageerror", (error) => {
		console.log(`[Obsidian PageError] ${error.message}`);
	});

	await window.waitForLoadState("domcontentloaded");
	console.log("DOM loaded");

	// Handle trust dialog and wait for plugins to load
	await handleTrustDialog(window);
	await handleModals(window);
	await waitForPluginLoaded(window);

	console.log("Obsidian ready");
	return { app, window };
}

/**
 * Handle the trust author dialog that appears when opening a new vault
 */
async function handleTrustDialog(window: Page): Promise<void> {
	const trustSelectors = [
		'button:has-text("Trust author and enable plugins")',
		'button:has-text("Trust author")',
		'button:has-text("Enable plugins")',
		'button:has-text("Turn on")',
		'button:has-text("Enable community plugins")',
		'button:has-text("Turn on community plugins")',
	];

	// Wait for any trust button to appear, with timeout
	const trustButtonLocator = window.locator(trustSelectors.join(", ")).first();

	try {
		await trustButtonLocator.waitFor({ state: "visible", timeout: 10000 });
		console.log("Clicking trust button...");
		await trustButtonLocator.click();
	} catch {
		console.log("No trust dialog found - vault may already be trusted");
	}
}

/**
 * Handle any modals that appear during startup
 */
async function handleModals(window: Page): Promise<void> {
	const enablePluginsBtn = window.locator('button:has-text("Turn on community plugins")');

	try {
		await enablePluginsBtn.waitFor({ state: "visible", timeout: 2000 });
		console.log("Clicking 'Turn on community plugins' button...");
		await enablePluginsBtn.click();
	} catch {
		// No modal found - dismiss any other modals
		const modal = window.locator(".modal-container");
		if (await modal.isVisible()) {
			await window.keyboard.press("Escape");
		}
	}
}

/**
 * Wait for the MCP plugin to be loaded
 */
async function waitForPluginLoaded(window: Page, timeoutMs: number = 30000): Promise<void> {
	const startTime = Date.now();

	while (Date.now() - startTime < timeoutMs) {
		const state = await window.evaluate(() => {
			// @ts-expect-error - Obsidian global
			const obsApp = window.app;
			if (!obsApp?.plugins?.plugins) return null;
			return {
				enabled: obsApp.plugins.enabledPlugins ? Array.from(obsApp.plugins.enabledPlugins) : [],
				loaded: Object.keys(obsApp.plugins.plugins),
			};
		});

		if (state?.loaded.includes("obsidian-mcp-plugin")) {
			console.log(`Plugin state: enabled=${state.enabled.length}, loaded=${state.loaded.length}`);
			return;
		}

		await window.waitForTimeout(500);
	}

	// Log final state even if plugin didn't load
	const finalState = await window.evaluate(() => {
		// @ts-expect-error - Obsidian global
		const obsApp = window.app;
		if (!obsApp?.plugins) return { error: "plugins not found" };
		return {
			enabled: obsApp.plugins.enabledPlugins ? Array.from(obsApp.plugins.enabledPlugins) : [],
			loaded: obsApp.plugins.plugins ? Object.keys(obsApp.plugins.plugins) : [],
		};
	});
	console.log(
		`Plugin state: enabled=${finalState.enabled?.length ?? 0}, loaded=${finalState.loaded?.length ?? 0}`
	);
}

/**
 * Close Obsidian gracefully
 */
export async function closeObsidian(ctx: ObsidianTestContext): Promise<void> {
	try {
		await ctx.app.close();
	} catch (error) {
		console.warn("Error closing Obsidian:", error);
	}
}

/**
 * Wait for the MCP server to be ready by polling the endpoint
 */
export async function waitForMcpServer(timeoutMs: number = 10000): Promise<boolean> {
	const startTime = Date.now();
	const url = `http://127.0.0.1:${E2E_MCP_PORT}/mcp`;

	while (Date.now() - startTime < timeoutMs) {
		try {
			const response = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					jsonrpc: "2.0",
					method: "initialize",
					params: {
						protocolVersion: "2024-11-05",
						capabilities: {},
						clientInfo: { name: "e2e-test", version: "1.0.0" },
					},
					id: 1,
				}),
			});

			// 401 or 200 means server is running
			if (response.status === 401 || response.status === 200) {
				console.log(`MCP server is ready on port ${E2E_MCP_PORT}`);
				return true;
			}
		} catch {
			// Server not ready yet
		}

		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	console.log("MCP server did not start - some tests may fail");
	return false;
}
