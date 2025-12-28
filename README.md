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

[![Benchmark](https://github.com/mithun50/CortexFlow/actions/workflows/benchmark.yml/badge.svg)](https://github.com/mithun50/CortexFlow/actions/workflows/benchmark.yml)
[![Token Savings](https://img.shields.io/badge/token%20savings-56%25-brightgreen)](benchmarks/results/BENCHMARK.md)
[![Compression](https://img.shields.io/badge/compression-5.2x-green)](benchmarks/results/BENCHMARK.md)
[![Memory](https://img.shields.io/badge/memory-121MB-green)](benchmarks/results/BENCHMARK.md)

[![📖 Documentation](https://img.shields.io/badge/📖_Docs-Preview-2ea44f)](https://mithun50.github.io/CortexFlow/)

**Universal MCP Server for AI-to-AI Task Continuation**

## 📊 Benchmark Results

<!-- BENCHMARK_RESULTS_START -->
<details>
<summary><b>Performance Metrics</b> (click to expand)</summary>

> _Auto-updated by CI_
> _Last updated: 2025-12-28_

### Summary

| Metric                | Value      |
| --------------------- | ---------- |
| Avg Token Savings     | **56%**    |
| Avg Compression Ratio | **5.2x**   |
| Peak Memory           | **121 MB** |
| Avg Ops/Second        | **56.8K**  |

[View Full Benchmark Report](benchmarks/results/BENCHMARK.md)

</details>
<!-- BENCHMARK_RESULTS_END -->

CortexFlow is an MCP (Model Context Protocol) server that enables seamless handoff between AI agents. When you finish planning with ChatGPT, Claude Code can read the context and continue execution - without re-explaining the project.

## The Problem

Every time you switch between AI assistants, you lose context:

```
😫 Without CortexFlow:
┌─────────────────────────────────────────────────────────────┐
│  ChatGPT: "I've designed a plan with 5 tasks..."           │
│     ↓                                                       │
│  [Switch to Claude Code]                                    │
│     ↓                                                       │
│  Claude: "What project? What tasks? Please explain again."  │
│     ↓                                                       │
│  You: *Re-explains everything for the 10th time* 😩         │
└─────────────────────────────────────────────────────────────┘

✅ With CortexFlow:
┌─────────────────────────────────────────────────────────────┐
│  ChatGPT: write_context() → "Plan saved to CortexFlow"      │
│     ↓                                                       │
│  [Switch to Claude Code]                                    │
│     ↓                                                       │
│  Claude: read_context() → "Got it! Continuing task 2..."    │
└─────────────────────────────────────────────────────────────┘
```

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

| App                | Platform              | Config                       |
| ------------------ | --------------------- | ---------------------------- |
| Claude Desktop     | macOS, Windows, Linux | `claude_desktop_config.json` |
| Cursor             | macOS, Windows, Linux | Settings → MCP               |
| VS Code + Continue | macOS, Windows, Linux | `.continue/config.json`      |
| Antigravity        | macOS, Windows, Linux | MCP settings                 |
| Zed                | macOS, Linux          | Settings                     |
| Jan                | macOS, Windows, Linux | MCP settings                 |
| LM Studio          | macOS, Windows, Linux | MCP settings                 |
| Msty               | macOS, Windows, Linux | MCP settings                 |

### CLI Agents (MCP)

| Agent          | Transport | Config               |
| -------------- | --------- | -------------------- |
| Claude Code    | stdio     | `~/.claude/mcp.json` |
| Gemini CLI     | stdio     | MCP config           |
| Qwen CLI       | stdio     | MCP config           |
| Aider          | stdio     | MCP config           |
| Any MCP client | stdio     | Generic config       |

### Web/Desktop Apps (HTTP API)

| App                   | Integration        | Status |
| --------------------- | ------------------ | ------ |
| ChatGPT (Web/Desktop) | Custom GPT Actions | ✅     |
| Gemini (Web)          | Function calling   | ✅     |
| Typing Mind           | Plugin/HTTP        | ✅     |
| LibreChat             | External tool      | ✅     |
| Open WebUI            | HTTP tools         | ✅     |
| Any HTTP client       | REST API           | ✅     |

## Key Features

### Core Capabilities

| Feature                | Description                                                             |
| ---------------------- | ----------------------------------------------------------------------- |
| **Dual Transport**     | MCP (stdio) + HTTP REST API - works with any client                     |
| **14+ Client Configs** | Ready-to-use configs for Claude, Cursor, VS Code, ChatGPT, Gemini, etc. |
| **OpenAPI Spec**       | Auto-generated spec for ChatGPT Custom GPT Actions                      |
| **Agent Roles**        | Planner, Executor, Reviewer - track who did what                        |
| **Note Categories**    | General, Decision, Blocker, Insight - structured communication          |
| **Task Dependencies**  | Define which tasks depend on others                                     |
| **Project Phases**     | Planning → Execution → Review → Completed lifecycle                     |

### Unique Features (Not in Competitors)

| Feature                     | Description                                              | Status       |
| --------------------------- | -------------------------------------------------------- | ------------ |
| **Agent Attribution**       | Every action tracked with agent role + timestamp         | ✅ Available |
| **Blocker Detection**       | Tasks marked as "blocked" with reason tracking           | ✅ Available |
| **Priority System**         | 5-level priority (1=critical to 5=low)                   | ✅ Available |
| **Version Tracking**        | Auto-incrementing version on every change                | ✅ Available |
| **Dependency Graph**        | Task dependencies for execution ordering                 | ✅ Available |
| **Multi-Project**           | Switch between multiple projects seamlessly              | ✅ Available |
| **Project Snapshots**       | Version control with rollback capability                 | ✅ Available |
| **Agent Analytics**         | Track completion rates per agent                         | ✅ Available |
| **Webhook Events**          | Notify external systems on task completion               | ✅ Available |
| **Workflow Templates**      | Pre-built templates (Bug Fix, Feature, Refactor, Review) | ✅ Available |
| **Critical Path Analysis**  | Identify bottlenecks and optimize task scheduling        | ✅ Available |
| **Smart Priority Queue**    | AI-optimized task ordering based on dependencies         | ✅ Available |
| **Context Compression**     | 40-60% token reduction for efficient AI-to-AI transfer   | ✅ Available |
| **Project Health Score**    | 0-100 score with risk analysis and recommendations       | ✅ Available |
| **Batch Operations**        | Execute multiple operations atomically                   | ✅ Available |
| **Intelligent Suggestions** | AI-powered recommendations for project health            | ✅ Available |
| **Audit Logging**           | Complete change history with filtering                   | ✅ Available |
| **Personal Todo/Did Lists** | Personal task tracking with reflections & goals          | ✅ Available |
| **Session Memory**          | Persistent key-value storage across sessions             | ✅ Available |
| **Time Tracking**           | Track time per task with statistics                      | ✅ Available |
| **AI Prompt Templates**     | Pre-built prompts for planning, debugging, review        | ✅ Available |
| **Multi-AI Export**         | Export context for Claude, Gemini, ChatGPT, Cursor       | ✅ Available |
| **Productivity Dashboard**  | Daily digest, streaks, productivity stats                | ✅ Available |
| **RAG (Semantic Search)**   | Index documents, vector search, context retrieval        | ✅ Available |

## RAG (Retrieval-Augmented Generation)

CortexFlow includes a powerful RAG module for semantic search and document retrieval. Index project context or custom documents and retrieve relevant information using vector or keyword search.

### RAG Features

| Feature                     | Description                                             |
| --------------------------- | ------------------------------------------------------- |
| **Document Indexing**       | Index documents with automatic chunking                 |
| **Vector Search**           | Semantic similarity search using embeddings             |
| **Keyword Search**          | Full-text search using SQLite FTS5                      |
| **Hybrid Search**           | Combined vector (70%) + keyword (30%) for best results  |
| **Configurable Embeddings** | Local (transformers.js) or API (OpenAI, Voyage, Cohere) |
| **Chunking Strategies**     | Paragraph, sentence, fixed-size, or semantic chunking   |
| **Project Context RAG**     | Automatically index project tasks, notes, and decisions |

### RAG MCP Tools

| Tool                  | Description                                      |
| --------------------- | ------------------------------------------------ |
| `rag_index_document`  | Index a custom document with optional metadata   |
| `rag_index_project`   | Index entire project context for semantic search |
| `rag_search`          | Search with vector, keyword, or hybrid mode      |
| `rag_query_context`   | Get formatted context for AI prompts             |
| `rag_list_documents`  | List all indexed documents                       |
| `rag_delete_document` | Remove a document from the index                 |
| `rag_get_stats`       | Get RAG statistics (docs, chunks, config)        |
| `rag_configure`       | Configure embedding provider and chunking        |

### RAG HTTP Endpoints

```bash
# Index a document
curl -X POST http://localhost:3210/api/rag/index-document \
  -H "Content-Type: application/json" \
  -d '{"title":"API Guide","content":"Your document content here..."}'

# Index project context
curl -X POST http://localhost:3210/api/rag/index-project

# Search documents
curl "http://localhost:3210/api/rag/search?query=authentication&type=hybrid&limit=5"

# Get context for prompts
curl "http://localhost:3210/api/rag/context?query=how%20to%20implement%20auth"

# List indexed documents
curl http://localhost:3210/api/rag/documents

# Get RAG stats
curl http://localhost:3210/api/rag/stats

# Configure RAG
curl -X PUT http://localhost:3210/api/rag/config \
  -H "Content-Type: application/json" \
  -d '{"embedding":{"provider":"openai"},"search":{"topK":10}}'
```

### Embedding Providers

| Provider | Model                   | Dimensions | API Key Required |
| -------- | ----------------------- | ---------- | ---------------- |
| `local`  | Xenova/all-MiniLM-L6-v2 | 384        | No               |
| `openai` | text-embedding-3-small  | 1536       | Yes              |
| `voyage` | voyage-2                | 1024       | Yes              |
| `cohere` | embed-english-v3.0      | 1024       | Yes              |
| `custom` | Any endpoint            | Custom     | Depends          |

### Chunking Strategies

| Strategy    | Description                               | Best For             |
| ----------- | ----------------------------------------- | -------------------- |
| `paragraph` | Split on double newlines                  | General text         |
| `sentence`  | Split on sentence boundaries              | Q&A, detailed search |
| `fixed`     | Fixed character size with overlap         | Uniform chunks       |
| `semantic`  | Split on markdown headers and code blocks | Technical docs       |

### RAG Example Workflow

```bash
# 1. Start the server
cortexflow --http

# 2. Index your project documentation
curl -X POST http://localhost:3210/api/rag/index-document \
  -d '{"title":"Architecture","content":"# System Architecture\n\nOur API uses..."}'

# 3. Index project context (tasks, notes, decisions)
curl -X POST http://localhost:3210/api/rag/index-project

# 4. Query for relevant context
curl "http://localhost:3210/api/rag/context?query=authentication%20flow"

# Response includes relevant chunks formatted for AI prompts
```

### RAG Configuration

```json
{
  "embedding": {
    "provider": "local",
    "model": "Xenova/all-MiniLM-L6-v2",
    "dimensions": 384,
    "batchSize": 10
  },
  "chunking": {
    "strategy": "semantic",
    "chunkSize": 500,
    "chunkOverlap": 50,
    "minChunkSize": 50,
    "maxChunkSize": 2000
  },
  "search": {
    "topK": 5,
    "minScore": 0.5,
    "hybridAlpha": 0.7
  }
}
```

> **Note:** RAG requires `better-sqlite3` native module. It will gracefully degrade on platforms without native module support.

## Alternatives & Comparison

CortexFlow isn't the only solution. Here's how it compares:

| Feature              | CortexFlow         | [mcp-handoff-server](https://github.com/dazeb/mcp-handoff-server) | [OpenMemory MCP](https://mem0.ai/blog/introducing-openmemory-mcp) | [Context Sync](https://www.producthunt.com/products/context-sync-local-mcp-server) |
| -------------------- | ------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Transport**        | MCP + HTTP         | MCP only                                                          | MCP only                                                          | MCP only                                                                           |
| **ChatGPT Support**  | ✅ OpenAPI Actions | ❌                                                                | ❌                                                                | ❌                                                                                 |
| **Task Management**  | ✅ Full CRUD       | ✅ Handoff docs                                                   | ❌ Memory focus                                                   | ✅ Todo system                                                                     |
| **Agent Roles**      | ✅ 3 roles         | ❌                                                                | ❌                                                                | ❌                                                                                 |
| **Dependencies**     | ✅ Task deps       | ❌                                                                | ❌                                                                | ❌                                                                                 |
| **Note Categories**  | ✅ 4 types         | ❌                                                                | ❌                                                                | ❌                                                                                 |
| **Storage**          | JSON files         | JSON files                                                        | SQLite                                                            | SQLite                                                                             |
| **Setup Complexity** | Simple             | Simple                                                            | Moderate                                                          | Moderate                                                                           |
| **Primary Focus**    | Task handoff + RAG | Doc handoff                                                       | Memory/RAG                                                        | Code context                                                                       |
| **RAG/Embeddings**   | ✅ Full RAG        | ❌                                                                | ✅ Memory focus                                                   | ❌                                                                                 |

### When to Use CortexFlow

✅ **Use CortexFlow if you need:**

- HTTP API for ChatGPT/web clients
- Structured task management with priorities
- Agent role tracking (who did what)
- RAG with semantic and keyword search
- Configurable embedding providers (local or API)
- Simple JSON storage you can inspect

❌ **Consider alternatives if you need:**

- Deep code understanding ([Context Sync](https://www.producthunt.com/products/context-sync-local-mcp-server))
- Complex handoff documents ([mcp-handoff-server](https://github.com/dazeb/mcp-handoff-server))

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

| Tool            | Description                                        |
| --------------- | -------------------------------------------------- |
| `read_context`  | Read active project: tasks, notes, phase, metadata |
| `write_context` | Create new project with initial tasks              |

### Task Management

| Tool                 | Description                     |
| -------------------- | ------------------------------- |
| `add_task`           | Add a new task to the project   |
| `update_task`        | Update task status or add notes |
| `mark_task_complete` | Mark a task as completed        |

### Agent Communication

| Tool        | Description                                                |
| ----------- | ---------------------------------------------------------- |
| `add_note`  | Add a note for other AI agents                             |
| `set_phase` | Update project phase (planning/execution/review/completed) |

### Project Management

| Tool                 | Description                                           |
| -------------------- | ----------------------------------------------------- |
| `list_projects`      | List all projects                                     |
| `set_active_project` | Switch active project                                 |
| `delete_project`     | Delete a project                                      |
| `get_analytics`      | Get project analytics (completion rates, agent stats) |
| `export_project`     | Export project to Markdown format                     |
| `clone_project`      | Clone a project with optional task reset              |

### Intelligent Features

| Tool                | Description                                           |
| ------------------- | ----------------------------------------------------- |
| `get_critical_path` | Analyze task dependencies, find bottlenecks           |
| `get_smart_queue`   | Get AI-prioritized task execution order               |
| `compress_context`  | Get token-efficient compressed representation         |
| `get_health_score`  | Get 0-100 health score with risks and recommendations |
| `batch_operations`  | Execute multiple operations atomically                |
| `get_suggestions`   | Get AI-powered task suggestions                       |

### Webhooks & Events

| Tool               | Description                                        |
| ------------------ | -------------------------------------------------- |
| `register_webhook` | Subscribe to project events (task.completed, etc.) |
| `list_webhooks`    | List all registered webhooks                       |
| `delete_webhook`   | Unsubscribe a webhook                              |

### Templates

| Tool                   | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `list_templates`       | List available project templates                                  |
| `create_from_template` | Create project from template (bug-fix, feature, refactor, review) |

### Version Control

| Tool               | Description                       |
| ------------------ | --------------------------------- |
| `create_snapshot`  | Save project state for rollback   |
| `list_snapshots`   | List all snapshots for a project  |
| `restore_snapshot` | Restore project to previous state |

### Audit Trail

| Tool            | Description                                |
| --------------- | ------------------------------------------ |
| `get_audit_log` | Get complete change history with filtering |

### Personal Todo/Did Lists

| Tool                     | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `add_personal_todo`      | Add personal todo (separate from project tasks) |
| `list_personal_todos`    | List personal todos with filtering              |
| `complete_personal_todo` | Complete todo and move to "did" list            |
| `list_dids`              | View completed items with reflections           |
| `set_goals`              | Set daily/weekly goals                          |
| `get_goals`              | Get current goals                               |

### Session Memory

| Tool            | Description                                        |
| --------------- | -------------------------------------------------- |
| `remember`      | Store key-value pairs that persist across sessions |
| `recall`        | Retrieve stored memory by key                      |
| `list_memories` | List all memories with filtering                   |
| `forget`        | Remove a specific memory                           |

### Time Tracking

| Tool                  | Description                     |
| --------------------- | ------------------------------- |
| `start_time_tracking` | Start tracking time for a task  |
| `stop_time_tracking`  | Stop tracking and log duration  |
| `get_time_stats`      | Get time statistics per project |

### AI Prompt Templates

| Tool                    | Description                                            |
| ----------------------- | ------------------------------------------------------ |
| `list_prompt_templates` | List available prompt templates                        |
| `generate_prompt`       | Generate filled prompt from template + project context |

### Multi-AI Export

| Tool               | Description                                         |
| ------------------ | --------------------------------------------------- |
| `export_claude_md` | Export for Claude, Gemini, ChatGPT, Cursor, Copilot |

### Productivity Dashboard

| Tool                     | Description                       |
| ------------------------ | --------------------------------- |
| `get_daily_digest`       | Daily productivity summary        |
| `get_productivity_stats` | Weekly/monthly stats with streaks |

## Example Workflow

### Step 1: ChatGPT Creates Plan

User to ChatGPT: _"Plan a REST API for todo management"_

ChatGPT calls `write_context`:

```json
{
  "name": "Todo API",
  "description": "RESTful API with CRUD operations for todos",
  "phase": "planning",
  "tasks": [
    { "title": "Setup Express server", "description": "Initialize with TypeScript" },
    { "title": "Create Todo model", "description": "id, title, completed, createdAt" },
    { "title": "Implement CRUD routes", "description": "POST, GET, PUT, DELETE" },
    { "title": "Add input validation", "description": "Use Zod for validation" }
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
{ "phase": "execution" }
```

### Step 2: Claude Code Continues

User to Claude Code: _"Continue the Todo API project"_

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
{ "task_id": "a1b2", "status": "in_progress" }
```

After completing:

```json
// mark_task_complete
{ "task_id": "a1b2", "note": "Express server with TypeScript, CORS, helmet configured" }
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
# Core
GET  /health                    Health check
GET  /openapi.json              OpenAPI spec (for ChatGPT Actions)

# Projects
GET  /api/context               Read active project
PUT  /api/context               Update project metadata
GET  /api/projects              List all projects
POST /api/projects              Create new project
GET  /api/projects/:id          Get specific project
DELETE /api/projects/:id        Delete project
POST /api/active                Set active project
POST /api/clone                 Clone a project

# Tasks
GET  /api/tasks                 List tasks
POST /api/tasks                 Add task
PUT  /api/tasks/:id             Update task
POST /api/tasks/:id/complete    Complete task

# Notes & Analytics
GET  /api/notes                 List notes
POST /api/notes                 Add note
GET  /api/analytics             Get project analytics
GET  /api/export                Export project (markdown/json)

# Intelligent Features
GET  /api/critical-path         Critical path analysis
GET  /api/smart-queue           AI-prioritized task queue
GET  /api/compress              Token-efficient context
GET  /api/health-score          Project health score
POST /api/batch                 Batch operations
GET  /api/suggestions           AI suggestions

# Advanced Features
GET  /api/webhooks              List webhooks
POST /api/webhooks              Register webhook
DELETE /api/webhooks/:id        Delete webhook
GET  /api/templates             List templates
POST /api/templates/create      Create from template
GET  /api/snapshots             List snapshots
POST /api/snapshots             Create snapshot
POST /api/snapshots/:id/restore Restore snapshot
GET  /api/audit                 Audit log

# Productivity Features
GET  /api/personal-todos        List personal todos
POST /api/personal-todos        Add personal todo
POST /api/personal-todos/:id/complete  Complete todo
GET  /api/dids                  List completed items
GET  /api/goals                 Get goals
PUT  /api/goals                 Set goals
GET  /api/memory                List memories
POST /api/memory                Remember something
DELETE /api/memory?key=...      Forget memory
POST /api/time-tracking/start   Start time tracking
POST /api/time-tracking/stop    Stop time tracking
GET  /api/time-tracking/stats   Get time stats
GET  /api/prompts               List prompt templates
POST /api/prompts/generate      Generate filled prompt
GET  /api/export-md             Export for AI (claude/gemini/chatgpt/cursor)
GET  /api/digest                Get daily digest
GET  /api/productivity-stats    Get productivity stats
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

# Get critical path analysis
curl http://localhost:3210/api/critical-path

# Get smart task queue
curl http://localhost:3210/api/smart-queue?limit=5

# Get project health score
curl http://localhost:3210/api/health-score

# Get compressed context (for AI-to-AI transfer)
curl http://localhost:3210/api/compress

# Create project from template
curl -X POST http://localhost:3210/api/templates/create \
  -H "Content-Type: application/json" \
  -d '{"template_id":"tpl-feature","project_name":"New Feature"}'

# Create snapshot
curl -X POST http://localhost:3210/api/snapshots \
  -H "Content-Type: application/json" \
  -d '{"name":"Before refactor","description":"Backup before changes"}'

# Batch operations
curl -X POST http://localhost:3210/api/batch \
  -H "Content-Type: application/json" \
  -d '{"operations":[
    {"type":"create_task","payload":{"title":"Task 1","description":"First"}},
    {"type":"create_task","payload":{"title":"Task 2","description":"Second"}}
  ]}'

# Add personal todo
curl -X POST http://localhost:3210/api/personal-todos \
  -H "Content-Type: application/json" \
  -d '{"content":"Review PR","priority":2,"tags":["code-review"]}'

# Remember something
curl -X POST http://localhost:3210/api/memory \
  -H "Content-Type: application/json" \
  -d '{"key":"preferred_style","value":"functional","category":"preference"}'

# Export for Claude/Gemini/ChatGPT
curl "http://localhost:3210/api/export-md?format=standard&target=gemini"

# Get daily digest
curl http://localhost:3210/api/digest

# Get productivity stats
curl "http://localhost:3210/api/productivity-stats?period=week"
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
  phase: 'planning' | 'execution' | 'review' | 'completed';
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
  status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
  priority: number; // 1-5
  assignedTo: 'planner' | 'executor' | 'reviewer' | null;
  notes: string[];
  dependencies: string[];
}

interface AgentNote {
  id: string;
  agent: 'planner' | 'executor' | 'reviewer';
  content: string;
  category: 'general' | 'decision' | 'blocker' | 'insight';
  timestamp: string;
}
```

## Project Structure

```
cortexflow/
├── src/
│   ├── models.ts                # Data types and schemas
│   ├── storage.ts               # JSON file persistence
│   ├── server.ts                # MCP server (stdio)
│   ├── http-server.ts           # HTTP REST API
│   ├── intelligent-features.ts  # Smart queue, health score, compression
│   ├── productivity-features.ts # Personal todos, time tracking, exports
│   ├── index.ts                 # Entry point
│   └── rag/                     # RAG module
│       ├── rag-storage.ts       # SQLite vector storage
│       ├── rag-features.ts      # High-level RAG operations
│       ├── embeddings.ts        # Configurable embedding providers
│       ├── chunking.ts          # Document chunking strategies
│       └── index.ts             # RAG module exports
├── tests/                       # Test files
│   ├── rag.test.ts              # RAG tests
│   ├── chunking.test.ts         # Chunking tests
│   ├── embeddings.test.ts       # Embedding tests
│   └── ...
├── benchmarks/                  # Performance benchmarks
│   └── index.ts                 # Benchmark suite
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

| Variable              | Default              | Description      |
| --------------------- | -------------------- | ---------------- |
| `CORTEXFLOW_PORT`     | `3210`               | HTTP server port |
| `CORTEXFLOW_DATA_DIR` | `~/.cortexflow/data` | Data directory   |

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
