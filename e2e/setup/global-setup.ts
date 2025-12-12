import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { E2E_MCP_PORT, E2E_TEST_TOKEN } from "../playwright.config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_VAULT_PATH = path.join(__dirname, "../test-vault");
const PLUGIN_PATH = path.join(TEST_VAULT_PATH, ".obsidian/plugins/obsidian-mcp-plugin");
const UNPACKED_PATH = path.join(__dirname, "../.obsidian-unpacked");

/**
 * Global setup for Playwright e2e tests
 * - Verifies unpacked Obsidian exists
 * - Updates plugin config with test-specific settings
 */
export default async function globalSetup() {
	console.log("Running global setup for e2e tests...");

	// Check if unpacked Obsidian exists
	if (!fs.existsSync(path.join(UNPACKED_PATH, "main.js"))) {
		throw new Error(
			`Unpacked Obsidian not found. Run: npm run e2e:setup\n` +
				`Expected path: ${UNPACKED_PATH}/main.js`
		);
	}

	// Verify plugin files exist
	if (!fs.existsSync(path.join(PLUGIN_PATH, "main.js"))) {
		throw new Error(
			`Plugin not found in test vault. Run: npm run e2e:setup\n` +
				`Expected path: ${PLUGIN_PATH}/main.js`
		);
	}

	// Update plugin data.json with test-specific port and token
	console.log(`Configuring plugin with port ${E2E_MCP_PORT}...`);
	const dataPath = path.join(PLUGIN_PATH, "data.json");

	if (!fs.existsSync(dataPath)) {
		throw new Error(`Plugin data.json not found at ${dataPath}`);
	}

	const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

	data.server.port = E2E_MCP_PORT;
	data.server.enabled = true;
	data.server.tokens[0].token = E2E_TEST_TOKEN;

	fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

	console.log("Global setup complete.");
}
