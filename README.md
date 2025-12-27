# CortexFlow

[![CI](https://github.com/mithun50/CortexFlow/actions/workflows/ci.yml/badge.svg)](https://github.com/mithun50/CortexFlow/actions/workflows/ci.yml)
[![Release](https://github.com/mithun50/CortexFlow/actions/workflows/release.yml/badge.svg)](https://github.com/mithun50/CortexFlow/actions/workflows/release.yml)
[![Docs](https://github.com/mithun50/CortexFlow/actions/workflows/docs.yml/badge.svg)](https://github.com/mithun50/CortexFlow/actions/workflows/docs.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple)](https://modelcontextprotocol.io/)
[![npm](https://img.shields.io/npm/v/cortexflow?color=cb3837&logo=npm)](https://www.npmjs.com/package/cortexflow)
[![npm downloads](https://img.shields.io/npm/dm/cortexflow?color=cb3837&logo=npm)](https://www.npmjs.com/package/cortexflow)
[![GitHub stars](https://img.shields.io/github/stars/mithun50/CortexFlow?style=social)](https://github.com/mithun50/CortexFlow)
[![GitHub forks](https://img.shields.io/github/forks/mithun50/CortexFlow?style=social)](https://github.com/mithun50/CortexFlow/fork)

[![📖 Documentation](https://img.shields.io/badge/📖_Docs-Preview-2ea44f)](https://mithun50.github.io/CortexFlow/)

**Universal MCP Server for AI-to-AI Task Continuation**

CortexFlow is an MCP (Model Context Protocol) server that enables seamless handoff between AI agents. When you finish planning with ChatGPT, Claude Code can read the context and continue execution - without re-explaining the project.

## How It Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   AI Agent A (Planner)              AI Agent B (Executor)               │
│   ┌─────────────────┐               ┌─────────────────┐                 │
│   │    ChatGPT      │               │   Claude Code   │                 │
│   │    Gemini       │               │     Cursor      │                 │
│   │    Qwen         │               │    VS Code      │                 │
│   └────────┬────────┘               └────────┬────────┘                 │
│            │                                  │                          │
│            │  write_context()                 │  read_context()         │
│            │  add_task()                      │  update_task()          │
│            │  add_note()                      │  mark_task_complete()   │
│            │                                  │                          │
│            ▼                                  ▼                          │
│   ┌──────────────────────────────────────────────────────────┐          │
│   │                    CortexFlow MCP Server                  │          │
│   │                                                           │          │
│   │   ┌─────────────────────────────────────────────────┐    │          │
│   │   │              Shared Project Context              │    │          │
│   │   │                                                  │    │          │
│   │   │  • Project: "Todo API"                          │    │          │
│   │   │  • Phase: execution                              │    │          │
│   │   │  • Tasks: [Setup, Models, Routes, Tests]        │    │          │
│   │   │  • Notes: "Use Express + TypeScript"            │    │          │
│   │   │                                                  │    │          │
│   │   └─────────────────────────────────────────────────┘    │          │
│   │                                                           │          │
│   │   Transport: stdio (MCP) | HTTP API                      │          │
│   └──────────────────────────────────────────────────────────┘          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Supported AI Clients

### Desktop Apps (MCP)

| App | Platform | Config |
|-----|----------|--------|
| Claude Desktop | macOS, Windows, Linux | `claude_desktop_config.json` |
| Cursor | macOS, Windows, Linux | Settings → MCP |
| VS Code + Continue | macOS, Windows, Linux | `.continue/config.json` |
| Antigravity | macOS, Windows, Linux | MCP settings |
| Zed | macOS, Linux | Settings |
| Jan | macOS, Windows, Linux | MCP settings |
| LM Studio | macOS, Windows, Linux | MCP settings |
| Msty | macOS, Windows, Linux | MCP settings |

### CLI Agents (MCP)

| Agent | Transport | Config |
|-------|-----------|--------|
| Claude Code | stdio | `~/.claude/mcp.json` |
| Gemini CLI | stdio | MCP config |
| Qwen CLI | stdio | MCP config |
| Aider | stdio | MCP config |
| Any MCP client | stdio | Generic config |

### Web/Desktop Apps (HTTP API)

| App | Integration | Status |
|-----|-------------|--------|
| ChatGPT (Web/Desktop) | Custom GPT Actions | ✅ |
| Gemini (Web) | Function calling | ✅ |
| Typing Mind | Plugin/HTTP | ✅ |
| LibreChat | External tool | ✅ |
| Open WebUI | HTTP tools | ✅ |
| Any HTTP client | REST API | ✅ |

## Installation

### From npm (Recommended)

```bash
# Install globally
npm install -g cortexflow

# Or use directly with npx
npx cortexflow
```

### From Source

```bash
git clone https://github.com/mithun50/CortexFlow
cd CortexFlow
npm install
npm run build
```

## Configuration

### Claude Code

Add to `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "cortexflow": {
      "command": "npx",
      "args": ["-y", "cortexflow"]
    }
  }
}
```

Or add to project `.mcp.json` for project-specific config.

### Claude Desktop

Add to config file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/claude-desktop/config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "cortexflow": {
      "command": "npx",
      "args": ["-y", "cortexflow"]
    }
  }
}
```

### Cursor

1. Open Settings → MCP Servers
2. Add new server:
   - Name: `cortexflow`
   - Command: `npx -y cortexflow`

### VS Code + Continue

Add to `.continue/config.json`:

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "cortexflow"]
        }
      }
    ]
  }
}
```

### Antigravity (Google)

Add to `~/.gemini/antigravity/mcp_config.json`:

```json
{
  "mcpServers": {
    "cortexflow": {
      "command": "npx",
      "args": ["-y", "cortexflow"]
    }
  }
}
```

Or access via: **Agent Options (...)** → **MCP Servers** → **Manage MCP Servers** → **View raw config**

For HTTP mode (remote):
```json
{
  "mcpServers": {
    "cortexflow": {
      "serverUrl": "http://localhost:3210"
    }
  }
}
```

> **Note:** Antigravity uses `serverUrl` instead of `url` for HTTP-based MCP servers.

### ChatGPT (Custom GPT)

1. Start HTTP server: `cortexflow --http`
2. Create Custom GPT with Actions using OpenAPI spec at `http://localhost:3210/openapi.json`

### Generic MCP Client

For any MCP-compatible client, use stdio transport:
- Command: `npx`
- Args: `["-y", "cortexflow"]`

## MCP Tools

### Context Management

| Tool | Description |
|------|-------------|
| `read_context` | Read active project: tasks, notes, phase, metadata |
| `write_context` | Create new project with initial tasks |

### Task Management

| Tool | Description |
|------|-------------|
| `add_task` | Add a new task to the project |
| `update_task` | Update task status or add notes |
| `mark_task_complete` | Mark a task as completed |

### Agent Communication

| Tool | Description |
|------|-------------|
| `add_note` | Add a note for other AI agents |
| `set_phase` | Update project phase (planning/execution/review/completed) |

### Project Management

| Tool | Description |
|------|-------------|
| `list_projects` | List all projects |
| `set_active_project` | Switch active project |
| `delete_project` | Delete a project |

## Example Workflow

### Step 1: ChatGPT Creates Plan

User to ChatGPT: *"Plan a REST API for todo management"*

ChatGPT calls `write_context`:
```json
{
  "name": "Todo API",
  "description": "RESTful API with CRUD operations for todos",
  "phase": "planning",
  "tasks": [
    {"title": "Setup Express server", "description": "Initialize with TypeScript"},
    {"title": "Create Todo model", "description": "id, title, completed, createdAt"},
    {"title": "Implement CRUD routes", "description": "POST, GET, PUT, DELETE"},
    {"title": "Add input validation", "description": "Use Zod for validation"}
  ]
}
```

ChatGPT calls `add_note`:
```json
{
  "content": "Start with task 1-2 in parallel. Use in-memory storage for MVP.",
  "agent": "planner",
  "category": "decision"
}
```

ChatGPT calls `set_phase`:
```json
{"phase": "execution"}
```

### Step 2: Claude Code Continues

User to Claude Code: *"Continue the Todo API project"*

Claude Code calls `read_context` and receives:
```
Project: Todo API
Phase: execution
Tasks: 0/4 completed, 4 pending

Tasks:
  [a1b2] PENDING: Setup Express server
  [c3d4] PENDING: Create Todo model
  [e5f6] PENDING: Implement CRUD routes
  [g7h8] PENDING: Add input validation

Recent Notes:
  [planner/decision] Start with task 1-2 in parallel. Use in-memory storage for MVP.
```

Claude Code understands the full context and starts implementation:

```json
// update_task
{"task_id": "a1b2", "status": "in_progress"}
```

After completing:
```json
// mark_task_complete
{"task_id": "a1b2", "note": "Express server with TypeScript, CORS, helmet configured"}
```

### Step 3: Any AI Can Check Progress

Any connected AI can call `read_context` to see current state:
- Which tasks are done
- What notes were left
- Current project phase
- Full history of updates

## HTTP API

For non-MCP clients, start HTTP server:

```bash
cortexflow --http
```

### Endpoints

```
GET  /health                    Health check
GET  /openapi.json              OpenAPI spec (for ChatGPT Actions)

GET  /api/context               Read active project
PUT  /api/context               Update project metadata

GET  /api/projects              List all projects
POST /api/projects              Create new project
GET  /api/projects/:id          Get specific project
DELETE /api/projects/:id        Delete project

GET  /api/tasks                 List tasks
POST /api/tasks                 Add task
PUT  /api/tasks/:id             Update task
POST /api/tasks/:id/complete    Complete task

GET  /api/notes                 List notes
POST /api/notes                 Add note

POST /api/active                Set active project
```

### Example HTTP Calls

```bash
# Create project
curl -X POST http://localhost:3210/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"My Project","description":"Building something"}'

# Read context
curl http://localhost:3210/api/context

# Add task
curl -X POST http://localhost:3210/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"First task","description":"Do the thing"}'

# Complete task
curl -X POST http://localhost:3210/api/tasks/abc123/complete
```

## Data Storage

Projects are stored as JSON files:

```
~/.cortexflow/
└── data/
    ├── abc123.json      # Project file
    ├── def456.json      # Another project
    └── .active          # Active project ID
```

Configure with environment variable:
```bash
export CORTEXFLOW_DATA_DIR=/custom/path
```

## Context Schema

```typescript
interface ProjectContext {
  id: string;
  name: string;
  description: string;
  phase: "planning" | "execution" | "review" | "completed";
  version: number;
  createdAt: string;
  updatedAt: string;
  tasks: Task[];
  notes: AgentNote[];
  tags: string[];
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "blocked" | "completed" | "cancelled";
  priority: number;  // 1-5
  assignedTo: "planner" | "executor" | "reviewer" | null;
  notes: string[];
  dependencies: string[];
}

interface AgentNote {
  id: string;
  agent: "planner" | "executor" | "reviewer";
  content: string;
  category: "general" | "decision" | "blocker" | "insight";
  timestamp: string;
}
```

## Project Structure

```
cortexflow/
├── src/
│   ├── models.ts       # Data types and schemas
│   ├── storage.ts      # JSON file persistence
│   ├── server.ts       # MCP server (stdio)
│   ├── http-server.ts  # HTTP REST API
│   └── index.ts        # Entry point
├── config/
│   ├── claude-code/    # Claude Code config
│   ├── claude-desktop/ # Claude Desktop config
│   ├── cursor/         # Cursor config
│   ├── vscode/         # VS Code Continue config
│   └── generic-mcp.json
├── package.json
├── tsconfig.json
└── README.md
```

## Running

```bash
# MCP server (for Claude Code, Cursor, etc.)
cortexflow

# HTTP server (for ChatGPT, web clients)
cortexflow --http

# Both servers
cortexflow --both
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CORTEXFLOW_PORT` | `3210` | HTTP server port |
| `CORTEXFLOW_DATA_DIR` | `~/.cortexflow/data` | Data directory |

## Security

- HTTP server binds to localhost only
- No authentication (designed for local use)
- For remote access, use reverse proxy with auth
- Never expose directly to internet

## Documentation

- **[📖 Full Documentation](https://mithun50.github.io/CortexFlow/)** - Interactive docs website
- **[📚 API Reference](docs/API.md)** - MCP tools and HTTP endpoints
- **[📘 Usage Guide](docs/USAGE.md)** - Workflows and best practices
- **[🤝 Contributing](CONTRIBUTING.md)** - How to contribute
- **[🔒 Security Policy](SECURITY.md)** - Reporting vulnerabilities
- **[📜 Code of Conduct](CODE_OF_CONDUCT.md)** - Community guidelines

## Support the Project

If CortexFlow helps your workflow, consider supporting:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?logo=github)](https://github.com/sponsors/mithun50)

## Author

**Mithun Gowda B**
- GitHub: [@mithun50](https://github.com/mithun50)
- Email: mithungowda.b7411@gmail.com

## License

MIT License - see [LICENSE](LICENSE)
