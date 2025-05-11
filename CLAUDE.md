# Claude Coding Assistant Preferences

This document contains preferences and commands for Claude to use when working with this codebase.

## Commands to Run

After making changes, Claude should run the following commands to validate the changes:

```bash
# Full check including linting, formatting, typechecking and tests
npm run check
```

## Code Style Preferences

- **Logging Format**: Use the centralized logging utilities in `tools/logging.ts`
- **Testing Style**: Use inline snapshots for complex output validation
- **Error Handling**: Always use proper error handling with informative messages
- **Type Safety**: Avoid using `any` type when possible

## MCP Protocol Requirements

- Always log tool calls and resource usage with performance metrics

## Commit Preferences

- Follow conventional commit format (feat:, fix:, docs:, etc.)
- Include a concise summary of the changes
- Do not mention Claude in commit messages

## Documentation

- Update CHANGELOG.md when adding new features or fixing issues
- Place new changes under the [Unreleased] section
- Document user-facing features in README.md

## Plugin Architecture

- **MCP Server**: Central server implementation in `mcp_server.ts`
- **Tools**: Functionality implementations in `tools/*.ts`
- **Resources**: Data access abstractions in various resource files

## Testing

- Always run tests after making changes
- Update tests when modifying functionality
- For output formatting changes, use inline snapshots
