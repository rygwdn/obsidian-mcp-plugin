import { defineConfig } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// E2E test port - different from default to avoid conflicts
export const E2E_MCP_PORT = 27199;
export const E2E_TEST_TOKEN = "e2e-test-token-value-for-automated-testing";
export const E2E_FULL_ACCESS_TOKEN = "e2e-full-access-token";
export const E2E_READ_ONLY_TOKEN = "e2e-read-only-token";
export const E2E_NO_INTEGRATIONS_TOKEN = "e2e-no-integrations-token";

export default defineConfig({
	testDir: "./tests",
	outputDir: "./test-results",
	timeout: 60000,
	retries: 0,
	workers: 1, // Obsidian can only run one instance at a time
	reporter: [["list"], ["html", { outputFolder: "./playwright-report", open: "never" }]],
	use: {
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	projects: [
		{
			name: "setup",
			testMatch: "setup.test.ts",
		},
		{
			name: "e2e",
			testMatch: [
				"ui-settings.test.ts",
				"mcp-api.test.ts",
				"dataview.test.ts",
				"quickadd.test.ts",
				"tasknotes.test.ts",
				"integration-toggles.test.ts",
			],
			dependencies: ["setup"],
		},
	],
	// Global setup to prepare the test vault
	globalSetup: path.join(__dirname, "setup/global-setup.ts"),
	globalTeardown: path.join(__dirname, "setup/global-teardown.ts"),
});
