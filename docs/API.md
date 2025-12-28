# CortexFlow API Reference

Complete reference for all MCP tools and HTTP endpoints.

## MCP Tools

### Context Management

#### read_context

Read the active project context.

**Parameters:**

- `project_id` (optional): Specific project ID. Defaults to active project.
- `include_completed` (optional): Include completed tasks. Default: false.

**Returns:** Project metadata, tasks, notes, and phase.

---

#### write_context

Create a new project.

**Parameters:**

- `name` (required): Project name
- `description` (required): Project description
- `phase` (optional): Initial phase. Default: "planning"
- `tags` (optional): Array of tags
- `tasks` (optional): Initial tasks array

---

### Task Management

#### add_task

Add a task to the active project.

**Parameters:**

- `title` (required): Task title
- `description` (required): Task description
- `priority` (optional): 1-5, where 1 is highest
- `dependencies` (optional): Array of task IDs

---

#### update_task

Update a task's status or add notes.

**Parameters:**

- `task_id` (required): Task ID
- `status` (optional): pending | in_progress | blocked | completed | cancelled
- `note` (optional): Note to add

---

#### mark_task_complete

Mark a task as completed.

**Parameters:**

- `task_id` (required): Task ID
- `note` (optional): Completion note

---

### Agent Communication

#### add_note

Add a note for other AI agents.

**Parameters:**

- `content` (required): Note content
- `agent` (optional): planner | executor | reviewer
- `category` (optional): general | decision | blocker | insight

---

#### set_phase

Update project phase.

**Parameters:**

- `phase` (required): planning | execution | review | completed

---

### Project Management

#### list_projects

List all projects.

**Returns:** Array of project summaries.

---

#### set_active_project

Set the active project.

**Parameters:**

- `project_id` (required): Project ID to activate

---

#### delete_project

Delete a project.

**Parameters:**

- `project_id` (required): Project ID to delete

---

#### get_analytics

Get project analytics.

**Parameters:**

- `project_id` (optional): Project ID. Defaults to active.

**Returns:** Completion rates, agent statistics, timeline data.

---

#### export_project

Export project to Markdown format.

**Parameters:**

- `project_id` (optional): Project ID
- `format` (optional): "markdown" | "json"

---

#### clone_project

Clone a project with optional task reset.

**Parameters:**

- `project_id` (required): Source project ID
- `new_name` (required): New project name
- `reset_tasks` (optional): Reset all tasks to pending. Default: false

---

### Intelligent Features

#### get_critical_path

Analyze task dependencies and find bottlenecks.

**Parameters:**

- `project_id` (optional): Project ID

**Returns:** Critical path tasks, bottlenecks, parallel opportunities, estimated duration.

---

#### get_smart_queue

Get AI-prioritized task execution order.

**Parameters:**

- `project_id` (optional): Project ID
- `limit` (optional): Max tasks to return

**Returns:** Prioritized task list with scores and reasoning.

---

#### compress_context

Get token-efficient compressed representation.

**Parameters:**

- `project_id` (optional): Project ID
- `max_tokens` (optional): Target token limit

**Returns:** Compressed context with 40-60% token reduction.

---

#### get_health_score

Get 0-100 health score with risks and recommendations.

**Parameters:**

- `project_id` (optional): Project ID

**Returns:** Health score, risk factors, recommendations, trend analysis.

---

#### batch_operations

Execute multiple operations atomically.

**Parameters:**

- `operations` (required): Array of operations
  - Each operation: `{type, payload}`
  - Types: create_task, update_task, complete_task, add_note, set_phase

**Returns:** Results of all operations.

---

#### get_suggestions

Get AI-powered task suggestions.

**Parameters:**

- `project_id` (optional): Project ID
- `context` (optional): Additional context for suggestions

**Returns:** Suggested tasks based on project patterns.

---

### Webhooks & Events

#### register_webhook

Subscribe to project events.

**Parameters:**

- `url` (required): Webhook URL
- `events` (required): Array of events to subscribe to
  - Events: task.created, task.completed, task.updated, note.added, phase.changed, project.updated

**Returns:** Webhook ID and confirmation.

---

#### list_webhooks

List all registered webhooks.

**Returns:** Array of webhook configurations.

---

#### delete_webhook

Unsubscribe a webhook.

**Parameters:**

- `webhook_id` (required): Webhook ID to delete

---

### Templates

#### list_templates

List available project templates.

**Returns:** Array of templates with descriptions.

Available templates:

- `tpl-bug-fix`: Bug fix workflow
- `tpl-feature`: New feature development
- `tpl-refactor`: Code refactoring
- `tpl-review`: Code review process

---

#### create_from_template

Create project from template.

**Parameters:**

- `template_id` (required): Template ID
- `project_name` (required): New project name
- `variables` (optional): Template variables

---

### Version Control

#### create_snapshot

Save project state for rollback.

**Parameters:**

- `project_id` (optional): Project ID
- `name` (required): Snapshot name
- `description` (optional): Snapshot description

---

#### list_snapshots

List all snapshots for a project.

**Parameters:**

- `project_id` (optional): Project ID

