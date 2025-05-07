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

## Development

### Testing

This project uses Vitest for testing. The tests mock the Obsidian API to ensure proper functionality without requiring an actual Obsidian instance.

```bash
# Run tests once
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Type Checking

The project uses TypeScript's strict type checking for the main code, with more flexible typing for test mocks:

```bash
# Check types in main code
npm run check-types

# Check types in test code (warnings allowed)
npm run check-test-types 

# Check all types
npm run typecheck
```

### Linting and Formatting

```bash
# Check for linting issues
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code using Prettier
npm run format

# Check if code is properly formatted
npm run format:check
```

### CI

Run all checks at once (lint, format, build, test):

```bash
npm run ci
```

## License

[MIT](LICENSE)
