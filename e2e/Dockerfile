# Dockerfile for running Obsidian e2e tests headlessly
#
# Usage:
#   Build:  docker build -t obsidian-mcp-e2e -f e2e/Dockerfile .
#   Run all tests:  docker run --rm --ipc=host -v $(pwd)/e2e/test-results:/app/e2e/test-results obsidian-mcp-e2e
#   Run specific test:  docker run --rm --ipc=host obsidian-mcp-e2e npm run test:e2e -- --grep "should list"
#   Interactive shell:  docker run --rm -it --ipc=host obsidian-mcp-e2e bash
#
# Plugin version modes:
#   Build with pinned versions (default):
#     docker build -t obsidian-mcp-e2e -f e2e/Dockerfile .
#   Build with latest plugin versions:
#     docker build --build-arg PLUGIN_VERSION_MODE=latest -t obsidian-mcp-e2e-latest -f e2e/Dockerfile .

FROM mcr.microsoft.com/playwright:v1.57.0-noble

# Plugin version mode: "pinned" (default) or "latest"
ARG PLUGIN_VERSION_MODE=pinned

# Install dependencies for Electron and AppImage extraction
RUN apt-get update && apt-get install -y \
    xvfb \
    libgbm1 \
    libasound2t64 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    squashfs-tools \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies (cached layer)
COPY package*.json ./
RUN npm ci \
    && rm -rf node_modules/electron \
    && npm install electron

# Copy and run Obsidian download script (cached layer - doesn't depend on code)
COPY e2e/scripts/download-obsidian.sh /tmp/
RUN E2E_DIR=/app/e2e bash /tmp/download-obsidian.sh

# Now copy the rest of the project (invalidates cache on code changes)
COPY . .

# Download community plugins for testing (Dataview, QuickAdd, TaskNotes)
RUN E2E_DIR=/app/e2e bash e2e/scripts/download-plugins.sh ${PLUGIN_VERSION_MODE}

# Build plugin and install in test vault (fast - just needs npm run build)
RUN bash e2e/scripts/setup-plugin.sh

# Environment for headless operation
ENV DISPLAY=:99
ENV E2E_HEADLESS=1

# Entrypoint starts Xvfb and passes through commands
RUN printf '#!/bin/bash\nXvfb :99 -screen 0 1920x1080x24 &\nsleep 1\nexec "$@"\n' > /entrypoint.sh \
    && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "test:e2e"]
