#!/bin/bash
# Download community plugins for e2e testing
#
# Usage:
#   ./download-plugins.sh [pinned|latest]
#
# Modes:
#   pinned - Download specific known-good versions (default)
#   latest - Download latest releases from GitHub

set -e

E2E_DIR="${E2E_DIR:-$(dirname "$(dirname "$(realpath "$0")")")}"
PLUGINS_DIR="${E2E_DIR}/test-vault/.obsidian/plugins"
MODE="${1:-pinned}"

# Pinned versions (known good)
DATAVIEW_PINNED="0.5.70"
QUICKADD_PINNED="2.9.0"
TASKNOTES_PINNED="4.1.3"

# Plugin repositories
DATAVIEW_REPO="blacksmithgu/obsidian-dataview"
QUICKADD_REPO="chhoumann/quickadd"
TASKNOTES_REPO="callumalpass/tasknotes"

download_plugin() {
    local repo="$1"
    local plugin_id="$2"
    local version="$3"
    local plugin_dir="${PLUGINS_DIR}/${plugin_id}"

    echo "Downloading ${plugin_id} ${version}..."
    mkdir -p "$plugin_dir"

    local base_url="https://github.com/${repo}/releases/download/${version}"

    # Download required files
    curl -fsSL "${base_url}/main.js" -o "${plugin_dir}/main.js"
    curl -fsSL "${base_url}/manifest.json" -o "${plugin_dir}/manifest.json"

    # styles.css is optional
    if curl -fsSL "${base_url}/styles.css" -o "${plugin_dir}/styles.css" 2>/dev/null; then
        echo "  Downloaded styles.css"
    else
        rm -f "${plugin_dir}/styles.css"
    fi

    echo "  Installed to ${plugin_dir}"
}

get_latest_version() {
    local repo="$1"
    gh release view --repo "$repo" --json tagName -q '.tagName' 2>/dev/null || echo ""
}

echo "Plugin download mode: ${MODE}"
echo "Plugins directory: ${PLUGINS_DIR}"
echo ""

if [ "$MODE" = "latest" ]; then
    echo "Fetching latest versions from GitHub..."
    DATAVIEW_VERSION=$(get_latest_version "$DATAVIEW_REPO")
    QUICKADD_VERSION=$(get_latest_version "$QUICKADD_REPO")
    TASKNOTES_VERSION=$(get_latest_version "$TASKNOTES_REPO")

    if [ -z "$DATAVIEW_VERSION" ] || [ -z "$QUICKADD_VERSION" ] || [ -z "$TASKNOTES_VERSION" ]; then
        echo "Error: Failed to fetch latest versions. Ensure 'gh' CLI is authenticated."
        exit 1
    fi
else
    DATAVIEW_VERSION="$DATAVIEW_PINNED"
    QUICKADD_VERSION="$QUICKADD_PINNED"
    TASKNOTES_VERSION="$TASKNOTES_PINNED"
fi

echo "Versions to install:"
echo "  Dataview: ${DATAVIEW_VERSION}"
echo "  QuickAdd: ${QUICKADD_VERSION}"
echo "  TaskNotes: ${TASKNOTES_VERSION}"
echo ""

# Download each plugin
download_plugin "$DATAVIEW_REPO" "dataview" "$DATAVIEW_VERSION"
download_plugin "$QUICKADD_REPO" "quickadd" "$QUICKADD_VERSION"
download_plugin "$TASKNOTES_REPO" "obsidian-task-notes" "$TASKNOTES_VERSION"

echo ""
echo "All plugins downloaded successfully!"

# Save versions for reference
cat > "${PLUGINS_DIR}/.plugin-versions.json" << EOF
{
  "mode": "${MODE}",
  "dataview": "${DATAVIEW_VERSION}",
  "quickadd": "${QUICKADD_VERSION}",
  "tasknotes": "${TASKNOTES_VERSION}",
  "downloaded_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "Version info saved to ${PLUGINS_DIR}/.plugin-versions.json"
