# Usage Guide

Complete guide to using CortexFlow for AI-to-AI task continuation.

## Overview

CortexFlow enables AI agents to share context. One AI plans, another executes. No more re-explaining your project every time you switch tools.

## Supported Clients

### MCP Clients (stdio transport)

- **Claude Code** - CLI agent
- **Claude Desktop** - Desktop app
- **Cursor** - AI-powered IDE
- **VS Code + Continue** - Extension
- **Gemini CLI** - Google's CLI
- **Qwen CLI** - Alibaba's CLI
- **Aider** - Pair programming
- **Zed** - Modern editor
- **Jan** - Local AI
- **LM Studio** - Local models
- **Any MCP client** - Generic support

### HTTP Clients (REST API)

- **ChatGPT** - Custom GPT Actions
- **Gemini Web** - Function calling
- **Open WebUI** - Self-hosted
- **LibreChat** - Open source
- **Any HTTP client** - curl, Postman, etc.

## Typical Workflow

### 1. Planning Phase (ChatGPT/Gemini)

```
User: "Plan a REST API for user authentication"

ChatGPT calls write_context:
- Creates project with tasks
- Adds planning notes
- Sets phase to "execution"
```

### 2. Execution Phase (Claude Code/Cursor)

```
User: "Continue the auth API project"

Claude Code calls read_context:
- Reads all tasks and notes
- Understands the plan
- Starts implementing
```

### 3. Progress Updates

```
Claude Code calls:
- update_task: Mark task in_progress
- add_note: Document decisions
- mark_task_complete: Finish tasks
```

### 4. Review Phase

```
Any AI can:
- read_context: Check progress
- add_note: Leave feedback
- set_phase: Move to review/completed
```

## Running Modes

### MCP Mode (Default)

For Claude Code, Cursor, VS Code:

```bash
cortexflow
```

### HTTP Mode

For ChatGPT, web clients:

```bash
cortexflow --http
```

### Both Modes

```bash
cortexflow --both
```

## Agent Roles

| Role     | Purpose                              | Typical AI          |
| -------- | ------------------------------------ | ------------------- |
| Planner  | Design, architecture, task breakdown | ChatGPT, Gemini     |
| Executor | Implementation, coding               | Claude Code, Cursor |
| Reviewer | Testing, validation                  | Any AI              |

## Note Categories

- **general**: General observations
- **decision**: Design/architecture decisions
- **blocker**: Issues blocking progress
- **insight**: Discoveries or learnings

## Task Statuses

- **pending**: Not started
- **in_progress**: Currently being worked on
- **blocked**: Waiting on something
- **completed**: Done
- **cancelled**: No longer needed

## Advanced Features

### Critical Path Analysis

Find bottlenecks and optimize task scheduling:

```bash
# MCP
get_critical_path

# HTTP
curl http://localhost:3210/api/critical-path
```

Returns:

- Critical path tasks
- Bottleneck identification
- Parallel opportunities
- Estimated duration

### Smart Priority Queue

Get AI-optimized task order:

```bash
# MCP
get_smart_queue

# HTTP
curl http://localhost:3210/api/smart-queue?limit=5
```

Returns prioritized tasks with reasoning.

### Project Health Score

Get 0-100 health score:

```bash
# MCP
get_health_score

# HTTP
curl http://localhost:3210/api/health-score
```

Returns:

- Overall score
- Risk factors
- Recommendations
- Trend analysis

### Context Compression

Reduce tokens for AI-to-AI transfer:

```bash
# MCP
compress_context

# HTTP
curl http://localhost:3210/api/compress
```

Achieves 40-60% token reduction.

### Batch Operations

Execute multiple operations atomically:

```bash
curl -X POST http://localhost:3210/api/batch \
  -H "Content-Type: application/json" \
  -d '{"operations":[
    {"type":"create_task","payload":{"title":"Task 1"}},
    {"type":"create_task","payload":{"title":"Task 2"}}
  ]}'
```

## Project Templates

Quick-start with pre-built workflows:

| Template       | Use Case                |
| -------------- | ----------------------- |
| `tpl-bug-fix`  | Bug investigation & fix |
| `tpl-feature`  | New feature development |
| `tpl-refactor` | Code refactoring        |
| `tpl-review`   | Code review process     |

```bash
# Create from template
curl -X POST http://localhost:3210/api/templates/create \
  -H "Content-Type: application/json" \
  -d '{"template_id":"tpl-feature","project_name":"New Feature"}'
```

## Version Control

### Create Snapshot

```bash
curl -X POST http://localhost:3210/api/snapshots \
  -H "Content-Type: application/json" \
  -d '{"name":"Before refactor"}'
```

### Restore Snapshot

```bash
curl -X POST http://localhost:3210/api/snapshots/snap-123/restore
```

## Webhooks & Events

Subscribe to project events:

```bash
curl -X POST http://localhost:3210/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-server.com/hook","events":["task.completed"]}'
```