**Returns:** Array of snapshots with metadata.

---

#### restore_snapshot

Restore project to previous state.

**Parameters:**

- `snapshot_id` (required): Snapshot ID to restore

---

### Audit Trail

#### get_audit_log

Get complete change history with filtering.

**Parameters:**

- `project_id` (optional): Project ID
- `action` (optional): Filter by action type
- `agent` (optional): Filter by agent
- `limit` (optional): Max entries to return

**Returns:** Array of audit log entries.

---

### Personal Todo/Did Lists

#### add_personal_todo

Add personal todo (separate from project tasks).

**Parameters:**

- `content` (required): Todo content
- `priority` (optional): 1-5
- `tags` (optional): Array of tags
- `due_date` (optional): Due date (ISO string)
- `context` (optional): Additional context

---

#### list_personal_todos

List personal todos with filtering.

**Parameters:**

- `tag` (optional): Filter by tag
- `priority` (optional): Filter by priority

**Returns:** Array of personal todos.

---

#### complete_personal_todo

Complete todo and move to "did" list.

**Parameters:**

- `todo_id` (required): Todo ID
- `reflection` (optional): Reflection on completion
- `duration` (optional): Time spent (minutes)

---

#### list_dids

View completed items with reflections.

**Parameters:**

- `limit` (optional): Max items to return
- `tag` (optional): Filter by tag

**Returns:** Array of completed items with reflections.

---

#### set_goals

Set daily/weekly goals.

**Parameters:**

- `type` (required): "daily" | "weekly"
- `goals` (required): Array of goal strings

---

#### get_goals

Get current goals.

**Returns:** Daily and weekly goals with progress.

---

### Session Memory

#### remember

Store key-value pairs that persist across sessions.

**Parameters:**

- `key` (required): Memory key
- `value` (required): Value to store
- `category` (optional): preference | decision | context | learning | reminder
- `expires_in` (optional): Expiration in hours
- `project_id` (optional): Associate with project

---

#### recall

Retrieve stored memory by key.

**Parameters:**

- `key` (required): Memory key

**Returns:** Stored value or null.

---

#### list_memories

List all memories with filtering.

**Parameters:**

- `category` (optional): Filter by category
- `project_id` (optional): Filter by project

**Returns:** Array of memory entries.

---

#### forget

Remove a specific memory.

**Parameters:**

- `key` (required): Memory key to forget

---

### Time Tracking

#### start_time_tracking

Start tracking time for a task.

**Parameters:**

- `task_id` (required): Task ID
- `project_id` (required): Project ID
- `notes` (optional): Notes about work

---

#### stop_time_tracking

Stop tracking and log duration.

**Parameters:**

- `notes` (optional): Completion notes

**Returns:** Time entry with duration.

---

#### get_time_stats

Get time statistics per project.

**Parameters:**

- `project_id` (optional): Project ID
- `period` (optional): day | week | month

**Returns:** Time statistics and breakdowns.

---

### AI Prompt Templates

#### list_prompt_templates

List available prompt templates.

**Returns:** Array of templates with descriptions.

Built-in templates:

- `prompt-plan`: Project Planning
- `prompt-debug`: Debugging Assistant
- `prompt-review`: Code Review
- `prompt-handoff`: AI Handoff
- `prompt-standup`: Daily Standup

---

#### generate_prompt

Generate filled prompt from template + project context.

**Parameters:**

- `template_id` (required): Template ID
- `project_id` (optional): Project for context
- `variables` (optional): Additional variables

**Returns:** Filled prompt ready for use.

---

### Multi-AI Export

#### export_claude_md

Export project context for AI assistants.

**Parameters:**

- `project_id` (optional): Project ID
- `format` (optional): minimal | standard | detailed
- `target` (optional): AI target format
  - `claude`: CLAUDE.md format (default)
  - `gemini`: GEMINI.md format
  - `chatgpt`: CHATGPT.md format
  - `cursor`: CURSOR.md format
  - `copilot`: COPILOT.md format
- `save_path` (optional): Path to save file

**Returns:** Formatted markdown content.

---

### Productivity Dashboard

#### get_daily_digest

Get daily productivity summary.

**Parameters:**

- `project_id` (optional): Filter by project

**Returns:** Tasks completed, time tracked, streak info, highlights.

---

#### get_productivity_stats

Get productivity statistics.

**Parameters:**

- `period` (required): day | week | month

**Returns:** Completion rates, time stats, trends, streaks.

---

## HTTP Endpoints

### Core

| Method | Endpoint        | Description           |
| ------ | --------------- | --------------------- |
| GET    | `/health`       | Health check          |
| GET    | `/openapi.json` | OpenAPI specification |

### Projects

| Method | Endpoint            | Description         |
| ------ | ------------------- | ------------------- |
| GET    | `/api/context`      | Read active project |
| PUT    | `/api/context`      | Update project      |
| GET    | `/api/projects`     | List projects       |
| POST   | `/api/projects`     | Create project      |
| GET    | `/api/projects/:id` | Get project         |
| DELETE | `/api/projects/:id` | Delete project      |
| POST   | `/api/active`       | Set active project  |
| POST   | `/api/clone`        | Clone a project     |

