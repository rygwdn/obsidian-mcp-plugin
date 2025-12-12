#!/bin/bash
# Builds the plugin and installs it in the test vault
# Run this after download-obsidian.sh and after code changes

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
E2E_DIR="$ROOT_DIR/e2e"
TEST_VAULT="$E2E_DIR/test-vault"
PLUGIN_PATH="$TEST_VAULT/.obsidian/plugins/obsidian-mcp-plugin"

# Build the plugin
echo "Building plugin..."
cd "$ROOT_DIR"
npm run build --silent

# Install plugin in test vault
echo "Installing plugin in test vault..."
mkdir -p "$PLUGIN_PATH"
cp "$ROOT_DIR/main.js" "$PLUGIN_PATH/main.js"
cp "$ROOT_DIR/manifest.json" "$PLUGIN_PATH/manifest.json"
cp "$ROOT_DIR/styles.css" "$PLUGIN_PATH/styles.css" 2>/dev/null || true

echo "Plugin installed at: $PLUGIN_PATH"
