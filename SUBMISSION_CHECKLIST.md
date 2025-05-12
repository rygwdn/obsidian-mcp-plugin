# Obsidian MCP Plugin Submission Checklist

This document outlines all required steps to submit the MCP API Plugin to the official Obsidian community plugin directory.

Review:
- https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines ([raw](https://raw.githubusercontent.com/obsidianmd/obsidian-developer-docs/a2bac2adce51d9aa056dbe8eac161bdb5a29cefb/en/Plugins/Releasing/Plugin%20guidelines.md))
- https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin ([raw](https://raw.githubusercontent.com/obsidianmd/obsidian-developer-docs/a2bac2adce51d9aa056dbe8eac161bdb5a29cefb/en/Plugins/Releasing/Submit%20your%20plugin.md))
- https://github.com/obsidianmd/obsidian-releases/blob/master/.github/PULL_REQUEST_TEMPLATE/plugin.md

## Repository Requirements

- [x] Verify `id` in manifest.json is unique (search community-plugins.json)
- [x] Consider adding `fundingUrl` to manifest.json (optional)

## Plugin Release Requirements

- [ ] Update manifest.json with proper semantic version
- [ ] Update versions.json file with compatibility information
- [ ] Create GitHub release with tag matching exact version number
- [ ] Update release documentation to follow release requirements - review the documents outlined above for details
- [ ] Upload required files as binary attachments to the release:
  - [ ] main.js
  - [ ] manifest.json
  - [ ] styles.css (if applicable)

## Technical Requirements

- [ ] Use `this.app` instead of global `app` or `window.app`
- [ ] Avoid using `innerHTML`, `outerHTML`, and `insertAdjacentHTML`
- [ ] Prefer Vault API over Adapter API for file operations
- [ ] Avoid hardcoded styling (use CSS classes and variables)
- [ ] Minimize console logging

## MCP-Specific Requirements

Due to the nature of this plugin, special attention must be given to:

- [ ] Clearly document dependency on Local REST API plugin
- [ ] Document network permissions and explain why they're needed
- [ ] Detail all vault access permissions and why they're needed
- [ ] Add security section to README to explain implications
- [ ] Document which file access patterns are used

## UI/UX Guidelines

- [ ] Use sentence case for UI elements
- [ ] Avoid using "settings" in settings headings
- [ ] Use `setHeading()` for setting headers in settings
- [ ] Follow Obsidian UI patterns for settings

## Pull Request Submission Process

Once all requirements are met:

1. Fork the [obsidian-releases repository](https://github.com/obsidianmd/obsidian-releases)
2. Add the plugin to community-plugins.json:
   ```json
   {
     "id": "obsidian-mcp-plugin",
     "name": "MCP API for Obsidian",
     "author": "Ryan Wooden",
     "description": "Provides a Model Context Protocol (MCP) endpoint via Obsidian Local REST API",
     "repo": "rygwdn/obsidian-mcp-plugin",
     "branch": "main"
   }
   ```
3. Create a pull request with title: "Add plugin: MCP API for Obsidian"
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
- [ ] README.md
- [ ] Pull request submission
- [ ] Settings panel explanations

## Final Review Before Submission

- [ ] Run all checks (`npm run check`)
- [ ] Test with latest Obsidian version
- [ ] Test on multiple platforms
- [ ] Test with different themes
- [ ] Take screenshots for documentation if needed
- [ ] Verify all functionality works as expected

## After Submission

- [ ] Be prepared to address reviewer feedback
- [ ] Once approved, announce in the forums under Share & Showcase
- [ ] With developer role, announce in Discord #updates channel
