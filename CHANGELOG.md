# Changelog

## [Unreleased]

## [0.9.0] - 2025-12-12

### Added

- **TaskNotes Integration**: Query and manage tasks from the TaskNotes plugin with filtering by
  status, priority, and context. Includes `tasknotes_query` tool, `tasknotes_get_task` tool, and
  `tasknotes:///stats` resource for task statistics.
- **E2E Testing**: Added Playwright end-to-end tests running against real Obsidian in Docker,
  covering core tools, Dataview, QuickAdd, and TaskNotes integrations.

### Changed

- Updated e2e test environment to Obsidian 1.10.6
- Modernized TypeScript imports with vite-tsconfig-paths

### Fixed

- Handle empty object returns from TaskNotes API for non-task files
- Correct async handling for TaskNotes plugin methods

## [0.8.0] - 2025-01-27

### Changed

- Server now defaults to HTTP and requires tokens to start
- Enhanced server and logging functionality with improved error handling
- More graceful server start failure handling
- Updated default ports and HTTPS handling

### Refactored

- Implemented token-scoped permission checks for improved security
- Refactored security and submission documentation for clarity

## [0.7.0] - 2025-11-04

### Added

- feat: add Cursor install button to token configuration for one-click setup

### Changed

- chore: rename plugin from "MCP API for Obsidian" to "MCP Server"

## [0.6.1] - 2025-11-04

### Fixed

- fix: properly decode URL-encoded file paths with spaces and special characters in resources
- fix: handle GET requests to /mcp endpoint for better client compatibility

## [0.6.0] - 2025-10-07

### BREAKING CHANGES

- **Self-Contained Server**: Removed dependency on Obsidian Local REST API plugin. The MCP plugin
  now runs its own HTTP/HTTPS server. This greatly simplifies setup and reduces external
  dependencies.
- **Authentication Required**: All API requests now require Bearer token authentication. Create at
  least one token in settings to enable access.
- **HTTP Transport**: Changed MCP transport type from `streamableHttp` to standard `http`. Update
  your MCP client configuration accordingly.
- **SSE Removed**: Server-Sent Events support has been removed in favor of standard HTTP-only
  transport.

### Added

- **Built-in HTTP/HTTPS server with Express**
  - Self-contained server with configurable host and port
  - HTTP mode (default) for simple local setup
  - HTTPS mode (experimental) with self-signed certificates
  - Real-time server status display in settings
  - Deferred startup to minimize Obsidian load time

- **Token-based authentication with granular permissions**
  - Multiple token support with individual configurations
  - Per-token tool enablement (file access, search, content modification, dataview, quickadd)
  - Per-token directory permissions with allow/deny rules
  - Read and Write permission levels
  - Token usage tracking (last used timestamp)
  - Simplified token UI with compact rows and feature icons

- **Certificate management for HTTPS**
  - Automatic self-signed certificate generation
  - Certificate download via temporary HTTP server (30-second window)
  - OS-specific installation instructions (macOS, Windows, Linux)
  - Certificate trust status detection
  - Certificate expiry monitoring
  - Subject Alternative Names support for custom hostnames/IPs

- **Tabbed settings UI**
  - Organized into Tokens, Server, Vault, and Advanced tabs
  - Inline token configuration (no modal required)
  - Copyable token values with one-click copy button
  - Feature icons matching configuration section order
  - Example MCP configurations for each token

### Changed

- HTTPS disabled by default in favor of HTTP for easier setup
- HTTPS marked as experimental with warning indicator
- Settings UI refreshes automatically when toggling HTTPS
- Directory permissions UI no longer jumps when modified
- Token configuration now shown inline instead of modal
- Certificate filename changed to `obsidian-mcp-plugin.pem`
- macOS certificate instructions emphasize System keychain requirement

### Removed

- Dependency on `obsidian-local-rest-api` package (now optional for certificate import only)
- Server-Sent Events (SSE) support
- Connection info section from server tab

## [0.5.2] - 2025-05-19

- refactor: improve MCP server architecture and connection logging

## [0.5.1] - 2025-05-19

- refactor: standardize URI handling and improve error messages

## [0.5.0] - 2025-05-19

- feat: enhance file event handling and prompt synchronization
- feat: add security warnings and refactor settings UI
- fix: address markdown linting issues and improve fix script

## [0.4.0] - 2025-05-17

- feat: Make tool name prefix customizable with visual preview in settings
- fix: Improve URI handling and path resolution across plugin
- refactor: Remove unused vault structure code
- docs: Update submission checklist progress

## [0.3.0] - 2025-05-16

- feat: Enhance directory permissions system with reorderable rules list
- feat: Implement first-match-wins order for directory access rules
- refactor: Abstract Obsidian API behind interface layer
- style: Update CSS to use Obsidian CSS variables for better theme compatibility

## [0.2.0] - 2025-05-12

- feat: Add separate SSE endpoints (/sse and /messages) for backward compatibility
- feat: Configure /mcp endpoint to use HTTP streaming exclusively
- feat: Update connection UI to clearly differentiate between streaming HTTP and SSE options
- refactor: Separate daily notes and file resources into distinct classes
- fix: Patch MCP server to handle older SSE clients

## [0.1.5] - 2025-05-12

- feat: Add supergateway connection option and refactor UI code
- chore: Publish package to npm to reserve the name
- chore: Update package.json with repository information and keywords

## [0.1.4] - 2025-05-11

- refactor: Implement class-based Logger for centralized and consistent logging
- refactor: Convert daily note utils from namespace to module exports for better code organization
- refactor: Split settings into multiple specialized files with clear responsibilities
- refactor: Implement global console mocking in tests for cleaner test output
- feat: Enhance QuickAdd list tool to extract and display template variables
- fix: Update default binding host from "localhost" to "127.0.0.1" for improved compatibility
- feat: Require secure server (HTTPS) for MCP connection
- feat: Add comprehensive logging for tool and resource usage with performance tracking
- feat: Integrate daily notes functionality into file management tools via daily:// URI scheme
- docs: Improve code style guidelines with clearer commenting instructions
- refactor: Reorganize settings UI with more descriptive feature names
- refactor: Consolidate file access settings and remove redundant options

## [0.1.3] - 2025-05-10

- feat: Add release process documentation to README
- feat: Improve release workflow with automatic changelog extraction
- fix: Format JSON files consistently

## [0.1.2] - 2025-05-10

- feat: Add MCP connection information display with copy buttons
- feat: Support schema-less tools in MCP server
- feat: Add custom prompt naming via frontmatter
- feat: Improve Quick Add integration to use settings directly
- fix: Automatically build before install scripts
- fix: Add error logging for tool execution failures
