# Obsidian MCP Plugin

Integrates the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) with Obsidian,
enabling AI assistants to interact with your vault via the
[Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api). This plugin
uses standardized tools and resources for seamless AI collaboration.

> [!IMPORTANT]
> The [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin is
> **required** for this plugin to function. Please ensure it is installed and enabled in your
> Obsidian vault.

## Key Features and Benefits

This plugin offers a native and streamlined Model Context Protocol (MCP) experience directly within
Obsidian, eliminating the need for external servers or applications.

- **Native Obsidian Integration**: Operates as a standard Obsidian plugin for a seamless user
  experience.
- **Flexible Connectivity**: Supports both SSE and Streamable HTTP transports for versatile
  communication.
- **User-Friendly Configuration**: Manage all settings through the standard Obsidian interface.
- **Comprehensive Toolset**:
  - Complete MCP server functionality via the Obsidian Local REST API.
  - Tools for file management (read, list, metadata), vault search, and querying.
  - Resource-based access to vault files and daily notes.
  - Built-in prompt management system.
- **Plugin Integrations**:
  - **Dataview**: Execute Dataview queries (requires Dataview plugin).
  - **Daily Notes**: Interact with daily notes (requires Daily Notes or Periodic Notes plugin).
  - **QuickAdd**: Trigger QuickAdd actions and list choices (requires QuickAdd plugin).

## Installation

This plugin is not yet in the Obsidian Community Plugins directory. Install it via BRAT (Beta
Reviewers Auto-update Tester):

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Obsidian Community Plugins.
2. In BRAT settings, add beta plugin: `rygwdn/obsidian-mcp-plugin`.
3. Enable the plugin in Obsidian settings.
4. Your Obsidian vault will now provide an MCP endpoint at something like
    `https://127.0.0.1:27123/mcp`. The specific endpoint and example configurations are viewable in
    the plugin settings.

## Available Functionality

This plugin offers a range of functionalities that can be enabled or disabled through the settings:

- **File Access**: Allows AI assistants to read files, list directories, and retrieve file metadata
  within your vault. This is fundamental for many interactions that require understanding the
  content and structure of your notes. *Security impact: Exposes vault content to connected systems.*

- **Content Modification**: Grants AI assistants the ability to modify file content. This includes
  actions like appending text to existing notes, replacing sections of text, or creating new content
  based on instructions. *Security impact: HIGH - enables direct changes to your vault content.*

- **Vault Search**: Enables AI assistants to perform text-based searches across all files in your
  vault. This is useful for finding specific information or patterns within your notes.
  *Security impact: Makes all content discoverable through search queries.*

- **Dataview Integration**: If you have the Dataview plugin installed and enabled, this feature
  allows AI assistants to execute Dataview queries. This can be powerful for querying and
  summarizing structured data within your notes (requires
  [Dataview plugin](https://github.com/blacksmithgu/obsidian-dataview)).
  *Security impact: Can expose aggregated data from your entire vault.*

- **Daily Notes Integration**: Provides specialized tools for interacting with daily notes. This
  requires either the core Daily Notes plugin or the
  [Periodic Notes plugin](https://github.com/liamcain/obsidian-periodic-notes) (configured for daily
  notes) to be active. It simplifies tasks like creating, retrieving, or updating daily entries.

- **QuickAdd Integration**: If you use the QuickAdd plugin, this feature allows AI assistants to
  trigger QuickAdd actions and list available choices. This can automate workflows and content
  creation processes defined in QuickAdd (requires
  [QuickAdd plugin](https://github.com/chhoumann/quickadd)).
  *Security impact: HIGH - QuickAdd actions can modify vault content, run scripts, or interact with external services, depending on how they are configured.*

- **Logging Verbosity**: Controls console logging detail level. By default, logging is minimal, but you
  can enable "Verbose Logging" in Advanced settings for debugging.

Each of these features can be toggled in the plugin's settings, allowing you to customize the level
of access and capability granted to connected AI assistants.

> [!CAUTION]
> Content modification permissions allow AI assistants to make direct changes to your vault files.
> Enable this permission only when needed and review any changes carefully.

For comprehensive information on security, permissions, and privacy considerations, please review the
[SECURITY.md](SECURITY.md) document.

## Using Prompts

The plugin features a simple prompt management system:

1. Create a Markdown file in your prompts folder (default: `prompts/`).
2. **Define Metadata (Optional)**: Add YAML frontmatter to the top of the file. The following
    fields are supported:
    - `name`: (string) A human-readable name for the prompt.
    - `description`: (string) A brief description of what the prompt does.
    - `args`: (array of strings) A list of variable names that your prompt will use.
3. Write your prompt in the file body, using `{{variable1}}` for placeholders.

Prompts are automatically registered and updated with the MCP server. AI assistants can access them.

**Example Prompt (`prompts/analyze_topic.md`):**

```markdown
---
name: "Topic Analysis"
description: "Create an analysis of a topic"
args:
  - "topic"
  - "perspective"
---

Please provide a thorough analysis of {{topic}} from a {{perspective}} perspective. Include
historical context, current relevance, and future implications.
```

## Development

Key commands:

- `npm run dev`: Development with hot reload.
- `npm run build`: Build for production.
- `npm run check`: Type check, lint, and test.
- `npm run install:link -- /path/to/your/vault`: Install to vault for testing (symlinks).

## Release Process

1. Update `CHANGELOG.md` (e.g., `## [x.y.z] - YYYY-MM-DD`).
2. Bump version: `npm run version`.
3. Tag and push: `git tag x.y.z && git push origin x.y.z`.

*GitHub Actions will draft a release from the changelog.*

## Related Projects

- [mcp-obsidian](https://github.com/MarkusPfundstein/mcp-obsidian): External MCP server for
  Obsidian.
- [obsidian-mcp](https://github.com/StevenStavrakis/obsidian-mcp): Filesystem-based MCP server.
- [Model Context Protocol](https://modelcontextprotocol.io/): Official MCP documentation.

## License

[MIT](LICENSE)
