/**
 * Setup test - runs once before other tests to configure the vault
 * This handles the "Trust author" dialog and enables community plugins
 */
import { test, expect, ElectronApplication, _electron as electron, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const E2E_DIR = path.join(__dirname, "..");
const TEST_VAULT_PATH = path.join(E2E_DIR, "test-vault");
const UNPACKED_PATH = path.join(E2E_DIR, ".obsidian-unpacked");
const UNPACKED_MAIN = path.join(UNPACKED_PATH, "main.js");
const ELECTRON_PATH = "/app/node_modules/electron/dist/electron";

let app: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
	// Remove workspace file to start fresh
	const workspaceFile = path.join(TEST_VAULT_PATH, ".obsidian/workspace.json");
	if (fs.existsSync(workspaceFile)) {
		fs.unlinkSync(workspaceFile);
	}

	// Launch Electron with GPU disabled for container compatibility
	app = await electron.launch({
		executablePath: ELECTRON_PATH,
		args: [
			UNPACKED_MAIN,
			"open",
			"--disable-gpu",
			"--disable-gpu-compositing",
			"--disable-gpu-sandbox",
			"--disable-software-rasterizer",
			"--in-process-gpu",
			"--no-sandbox",
		],
		timeout: 60000,
	});

	window = await app.firstWindow();
	await window.waitForLoadState("domcontentloaded");
});

test.afterAll(async () => {
	if (app) {
		await app.close();
	}
});

test("Setup: Configure test vault and trust author", async () => {
	// Stub the file picker to return our test vault path
	await app.evaluate(async ({ dialog }, fakePath) => {
		dialog.showOpenDialogSync = () => {
			return [fakePath];
		};
	}, path.resolve(TEST_VAULT_PATH));

	// Click "Open" button to open a vault
	const openButton = window.getByRole("button", { name: "Open" });
	await openButton.waitFor({ state: "visible", timeout: 10000 });
	await openButton.click();

	// Wait for new window with the vault
	window = await app.waitForEvent("window", { timeout: 30000 });
	await window.waitForLoadState("domcontentloaded");

	// Handle "Trust author" dialog if it appears
	const trustButton = window.getByRole("button", { name: "Trust author and enable plugins" });
	try {
		await trustButton.waitFor({ state: "visible", timeout: 10000 });
		console.log("Clicking 'Trust author and enable plugins'...");
		await trustButton.click();
	} catch {
		console.log("No trust dialog found");
	}

	// Dismiss any modals
	const modal = window.locator(".modal-container");
	if (await modal.isVisible()) {
		await window.keyboard.press("Escape");
	}

	// Wait for vault to load and verify
	await expect(window).toHaveTitle(/Obsidian/, { timeout: 10000 });
	const title = await window.title();
	console.log(`Vault loaded with title: ${title}`);
});
