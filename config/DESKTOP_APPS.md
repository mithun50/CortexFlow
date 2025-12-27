# Desktop AI Configuration Guide

CortexFlow supports all major desktop AI applications via MCP (stdio) or HTTP API.

## MCP-Compatible Desktop Apps

### Claude Desktop
**Platform**: macOS, Windows, Linux

Config location:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/claude-desktop/config.json`

```json
{
  "mcpServers": {
    "cortexflow": {
      "command": "node",
      "args": ["/path/to/cortexflow/dist/index.js"]
    }
  }
}
```

### Cursor
**Platform**: macOS, Windows, Linux

1. Open Cursor Settings
2. Navigate to MCP Servers
3. Add:
   - Name: `cortexflow`
   - Command: `node /path/to/cortexflow/dist/index.js`

### VS Code + Continue
**Platform**: macOS, Windows, Linux

Add to `.continue/config.json`:
```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "node",
          "args": ["/path/to/cortexflow/dist/index.js"]
        }
      }
    ]
  }
}
```

### Zed
**Platform**: macOS, Linux

Add to Zed settings:
```json
{
  "assistant": {
    "version": "2",
    "context_servers": {
      "cortexflow": {
        "command": {
          "path": "node",
          "args": ["/path/to/cortexflow/dist/index.js"]
        }
      }
    }
  }
}
```

### Jan
**Platform**: macOS, Windows, Linux

Add to Jan's MCP configuration:
```json
{
  "mcpServers": {
    "cortexflow": {
      "command": "node",
      "args": ["/path/to/cortexflow/dist/index.js"]
    }
  }
}
```

### LM Studio
**Platform**: macOS, Windows, Linux

If MCP is supported, add to settings:
```json
{
  "mcpServers": {
    "cortexflow": {
      "command": "node",
      "args": ["/path/to/cortexflow/dist/index.js"]
    }
  }
}
```

### Msty
**Platform**: macOS, Windows, Linux

Add MCP server in Msty settings with:
- Command: `node`
- Args: `/path/to/cortexflow/dist/index.js`

### Typing Mind
**Platform**: Web, Desktop (Electron)

Use HTTP API:
1. Start: `cortexflow --http`
2. Configure plugin to call `http://localhost:3210/api/*`

## HTTP API Desktop Apps

For desktop apps without MCP support, use the HTTP API:

```bash
# Start HTTP server
cortexflow --http
```

### ChatGPT Desktop
**Platform**: macOS, Windows

Use with Custom GPT Actions pointing to `http://localhost:3210`

### Gemini Desktop
**Platform**: macOS, Windows

Configure function calling to hit HTTP endpoints.

### GitHub Copilot (Desktop/VS Code)
**Platform**: macOS, Windows, Linux

Use Continue extension with MCP, or HTTP API integration.

### Ollama + Open WebUI
**Platform**: macOS, Windows, Linux

1. Start CortexFlow HTTP: `cortexflow --http`
2. Configure Open WebUI to use HTTP endpoints as tools

### LibreChat
**Platform**: Self-hosted

Configure as external tool using HTTP API.

## Both Transports

Run both MCP and HTTP simultaneously:

```bash
cortexflow --both
```

This allows:
- Claude Desktop → MCP (stdio)
- ChatGPT Desktop → HTTP API
- Same shared context for all!

## Connection Test

### MCP Test
Your desktop app should be able to call `read_context` and see:
```
No project found. Create one with write_context...
```

### HTTP Test
```bash
curl http://localhost:3210/health
# {"status":"ok","service":"cortexflow","version":"1.0.0"}
```

## Troubleshooting

### "Command not found"
Use absolute path to node and cortexflow:
```json
{
  "command": "/usr/local/bin/node",
  "args": ["/Users/you/cortexflow/dist/index.js"]
}
```

### Permission denied
```bash
chmod +x /path/to/cortexflow/dist/index.js
```

### Port already in use
```bash
CORTEXFLOW_PORT=3211 cortexflow --http
```