Available events:

- `task.created`
- `task.completed`
- `task.updated`
- `note.added`
- `phase.changed`
- `project.updated`

## Personal Productivity

### Todo/Did Lists

Separate from project tasks - track personal items:

```bash
# Add personal todo
curl -X POST http://localhost:3210/api/personal-todos \
  -H "Content-Type: application/json" \
  -d '{"content":"Review PR #42","priority":1,"tags":["review"]}'

# Complete with reflection
curl -X POST http://localhost:3210/api/personal-todos/todo-123/complete \
  -H "Content-Type: application/json" \
  -d '{"reflection":"Found 3 issues","duration":30}'

# View completed items
curl http://localhost:3210/api/dids
```

### Goals

Set daily and weekly goals:

```bash
# Set daily goals
curl -X PUT http://localhost:3210/api/goals \
  -H "Content-Type: application/json" \
  -d '{"type":"daily","goals":["Complete API review","Write tests"]}'

# Get goals
curl http://localhost:3210/api/goals
```

### Session Memory

Persist preferences and decisions across sessions:

```bash
# Remember something
curl -X POST http://localhost:3210/api/memory \
  -H "Content-Type: application/json" \
  -d '{"key":"preferred_style","value":"functional","category":"preference"}'

# Recall later
curl "http://localhost:3210/api/memory?key=preferred_style"
```

Categories:

- `preference`: User preferences
- `decision`: Architecture decisions
- `context`: Project context
- `learning`: Learnings
- `reminder`: Reminders

### Time Tracking

Track time spent on tasks:

```bash
# Start tracking
curl -X POST http://localhost:3210/api/time-tracking/start \
  -H "Content-Type: application/json" \
  -d '{"task_id":"task-123","project_id":"proj-456"}'

# Stop tracking
curl -X POST http://localhost:3210/api/time-tracking/stop

# Get stats
curl "http://localhost:3210/api/time-tracking/stats?period=week"
```

## AI Prompt Templates

Generate context-aware prompts:

```bash
# List templates
curl http://localhost:3210/api/prompts

# Generate filled prompt
curl -X POST http://localhost:3210/api/prompts/generate \
  -H "Content-Type: application/json" \
  -d '{"template_id":"prompt-handoff","project_id":"proj-123"}'
```

Built-in templates:

- `prompt-plan`: Project planning
- `prompt-debug`: Debugging assistant
- `prompt-review`: Code review
- `prompt-handoff`: AI handoff
- `prompt-standup`: Daily standup

## Multi-AI Export

Export context for different AI assistants:

```bash
# For Claude
curl "http://localhost:3210/api/export-md?target=claude&format=detailed"

# For Gemini
curl "http://localhost:3210/api/export-md?target=gemini&format=standard"

# For ChatGPT
curl "http://localhost:3210/api/export-md?target=chatgpt&format=minimal"

# For Cursor
curl "http://localhost:3210/api/export-md?target=cursor"

# For Copilot
curl "http://localhost:3210/api/export-md?target=copilot"
```

Formats:

- `minimal`: Essential info only
- `standard`: Balanced detail
- `detailed`: Full context

## Productivity Dashboard

### Daily Digest

```bash
curl http://localhost:3210/api/digest
```

Returns:

- Tasks completed today
- Time tracked
- Streak information
- Highlights

### Productivity Stats

```bash
curl "http://localhost:3210/api/productivity-stats?period=week"
```

Returns:

- Completion rates
- Time statistics
- Trends
- Streaks

## Audit Trail

View complete change history:

```bash
# All logs
curl http://localhost:3210/api/audit

# Filter by action
curl "http://localhost:3210/api/audit?action=task.completed"

# Filter by agent
curl "http://localhost:3210/api/audit?agent=executor"
```

## Tips

1. **Be descriptive**: Good task titles help other AIs understand quickly
2. **Use notes liberally**: Document decisions for context
3. **Update status promptly**: Keeps all agents in sync
4. **Use priorities**: 1 = highest, 5 = lowest
5. **Create snapshots**: Before risky changes
6. **Use templates**: For consistent workflows
7. **Track time**: For better estimates
8. **Set goals**: Stay focused on priorities
9. **Use memory**: Persist important decisions
10. **Export context**: When switching AI tools

## Environment Variables

| Variable              | Default              | Description      |
| --------------------- | -------------------- | ---------------- |
| `CORTEXFLOW_PORT`     | `3210`               | HTTP server port |
| `CORTEXFLOW_DATA_DIR` | `~/.cortexflow/data` | Data directory   |

## Data Storage

Projects are stored as JSON files:

```
~/.cortexflow/
└── data/
    ├── abc123.json      # Project file
    ├── def456.json      # Another project
    └── .active          # Active project ID
```

## Security

- HTTP server binds to localhost only
- No authentication (designed for local use)
- For remote access, use reverse proxy with auth
- Never expose directly to internet
