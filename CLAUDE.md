# Claude Coding Assistant Preferences

This document contains preferences and commands for Claude to use when working with this codebase.

## Commands to Run

After making changes, Claude should run the following commands to validate the changes:

```bash
# Full check including linting, formatting, typechecking and unit tests
npm run check

# E2E tests (requires Docker/Podman, run outside sandbox)
podman build -t obsidian-mcp-e2e -f e2e/Dockerfile .
podman run --rm --ipc=host -v $(pwd)/e2e/test-results:/app/e2e/test-results obsidian-mcp-e2e
```

## References to Project Guidelines

Claude should follow these guidelines when working with the codebase:

- **Code Style**: @.cursor/rules/code-style-guidelines.mdc
- **Commit Messages**: @.cursor/rules/commit-message-format.mdc
- **Plugin Architecture**: @.cursor/rules/mcp-plugin-architecture.mdc
- **Release Process**: @.cursor/rules/release-process.mdc
- **Testing Best Practices**: @.cursor/rules/testing-best-practices.mdc

## MCP Protocol Requirements

- Always log tool calls and resource usage with performance metrics

## Documentation

- Update CHANGELOG.md when adding new features or fixing issues
- Place new changes under the [Unreleased] section
- Document user-facing features in README.md