### Tasks

| Method | Endpoint                  | Description   |
| ------ | ------------------------- | ------------- |
| GET    | `/api/tasks`              | List tasks    |
| POST   | `/api/tasks`              | Add task      |
| PUT    | `/api/tasks/:id`          | Update task   |
| POST   | `/api/tasks/:id/complete` | Complete task |

### Notes & Analytics

| Method | Endpoint         | Description           |
| ------ | ---------------- | --------------------- |
| GET    | `/api/notes`     | List notes            |
| POST   | `/api/notes`     | Add note              |
| GET    | `/api/analytics` | Get project analytics |
| GET    | `/api/export`    | Export project        |

### Intelligent Features

| Method | Endpoint             | Description               |
| ------ | -------------------- | ------------------------- |
| GET    | `/api/critical-path` | Critical path analysis    |
| GET    | `/api/smart-queue`   | AI-prioritized task queue |
| GET    | `/api/compress`      | Token-efficient context   |
| GET    | `/api/health-score`  | Project health score      |
| POST   | `/api/batch`         | Batch operations          |
| GET    | `/api/suggestions`   | AI suggestions            |

### Webhooks & Events

| Method | Endpoint            | Description      |
| ------ | ------------------- | ---------------- |
| GET    | `/api/webhooks`     | List webhooks    |
| POST   | `/api/webhooks`     | Register webhook |
| DELETE | `/api/webhooks/:id` | Delete webhook   |

### Templates

| Method | Endpoint                | Description          |
| ------ | ----------------------- | -------------------- |
| GET    | `/api/templates`        | List templates       |
| POST   | `/api/templates/create` | Create from template |

### Version Control

| Method | Endpoint                     | Description      |
| ------ | ---------------------------- | ---------------- |
| GET    | `/api/snapshots`             | List snapshots   |
| POST   | `/api/snapshots`             | Create snapshot  |
| POST   | `/api/snapshots/:id/restore` | Restore snapshot |

### Audit Trail

| Method | Endpoint     | Description   |
| ------ | ------------ | ------------- |
| GET    | `/api/audit` | Get audit log |

### Productivity Features

| Method | Endpoint                           | Description            |
| ------ | ---------------------------------- | ---------------------- |
| GET    | `/api/personal-todos`              | List personal todos    |
| POST   | `/api/personal-todos`              | Add personal todo      |
| POST   | `/api/personal-todos/:id/complete` | Complete todo          |
| GET    | `/api/dids`                        | List completed items   |
| GET    | `/api/goals`                       | Get goals              |
| PUT    | `/api/goals`                       | Set goals              |
| GET    | `/api/memory`                      | List memories          |
| POST   | `/api/memory`                      | Remember something     |
| DELETE | `/api/memory`                      | Forget memory          |
| POST   | `/api/time-tracking/start`         | Start time tracking    |
| POST   | `/api/time-tracking/stop`          | Stop time tracking     |
| GET    | `/api/time-tracking/stats`         | Get time stats         |
| GET    | `/api/prompts`                     | List prompt templates  |
| POST   | `/api/prompts/generate`            | Generate filled prompt |
| GET    | `/api/export-md`                   | Export for AI          |
| GET    | `/api/digest`                      | Get daily digest       |
| GET    | `/api/productivity-stats`          | Get productivity stats |

---

## Example HTTP Calls

### Create Project

```bash
curl -X POST http://localhost:3210/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"My Project","description":"Building something"}'
```

### Add Task with Dependencies

```bash
curl -X POST http://localhost:3210/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Build UI","description":"Create components","dependencies":["task-123"]}'
```

### Get Smart Queue

```bash
curl "http://localhost:3210/api/smart-queue?limit=5"
```

### Create Snapshot

```bash
curl -X POST http://localhost:3210/api/snapshots \
  -H "Content-Type: application/json" \
  -d '{"name":"Before refactor","description":"Backup"}'
```

### Export for Different AIs

```bash
# For Claude
curl "http://localhost:3210/api/export-md?target=claude&format=detailed"

# For Gemini
curl "http://localhost:3210/api/export-md?target=gemini&format=standard"

# For ChatGPT
curl "http://localhost:3210/api/export-md?target=chatgpt&format=minimal"
```

### Personal Todo Workflow

```bash
# Add todo
curl -X POST http://localhost:3210/api/personal-todos \
  -H "Content-Type: application/json" \
  -d '{"content":"Review PR #42","priority":1,"tags":["code-review"]}'

# Complete with reflection
curl -X POST http://localhost:3210/api/personal-todos/todo-123/complete \
  -H "Content-Type: application/json" \
  -d '{"reflection":"Found 3 bugs, suggested fixes","duration":45}'

# View completed items
curl http://localhost:3210/api/dids
```

### Session Memory

```bash
# Remember preference
curl -X POST http://localhost:3210/api/memory \
  -H "Content-Type: application/json" \
  -d '{"key":"code_style","value":"functional","category":"preference"}'

# Recall later
curl "http://localhost:3210/api/memory?key=code_style"
```
