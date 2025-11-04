# Obsidian MCP Plugin Submission Checklist

This document outlines all required steps to submit the MCP API Plugin to the official Obsidian
community plugin directory.

Review:

- [Plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines) ([raw](https://raw.githubusercontent.com/obsidianmd/obsidian-developer-docs/a2bac2adce51d9aa056dbe8eac161bdb5a29cefb/en/Plugins/Releasing/Plugin%20guidelines.md))
- [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin) ([raw](https://raw.githubusercontent.com/obsidianmd/obsidian-developer-docs/a2bac2adce51d9aa056dbe8eac161bdb5a29cefb/en/Plugins/Releasing/Submit%20your%20plugin.md))
- [PR Template](https://github.com/obsidianmd/obsidian-releases/blob/master/.github/PULL_REQUEST_TEMPLATE/plugin.md)

## Pull Request Submission Process

Once all requirements are met:

1. Fork the [obsidian-releases repository](https://github.com/obsidianmd/obsidian-releases)
2. Add the plugin to community-plugins.json:

   ```json
   {
     "id": "obsidian-mcp-plugin",
     "name": "MCP Server",
     "author": "Ryan Wooden",
     "description": "Provides a Model Context Protocol (MCP) endpoint via Obsidian Local REST API",
     "repo": "rygwdn/obsidian-mcp-plugin",
     "branch": "main"
   }
   ```

3. Create a pull request with title: "Add plugin: MCP Server"
4. Complete all items in the PR template checklist:
   - [ ] The GitHub repository name matches the plugin ID
   - [ ] The plugin meets all Obsidian developer policies
   - [ ] The PR only changes the community-plugins.json file
   - [ ] The plugin ID is unique and not in use
   - [ ] The plugin name, author, and description match the manifest
   - [ ] The README.md contains appropriate installation and usage instructions
   - [ ] Specify mobile support (likely No, as it's marked desktopOnly)
   - [ ] List required plugins (Obsidian Local REST API)
   - [ ] Disclose if it connects to external services (Yes - via Local REST API)
   - [ ] Disclose requested permissions (Yes - network access)

## Special Considerations

Since this plugin:

1. Depends on another plugin (Obsidian Local REST API)
2. Creates a server endpoint
3. Allows external access to vault contents
4. Uses network connectivity

These aspects must be clearly documented in:

- [x] README.md
- [x] Settings panel explanations
- [ ] Pull request submission

## Final Review Before Submission

- [x] Run all checks (`npm run check`)
- [x] Test with latest Obsidian version
- [ ] Test on multiple platforms
- [x] Test with different themes
- [x] Take screenshots for documentation if needed
- [x] Verify all functionality works as expected

## After Submission

- [ ] Be prepared to address reviewer feedback
- [ ] Once approved, announce in the forums under Share & Showcase
- [ ] With developer role, announce in Discord #updates channel
