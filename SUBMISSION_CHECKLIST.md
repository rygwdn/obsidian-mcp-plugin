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

- [x] Update manifest.json with proper semantic version
- [x] Update versions.json file with compatibility information
- [X] Release process for Obsidian submission:
  - [X] Create a GitHub release with tag matching EXACTLY the version in manifest.json (e.g., "0.2.0")
  - [X] Verify that the GitHub Actions workflow uploads these files as binary attachments:
    - [X] main.js
    - [X] manifest.json
    - [X] styles.css (if used by the plugin)
  - [X] Ensure the draft release is published after review

## Technical Requirements

- [x] Use `this.app` instead of global `app` or `window.app`
- [x] Avoid using `innerHTML`, `outerHTML`, and `insertAdjacentHTML`
- [x] Prefer Vault API over Adapter API for file operations
- [ ] Implement Vault Editor API for content modification
- [x] Avoid hardcoded styling (use CSS classes and variables)
- [x] Add a settings toggle for logging verbosity - current implementation is too verbose by default
- [x] Minimize console logging - move most logging behind the verbosity setting

## MCP-Specific Requirements

Due to the nature of this plugin, special attention must be given to:

- [x] Clearly document dependency on Local REST API plugin (already noted prominently in README)
- [ ] Add a dedicated security section to README that covers:
  - [ ] Network security implications of exposing vault content via API
  - [ ] Authentication mechanisms and how to secure the connection
  - [ ] Recommended practices for safeguarding sensitive information
  - [ ] Risks of enabling content modification for external tools
- [ ] Explicitly document the permissions model in settings:
  - [ ] Explain what each permission allows access to
  - [ ] Add warning notes about content modification capabilities
  - [ ] Provide guidance on selecting appropriate permissions
- [ ] Add a data privacy statement to explain:
  - [ ] What data leaves the vault
  - [ ] How data is transmitted
  - [ ] Whether any data is stored externally

## UI/UX Guidelines

- [x] Use sentence case for UI elements (correctly implemented)
- [x] Avoid using "settings" in settings headings (only one "Basic Settings" heading should be renamed)
- [x] Use appropriate heading elements (using createEl("h1"/"h2") in a clean way)
- [ ] Fix hardcoded styles in connection_ui.ts (lines 121-122) to use CSS classes
- [ ] Add warning labels for all permissions that allow content modification
- [ ] Use standard Obsidian styling for collapsible sections

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
