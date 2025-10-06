# Changelog

## [Unreleased]

### BREAKING CHANGES

- **Self-Contained Server**: Removed dependency on Obsidian Local REST API plugin. The MCP plugin
  now runs its own HTTP/HTTPS server. This greatly simplifies setup and reduces external
  dependencies.

### Added

- Built-in HTTP/HTTPS server with Express
- Automatic self-signed certificate generation for HTTPS connections
- Server configuration UI with real-time status display
- Certificate management (regenerate, view expiry, import from Local REST API)
- Support for Subject Alternative Names in certificates
- Option to run HTTP server (without TLS) for local testing
- Migration support: can import existing certificates from Local REST API plugin

### Changed

- Server settings now managed directly in plugin configuration
- Connection UI updated to show plugin's own server status instead of Local REST API
- Simplified architecture with direct control over server lifecycle
- Build configuration updated to use `platform: "node"` for proper Node.js module handling

### Removed

- Dependency on `obsidian-local-rest-api` package (now optional for certificate import only)

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
