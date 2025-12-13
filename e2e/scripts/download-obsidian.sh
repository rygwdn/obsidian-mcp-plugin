#!/bin/bash
# Downloads and extracts Obsidian AppImage for e2e testing
# This is the heavy/slow part that can be cached in Docker layers

set -euo pipefail

E2E_DIR="${E2E_DIR:-/app/e2e}"
OBSIDIAN_VERSION="${OBSIDIAN_VERSION:-1.10.6}"
OBSIDIAN_APPIMAGE="$E2E_DIR/.obsidian-appimage/Obsidian-${OBSIDIAN_VERSION}.AppImage"
APPIMAGE_EXTRACT="$E2E_DIR/.obsidian-appimage/squashfs-root"
UNPACKED_PATH="$E2E_DIR/.obsidian-unpacked"

# Download Obsidian AppImage
if [[ ! -f "$OBSIDIAN_APPIMAGE" ]]; then
    echo "Downloading Obsidian ${OBSIDIAN_VERSION}..."
    mkdir -p "$(dirname "$OBSIDIAN_APPIMAGE")"
    curl -L -o "$OBSIDIAN_APPIMAGE" \
        "https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/Obsidian-${OBSIDIAN_VERSION}.AppImage"
    chmod +x "$OBSIDIAN_APPIMAGE"
fi

# Extract the AppImage
if [[ ! -d "$APPIMAGE_EXTRACT" ]]; then
    echo "Extracting AppImage..."
    cd "$(dirname "$OBSIDIAN_APPIMAGE")"

    # Try native extraction first, fall back to unsquashfs for QEMU emulation
    if "$OBSIDIAN_APPIMAGE" --appimage-extract > /dev/null 2>&1; then
        echo "AppImage extracted successfully"
    else
        echo "Using unsquashfs fallback (QEMU emulation detected)..."
        OFFSET=$(python3 -c "
import sys
with open(sys.argv[1], 'rb') as f:
    data = f.read()
    idx = data.find(b'hsqs', 100000)
    print(idx) if idx != -1 else sys.exit(1)
" "$OBSIDIAN_APPIMAGE")

        echo "Found squashfs at offset $OFFSET"
        dd if="$OBSIDIAN_APPIMAGE" of=squashfs.img bs=1 skip="$OFFSET" 2>/dev/null
        unsquashfs -d squashfs-root squashfs.img
        rm squashfs.img
    fi
fi

# Extract app.asar (doesn't depend on project code)
RESOURCES_PATH="$APPIMAGE_EXTRACT/resources"
if [[ ! -d "$UNPACKED_PATH" ]]; then
    echo "Extracting app.asar..."
    npx --yes @electron/asar extract "$RESOURCES_PATH/app.asar" "$UNPACKED_PATH"
    cp "$RESOURCES_PATH/obsidian.asar" "$UNPACKED_PATH/obsidian.asar"
fi

echo "Obsidian ready at: $UNPACKED_PATH"
