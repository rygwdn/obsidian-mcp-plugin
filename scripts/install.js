/* eslint-disable no-undef */
import * as fs from "fs";
import * as path from "path";

const PLUGIN_NAME = "obsidian-mcp-plugin";
const FILES_TO_COPY = ["main.js", "manifest.json", "styles.css"];

function installPlugin(vaultPath) {
	const pluginsDir = path.join(vaultPath, ".obsidian", "plugins");
	const pluginDir = path.join(pluginsDir, PLUGIN_NAME);

	if (!fs.existsSync(pluginsDir)) {
		console.log(`Creating plugins directory at: ${pluginsDir}`);
		fs.mkdirSync(pluginsDir, { recursive: true });
	}

	if (!fs.existsSync(pluginDir)) {
		console.log(`Creating plugin directory: ${pluginDir}`);
		fs.mkdirSync(pluginDir);
	}

	console.log("Copying plugin files...");
	FILES_TO_COPY.forEach((file) => {
		const src = path.resolve(file);
		const dest = path.join(pluginDir, file);
		if (fs.existsSync(dest)) {
			console.log(`Removing existing plugin file: ${file}`);
			fs.rmSync(dest, { recursive: true, force: true });
		}
		fs.copyFileSync(src, dest);
		console.log(`Copied ${file} to ${dest}`);
	});
	fs.writeFileSync(path.join(pluginDir, ".hotreload"), "");

	console.log("Plugin installed successfully!");
	console.log("Please restart Obsidian and enable the plugin in Settings > Community plugins.");
}

function main() {
	const vaultPath = process.argv[2];

	if (!vaultPath) {
		console.error("Error: Vault path is required");
		console.log("Usage: npm run install-plugin -- /path/to/vault");
		process.exit(1);
	}

	if (!fs.existsSync(vaultPath)) {
		console.error(`Vault path does not exist: ${vaultPath}`);
		process.exit(1);
	}

	installPlugin(vaultPath);
}

main();
