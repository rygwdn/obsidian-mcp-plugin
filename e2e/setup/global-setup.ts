import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { E2E_MCP_PORT, E2E_TEST_TOKEN } from "../playwright.config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_VAULT_PATH = path.join(__dirname, "../test-vault");
const OBSIDIAN_PATH = path.join(TEST_VAULT_PATH, ".obsidian");
const PLUGINS_PATH = path.join(OBSIDIAN_PATH, "plugins");
const MCP_PLUGIN_PATH = path.join(PLUGINS_PATH, "obsidian-mcp-plugin");
const UNPACKED_PATH = path.join(__dirname, "../.obsidian-unpacked");

// Community plugins required for e2e tests
const REQUIRED_PLUGINS = ["dataview", "quickadd", "tasknotes"];

/**
 * Global setup for Playwright e2e tests
 * - Verifies unpacked Obsidian exists
 * - Verifies community plugins are installed
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

	// Verify MCP plugin files exist
	if (!fs.existsSync(path.join(MCP_PLUGIN_PATH, "main.js"))) {
		throw new Error(
			`MCP plugin not found in test vault. Run: npm run e2e:setup\n` +
				`Expected path: ${MCP_PLUGIN_PATH}/main.js`
		);
	}

	// Verify community plugins are installed
	for (const pluginId of REQUIRED_PLUGINS) {
		const pluginPath = path.join(PLUGINS_PATH, pluginId, "main.js");
		if (!fs.existsSync(pluginPath)) {
			throw new Error(
				`Required plugin '${pluginId}' not found.\n` +
					`Run: bash e2e/scripts/download-plugins.sh\n` +
					`Expected path: ${pluginPath}`
			);
		}
	}
	console.log(`Verified ${REQUIRED_PLUGINS.length} community plugins installed`);

	// Update MCP plugin data.json with test-specific port and token
	console.log(`Configuring MCP plugin with port ${E2E_MCP_PORT}...`);
	const dataPath = path.join(MCP_PLUGIN_PATH, "data.json");

	// Create default data.json if it doesn't exist (fresh build won't have one)
	let data;
	if (!fs.existsSync(dataPath)) {
		console.log("Creating default data.json for MCP plugin...");
		data = {
			promptsFolder: "prompts",
			vaultDescription: "Test vault for e2e tests",
			verboseLogging: true,
			server: {
				enabled: false,
				port: E2E_MCP_PORT,
				host: "127.0.0.1",
				httpsEnabled: false,
				crypto: null,
				subjectAltNames: "",
				tokens: [
					{
						id: "e2e-test-token",
						name: "E2E Test Token",
						token: E2E_TEST_TOKEN,
						createdAt: Date.now(),
						enabledTools: {
							file_access: true,
							search: true,
							update_content: true,
							dataview_query: true,
							quickadd: true,
							tasknotes: true,
						},
						directoryPermissions: {
							rules: [],
							rootPermission: true,
						},
					},
				],
			},
		};
	} else {
		data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
	}

	data.server.port = E2E_MCP_PORT;
	data.server.enabled = true;
	data.server.tokens[0].token = E2E_TEST_TOKEN;

	// Ensure all plugin integrations are enabled
	data.server.tokens[0].enabledTools = {
		file_access: true,
		search: true,
		update_content: true,
		dataview_query: true,
		quickadd: true,
		tasknotes: true,
	};

	fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

	console.log("Global setup complete.");
}
