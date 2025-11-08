# Security, Privacy and Permissions

This document provides detailed information about security implications, permissions, and data privacy
considerations when using the Obsidian MCP Plugin.

## Security Considerations

This plugin provides external systems with access to your Obsidian vault contents through its built-in
MCP server. Please review the security implications carefully before use.

### Network Security

- The MCP server runs directly within the Obsidian plugin on your local machine
- By default, the server only accepts connections from localhost (127.0.0.1)
- HTTPS is enabled by default with automatically generated self-signed certificates
- The server can optionally run in HTTP mode for local testing, but HTTPS is strongly recommended
- External connections require changing the host binding in settings, which you should only enable if
  you fully understand the security implications

### Certificate Management

- The plugin automatically generates self-signed certificates on first run when HTTPS is enabled
- Certificates are valid for 1 year and include Subject Alternative Names for localhost and 127.0.0.1
- You can regenerate certificates at any time from the plugin settings
- For migration from Local REST API plugin, existing certificates can be imported
- Self-signed certificates require clients to disable certificate validation (`NODE_TLS_REJECT_UNAUTHORIZED=0`)

### Authentication

- **All requests require Bearer token authentication**
- Tokens are cryptographically secure random strings (32 bytes, base64url encoded)
- Each token can have specific permissions (Read, Write)
- Multiple tokens supported for different clients/use cases
- Token usage is tracked with "last used" timestamps
- **Security best practices:**
  - Create separate tokens for each client application
  - Use Read-only tokens when write access is not needed
  - Regularly review and delete unused tokens
  - Store tokens securely (password manager, encrypted config files)
  - Never commit tokens to version control
  - Regenerate tokens if compromised
  - Monitor token usage through the plugin settings

### Network Security Considerations

- Default binding to localhost (127.0.0.1) provides strong isolation
- HTTPS encryption protects tokens in transit
- **IMPORTANT**: Do not expose the server to external networks without additional security measures
- For remote access, use secure tunneling:
  - VPN for secure network-level access
  - SSH tunneling with port forwarding
  - Avoid binding to 0.0.0.0 or public IPs unless you understand the risks

### Content Protection

**Best practices for safeguarding sensitive information:**

- Keep sensitive or private information in a separate vault without the MCP plugin enabled
- Use selective tool permissions to limit access to specific functionalities:
  - Enable only the specific tools required for your use case
  - Disable content modification capabilities when not actively using them
  - Consider using read-only access for most use cases
- Use directory permissions to restrict access to specific folders in your vault
- Regularly review the access logs by enabling verbose logging in plugin settings
- Implement additional layers of security:
  - Monitor server activity through the plugin's logging system
  - Consider network-level protections (like a firewall) if changing from localhost binding
  - Use VPN or SSH tunneling for secure remote access rather than directly exposing the server
- Disable the server entirely when not in use via the "Enable Server" toggle in settings

### Content Modification Risks

When enabling content modification tools:

- Changes to your vault can be made by connected AI systems with no user confirmation
- There is no built-in approval workflow for modifications - changes are immediate
- To mitigate risks:
  - Enable backups of your vault before allowing content modification
  - Consider using version control (like git) for important vaults
  - Regularly review changes made to your vault

## Permissions Model

The plugin provides granular control over what connected AI assistants can access and modify:

### File Access Permission

- **What it enables**: Reading file contents, listing directories, and retrieving metadata
- **Security impact**: Exposes all vault content to connected systems
- **Recommendation**: Safe for most use cases but be mindful of sensitive content

### Content Modification Permission

- **What it enables**: Creating, updating, and modifying files in your vault
- **Security impact**: HIGH - allows direct changes to your vault content
- **Recommendation**: Enable only when actively collaborating with an AI assistant

### Search Permission

- **What it enables**: Text-based search across all vault files
- **Security impact**: Makes all content discoverable, even if not directly navigated to
- **Recommendation**: Generally safe; disable if vault contains sensitive searchable terms

### Dataview Permission

- **What it enables**: Running Dataview queries across your vault
- **Security impact**: Can expose aggregated or filtered data from across your vault
- **Recommendation**: Safe for organized information retrieval

### QuickAdd Permission

- **What it enables**: Triggering workflows and actions defined in QuickAdd
- **Security impact**: HIGH - QuickAdd actions can modify vault content, run scripts, or interact
  with external services, depending on how they are configured.
- **Recommendation**: Review your QuickAdd macros and their potential impact carefully before
  enabling this permission. Only enable if you trust the source and understand the actions of your
  QuickAdd configurations.

## File Access Permissions

The MCP plugin provides access to vault files with granular permissions:

- By default, all files in your vault are accessible to MCP-enabled tools
- File access is determined by the tools that are enabled in the plugin settings
- Consider the following permission limitations for more security:

  - **File-based permissions**:
    - Individual files can be tagged with YAML frontmatter to control access
    - Add `mcp_access: false` to frontmatter to prevent a file from being accessed
    - Add `mcp_readonly: true` to allow reading but prevent modifications

  - **Directory-based permissions**:
    - Future versions will support restricting access by folder
    - Consider organizing sensitive content in separate folders that can be excluded

## Data Privacy

### Data Transmission

- When using this plugin, note content is transmitted between:
  - Your Obsidian vault
  - The local MCP server (this plugin)
  - Your AI assistant application (Claude, GPT, etc.)
- All data transmission is handled via HTTPS through the plugin's built-in server
- All communications stay on your local network by default (localhost binding)
- The plugin uses self-signed certificates by default which provides encryption but not
  server verification
- External access requires explicitly changing the host binding in settings

### External Services

- This plugin itself does not transmit vault data to any external services
- However, connected AI assistants may send vault content to their respective APIs for processing
- **IMPORTANT**: When using AI services like Claude or GPT:
  - Content provided to these services may be used for model training unless you've opted out
  - Your vault content becomes subject to the privacy policies of these third-party services
  - Consider reviewing the privacy policies of any AI services you connect to this plugin

### Data Storage

- No vault data is stored by this plugin outside your Obsidian vault
- The plugin does not maintain a cache of accessed files
- No usage analytics or telemetry is collected or transmitted

## Logging and Monitoring

The plugin includes a configurable logging system that can help you monitor and audit access:

- By default, logging is minimal to reduce console noise
- For security monitoring or debugging purposes, enable "Verbose Logging" in Advanced settings
- When verbose logging is enabled:
  - Detailed logs of all tool operations are recorded
  - Connection events with client details (IP, user agent) are logged
  - Performance metrics for all operations are tracked
  - Resource access patterns become visible

**Security monitoring with logs:**

- Enable verbose logging temporarily when:
  - Investigating suspicious activity
  - Auditing AI assistant interactions with sensitive content
  - Monitoring what content is being accessed
  - Troubleshooting authentication issues
- You can view logs in the Developer Console (Ctrl+Shift+I or Cmd+Option+I)
