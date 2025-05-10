import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

const PLUGIN_NAME = 'obsidian-mcp-plugin';
const FILES_TO_COPY = ['main.js', 'manifest.json', 'styles.css'];

function installPlugin(vaultPath, mode) {
  if (!vaultPath) {
    console.error('Error: Vault path is required');
    console.log('Usage: npm run install:copy -- /path/to/vault');
    console.log('   or: npm run install:link -- /path/to/vault');
    process.exit(1);
  }

  const pluginsDir = path.join(vaultPath, '.obsidian', 'plugins');
  const pluginDir = path.join(pluginsDir, PLUGIN_NAME);
  
  // Create the plugins directory if it doesn't exist
  if (!fs.existsSync(pluginsDir)) {
    console.log(`Creating plugins directory at: ${pluginsDir}`);
    fs.mkdirSync(pluginsDir, { recursive: true });
  }

  // Remove existing plugin directory if it exists
  if (fs.existsSync(pluginDir)) {
    console.log(`Removing existing plugin directory: ${pluginDir}`);
    fs.rmSync(pluginDir, { recursive: true, force: true });
  }

  if (mode === 'copy') {
    // Create the plugin directory
    fs.mkdirSync(pluginDir);

    // Copy the files
    console.log('Copying plugin files...');
    FILES_TO_COPY.forEach(file => {
      const src = path.resolve(file);
      const dest = path.join(pluginDir, file);
      fs.copyFileSync(src, dest);
      console.log(`Copied ${file} to ${dest}`);
    });
  } else if (mode === 'link') {
    // Create a symbolic link to the entire directory
    const currentDir = process.cwd();
    console.log(`Creating symbolic link from ${currentDir} to ${pluginDir}`);
    fs.symlinkSync(currentDir, pluginDir, 'dir');
    console.log(`Linked directory to ${pluginDir}`);
  } else {
    console.error('Invalid mode. Use "copy" or "link".');
    process.exit(1);
  }

  console.log(`\nPlugin ${mode === 'copy' ? 'installed' : 'linked'} successfully!`);
  console.log('Please restart Obsidian and enable the plugin in Settings > Community plugins.');
}

// Main execution
function main() {
  const mode = process.argv[2];
  if (mode !== 'copy' && mode !== 'link') {
    console.error('Please specify mode: "copy" or "link"');
    process.exit(1);
  }
  
  // Get vault path from command line arguments (after the -- separator)
  const vaultPath = process.argv[3];
  
  if (!vaultPath) {
    console.error('Error: Vault path is required');
    console.log('Usage: npm run install:copy -- /path/to/vault');
    console.log('   or: npm run install:link -- /path/to/vault');
    process.exit(1);
  }

  if (!fs.existsSync(vaultPath)) {
    console.error(`Vault path does not exist: ${vaultPath}`);
    process.exit(1);
  }

  installPlugin(vaultPath, mode);
}

main();