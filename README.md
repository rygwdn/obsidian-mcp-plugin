# Obsidian MCP Plugin

This plugin provides a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) endpoint for Obsidian using the Obsidian Local REST API plugin.

## What is MCP?

Model Context Protocol (MCP) is a standardized way for AI assistants to interact with external tools and resources. This plugin implements the MCP Streamable HTTP transport specification without streaming (simple JSON-in, JSON-out) to allow AI assistants to interact with Obsidian.

## Prerequisites

- [Obsidian](https://obsidian.md/)
- [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin

## Installation

1. Build the project with `npm run build` (or `npm run dev` if you are iterating on some changes).
2. Link the plugin into your Obsidian vault's `.obsidian/plugins` directory. On linux or osx, you can run `ln -s /path/to/your/cloned/repository /path/to/your/vault/.obsidian/plugins/obsidian-mcp-plugin`.
3. Enable the plugin in Obsidian's Community Plugins settings page.

## Usage

Once the plugin is enabled, it registers a `/mcp` endpoint with the Obsidian Local REST API. This endpoint can be used by MCP clients to send requests to Obsidian.

### Endpoint

```
http://localhost:27123/mcp
```

(The port may vary depending on your Obsidian Local REST API configuration)

### Example Request

```
POST /mcp HTTP/1.1
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "ping",
  "id": "1"
}
```

### Example Response

```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "pong"
      }
    ]
  },
  "id": "1"
}
```

## Building

```
npm run build
```

## License

[MIT](LICENSE)
