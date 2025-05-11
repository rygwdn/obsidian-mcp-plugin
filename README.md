# Obsidian MCP Plugin

Integrates the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) with Obsidian, allowing AI assistants to interact with your vault through the [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) using standardized tools and resources.

## Why This Plugin?

This plugin offers several unique advantages:

- **Direct Integration** - Works natively within Obsidian as a plugin
- **Streamlined Architecture** - No external server or application required
- **Flexible Connectivity** - Supports both SSE and Streamable HTTP transports
- **Native Experience** - Configurable through the standard Obsidian settings UI
- **Comprehensive Implementation** - Includes tools, resources, and prompt management in one solution

## Features

- Provides a complete MCP implementation via the Obsidian Local REST API
- Tools for file manipulation, searching, and querying
- Resource-based access to vault files and daily notes
- Integration with Dataview, Daily Notes, and QuickAdd plugins
- Built-in prompt management system

## Prerequisites

- [Obsidian](https://obsidian.md/)
- [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin
- Optional Dependencies:
  - [Dataview](https://github.com/blacksmithgu/obsidian-dataview) plugin (for dataview_query)
  - Daily Notes (core plugin) or [Periodic Notes](https://github.com/liamcain/obsidian-periodic-notes) (for daily note tools)
  - [QuickAdd](https://github.com/chhoumann/quickadd) (for quickadd tools)

## Installation

The plugin is not yet available in the Obsidian Community Plugins directory. You can install it using:

### BRAT (Beta Reviewers Auto-update Tester)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Obsidian Community Plugins
2. In BRAT settings, add the beta plugin: `rygwdn/obsidian-mcp-plugin`
3. Enable the plugin in Obsidian settings

### Manual Installation

1. Clone the repository or download the latest release
2. Build the project:
   ```bash
   npm install
   npm run build
   ```
3. Install to your vault:
   ```bash
   # Copy required files to your vault
   npm run install:copy -- /path/to/your/vault

   # Or for development, create symbolic links:
   npm run install:link -- /path/to/your/vault
   ```
4. Enable the plugin in Obsidian settings

## Configuration

The plugin settings can be found in Obsidian's settings under "MCP Plugin":

- **Enable Resources**: Allows accessing vault files as MCP resources
- **Enable Prompts**: Loads prompts from the configured prompts folder
- **Prompts Location**: Path where prompt files are stored (default: `prompts`)
- **Tool-specific settings**: Enable/disable individual tools

## MCP Endpoint

Once configured, your Obsidian vault provides an MCP endpoint at:
```
http://127.0.0.1:27123/mcp
```

(Port may vary based on your Local REST API configuration)

## Available Tools

### File Management
- `list_files`: Lists files and folders in a specified directory.
- `get_file_contents`: Retrieves the content of any file in the vault.
- `get_file_metadata`: Retrieves metadata for a specified file including frontmatter, tags, and headings.
- `update_content`: Updates file content through append or targeted replacement operations.

### Search and Query
- `search`: Searches across vault files with exact or fuzzy matching.
- `dataview_query`: Executes a Dataview query and returns formatted results.

### Daily Notes
- `get_daily_note`: Retrieves or creates daily notes for specified dates.

### QuickAdd
- `quickadd_list`: Lists all available QuickAdd choices.
- `quickadd_execute`: Executes a QuickAdd choice or formats a template.


## Resources

- `vault-file`: Provides direct access to any file in the vault.
- `vault-metadata`: Offers structured metadata for vault files.
- `vault-daily-note`: Provides access to daily notes by date.

## Using Prompts

The plugin includes a simple yet powerful prompt management system:

1. Create a markdown file in your configured prompts folder (default: `prompts/`)
2. Add optional frontmatter with:
   ```yaml
   ---
   description: "Brief description of what this prompt does"
   args:
     - "variable1"
     - "variable2"
   ---
   ```
3. Write your prompt in the body of the file, using `{{variable1}}` and `{{variable2}}` as placeholders

Prompts are automatically registered with the MCP server and can be accessed by AI assistants. When a prompt is modified in Obsidian, it's automatically updated in the MCP server without requiring a restart.

Example prompt file:
```markdown
---
description: "Create an analysis of a topic"
args:
  - "topic"
  - "perspective"
---
Please provide a thorough analysis of {{topic}} from a {{perspective}} perspective.
Include historical context, current relevance, and future implications.
```

## Development

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Check code (types, lint, tests)
npm run check

# Install to vault for testing (symlinks entire directory)
npm run install:link -- /path/to/your/vault
```

## Release Process

```bash
# 1. Update CHANGELOG.md with format: ## [x.y.z] - YYYY-MM-DD
# 2. Bump version
npm run version

# 3. Tag and push
git tag x.y.z
git push origin x.y.z
```

GitHub Actions will create a draft release with notes from the changelog.

## Related Projects

Here are some other projects in the MCP ecosystem:

- [mcp-obsidian](https://github.com/MarkusPfundstein/mcp-obsidian): External MCP server that communicates with Obsidian's Local REST API
- [obsidian-mcp](https://github.com/StevenStavrakis/obsidian-mcp): Filesystem-based MCP server for Obsidian
- [Model Context Protocol](https://modelcontextprotocol.io/): Official MCP protocol documentation

## License

[MIT](LICENSE)