# Changelog

## [Unreleased]

- feat: Add separate SSE endpoints (/sse and /messages) for backward compatibility
- feat: Configure /mcp endpoint to use HTTP streaming exclusively
- feat: Update connection UI to clearly differentiate between streaming HTTP and SSE options

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
