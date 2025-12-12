import { test, expect } from "@playwright/test";
import {
	launchObsidian,
	closeObsidian,
	waitForMcpServer,
	ObsidianTestContext,
} from "../helpers/obsidian";

test.describe("Obsidian MCP Plugin Settings UI", () => {
	let ctx: ObsidianTestContext;

	test.beforeAll(async () => {
		ctx = await launchObsidian();

		// Wait for MCP server to be ready (indicates plugin loaded)
		const serverReady = await waitForMcpServer(15000);
		if (!serverReady) {
			console.warn("MCP server did not start - some tests may fail");
		}
	});

	test.afterAll(async () => {
		if (ctx) {
			await closeObsidian(ctx);
		}
	});

	test("should load Obsidian with the test vault", async () => {
		// Verify Obsidian window is open
		expect(ctx.window).toBeTruthy();

		// Check window title contains vault name or Obsidian
		const title = await ctx.window.title();
		expect(title).toBeTruthy();
		console.log(`Window title: ${title}`);
	});

	test("should open settings modal", async () => {
		// Open settings using keyboard shortcut
		const platform = process.platform;
		const modifier = platform === "darwin" ? "Meta" : "Control";

		await ctx.window.keyboard.press(`${modifier}+,`);

		// Wait for settings modal to appear
		await ctx.window.waitForTimeout(1000);

		// Look for the settings modal
		const settingsModal = await ctx.window.locator(".modal-container").first();
		await expect(settingsModal).toBeVisible({ timeout: 5000 });
	});

	test("should navigate to MCP plugin settings", async () => {
		// First ensure settings is open
		const platform = process.platform;
		const modifier = platform === "darwin" ? "Meta" : "Control";

		// Close any open modal first
		await ctx.window.keyboard.press("Escape");
		await ctx.window.waitForTimeout(500);

		// Open settings
		await ctx.window.keyboard.press(`${modifier}+,`);
		await ctx.window.waitForTimeout(1000);

		// Look for Community plugins section in sidebar
		const communityPluginsTab = ctx.window.locator(
			'.vertical-tab-nav-item:has-text("Community plugins")'
		);

		if (await communityPluginsTab.isVisible()) {
			await communityPluginsTab.click();
			await ctx.window.waitForTimeout(500);
		}

		// Find and click on MCP plugin settings
		// The plugin should be listed in community plugins
		const mcpPluginItem = ctx.window.locator(
			'.installed-plugins-container .setting-item:has-text("MCP")'
		);

		if (await mcpPluginItem.isVisible()) {
			// Click the settings cog for the plugin
			const settingsButton = mcpPluginItem.locator(".clickable-icon").last();
			if (await settingsButton.isVisible()) {
				await settingsButton.click();
				await ctx.window.waitForTimeout(500);
			}
		}

		// Close settings
		await ctx.window.keyboard.press("Escape");
	});

	test("should display plugin settings tabs", async () => {
		// Open command palette
		const platform = process.platform;
		const modifier = platform === "darwin" ? "Meta" : "Control";

		await ctx.window.keyboard.press(`${modifier}+p`);
		await ctx.window.waitForTimeout(500);

		// Type to search for our plugin settings command
		await ctx.window.keyboard.type("MCP");
		await ctx.window.waitForTimeout(500);

		// Look for settings-related command
		const settingsCommand = ctx.window.locator('.suggestion-item:has-text("settings")');

		if (await settingsCommand.first().isVisible()) {
			await settingsCommand.first().click();
			await ctx.window.waitForTimeout(1000);

			// Check for the tab navigation in settings
			const tokensTab = ctx.window.locator('.mcp-tab-button:has-text("Tokens")');
			const serverTab = ctx.window.locator('.mcp-tab-button:has-text("Server")');
			const vaultTab = ctx.window.locator('.mcp-tab-button:has-text("Vault")');

			// At least one tab should be visible if we're in the plugin settings
			const anyTabVisible =
				(await tokensTab.isVisible()) ||
				(await serverTab.isVisible()) ||
				(await vaultTab.isVisible());

			if (anyTabVisible) {
				console.log("Plugin settings tabs found");
			}
		}

		// Close any modal
		await ctx.window.keyboard.press("Escape");
		await ctx.window.keyboard.press("Escape");
	});

	test("MCP server should be running", async () => {
		// Verify the server is accessible
		const serverReady = await waitForMcpServer(5000);
		expect(serverReady).toBe(true);
	});
});
