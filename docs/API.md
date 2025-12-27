# CortexFlow API Reference

## MCP Tools

### read_context
Read the active project context.

**Parameters:**
- `project_id` (optional): Specific project ID. Defaults to active project.
- `include_completed` (optional): Include completed tasks. Default: false.

**Returns:** Project metadata, tasks, notes, and phase.

---

### write_context
Create a new project.

**Parameters:**
- `name` (required): Project name
- `description` (required): Project description
- `phase` (optional): Initial phase. Default: "planning"
- `tags` (optional): Array of tags
- `tasks` (optional): Initial tasks array

---

### add_task
Add a task to the active project.

**Parameters:**
- `title` (required): Task title
- `description` (required): Task description
- `priority` (optional): 1-5, where 1 is highest
- `dependencies` (optional): Array of task IDs

---

### update_task
Update a task's status or add notes.

**Parameters:**
- `task_id` (required): Task ID
- `status` (optional): pending | in_progress | blocked | completed | cancelled
- `note` (optional): Note to add

---

### mark_task_complete
Mark a task as completed.

**Parameters:**
- `task_id` (required): Task ID
- `note` (optional): Completion note

---

### add_note
Add a note for other AI agents.

**Parameters:**
- `content` (required): Note content
- `agent` (optional): planner | executor | reviewer
- `category` (optional): general | decision | blocker | insight

---

### set_phase
Update project phase.

**Parameters:**
- `phase` (required): planning | execution | review | completed

---

### list_projects
List all projects.

**Returns:** Array of project summaries.

---

### set_active_project
Set the active project.

**Parameters:**
- `project_id` (required): Project ID to activate

---

### delete_project
Delete a project.

**Parameters:**
- `project_id` (required): Project ID to delete

---

## HTTP Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/openapi.json` | OpenAPI specification |
| GET | `/api/context` | Read active project |
| PUT | `/api/context` | Update project |
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project |
| DELETE | `/api/projects/:id` | Delete project |
| GET | `/api/tasks` | List tasks |
| POST | `/api/tasks` | Add task |
| PUT | `/api/tasks/:id` | Update task |
| POST | `/api/tasks/:id/complete` | Complete task |
| GET | `/api/notes` | List notes |
| POST | `/api/notes` | Add note |
| POST | `/api/active` | Set active project |

