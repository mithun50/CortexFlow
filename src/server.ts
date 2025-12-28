/**
 * CortexFlow - MCP Server Implementation
 *
 * Model Context Protocol server for AI-to-AI task continuation.
 * Provides tools for reading/writing shared project context.
 *
 * Transport: stdio (Claude Desktop compatible)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  Tool,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';

import { getStorage } from './storage.js';
import { getAdvancedStorage } from './advanced-storage.js';
import {
  analyzeCriticalPath,
  getSmartPriorityQueue,
  compressContext,
  getCompressionStats,
  calculateHealthScore,
  executeBatchOperations,
  generateTaskSuggestions,
  BatchOperation,
} from './intelligent-features.js';
import {
  addPersonalTodo,
  listPersonalTodos,
  completeTodo,
  listDids,
  setDailyGoals,
  setWeeklyGoals,
  getGoals,
  remember,
  recall,
  listMemories,
  forget,
  forgetAll,
  startTimeTracking,
  stopTimeTracking,
  getActiveTimeEntry,
  getTimeEntries,
  getTimeStats,
  listPromptTemplates,
  getPromptTemplate,
  generatePromptFromContext,
  generateClaudeMd,
  saveClaudeMd,
  getDailyDigest,
  getProductivityStats,
} from './productivity-features.js';
import {
  indexDocument,
  indexProjectContext,
  search,
  buildContextFromSearch,
  deleteDocument as deleteRAGDocument,
  listDocuments,
  getRAGStats,
  getRAGConfig,
  updateRAGConfig,
} from './rag/index.js';
import { resetEmbeddingProvider } from './rag/embeddings.js';
import {
  ProjectContext,
  Phase,
  TaskStatus,
  AgentRole,
  EventType,
  AuditAction,
  EmbeddingProvider,
  ChunkingStrategy,
  createProject,
  addTask,
  addNote,
  updateTaskStatus,
  updateTaskNote,
  setPhase,
  getTask,
  getProjectSummary,
  getProjectAnalytics,
  exportToMarkdown,
  cloneProject,
  createWebhook,
  createSnapshot,
  createAuditEntry,
  createProjectFromTemplate,
  restoreFromSnapshot,
} from './models.js';

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS: Tool[] = [
  // Context Management
  {
    name: 'read_context',
    description: `Read the current shared project context. Returns project metadata, tasks, notes, and current phase.

Use this to understand:
- What the project is about
- Current phase (planning/execution/review)
- All tasks and their statuses
- Notes from other AI agents (ChatGPT planner notes)

Call this first when continuing work on a project.`,
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID. If omitted, reads the active project.',
        },
        include_completed: {
          type: 'boolean',
          description: 'Include completed tasks in response. Default: false',
        },
      },
    },
  },
  {
    name: 'write_context',
    description: `Create a new project context or completely overwrite an existing one.

Use this to:
- Start a new project (ChatGPT planning phase)
- Define project goals and initial task list
- Set project metadata

Typically used by the Planner (ChatGPT) to initialize a project.`,
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Project name',
        },
        description: {
          type: 'string',
          description: 'Project description and goals',
        },
        phase: {
          type: 'string',
          enum: ['planning', 'execution', 'review', 'completed'],
          description: 'Initial project phase. Default: planning',
        },
        tasks: {
          type: 'array',
          description: 'Initial tasks to create',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              priority: { type: 'number', minimum: 1, maximum: 5 },
            },
            required: ['title', 'description'],
          },
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Project tags for categorization',
        },
      },
      required: ['name', 'description'],
    },
  },

  // Task Management
  {
    name: 'add_task',
    description: `Add a new task to the active project.

Use this to:
- Add tasks discovered during execution
- Break down work into smaller pieces
- Add tasks identified during review`,
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Task title',
        },
        description: {
          type: 'string',
          description: 'Detailed task description',
        },
        priority: {
          type: 'number',
          minimum: 1,
          maximum: 5,
          description: 'Priority (1=highest, 5=lowest). Default: 1',
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Task IDs this task depends on',
        },
      },
      required: ['title', 'description'],
    },
  },
  {
    name: 'update_task',
    description: `Update a task's status or add notes to it.

Use this to:
- Mark task as in_progress when starting work
- Add implementation notes or findings
- Record blockers or issues`,
    inputSchema: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'Task ID to update',
        },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'blocked', 'completed', 'cancelled'],
          description: 'New task status',
        },
        note: {
          type: 'string',
          description: 'Note to add to the task',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'mark_task_complete',
    description: `Mark a task as completed with an optional completion note.

Use this when:
- Task implementation is finished
- Task has been verified/tested
- Task is no longer needed (will be cancelled instead)`,
    inputSchema: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'Task ID to complete',
        },
        note: {
          type: 'string',
          description: 'Completion note (what was done, results, etc.)',
        },
      },
      required: ['task_id'],
    },
  },

  // Notes and Communication
  {
    name: 'add_note',
    description: `Add a note to the project from an AI agent.

Use this to:
- Document decisions and rationale
- Record blockers or issues for the other AI
- Share insights or findings
- Leave instructions for the next agent

Categories:
- general: General observations
- decision: Design/architecture decisions
- blocker: Issues preventing progress
- insight: Discoveries or learnings`,
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Note content',
        },
        agent: {
          type: 'string',
          enum: ['planner', 'executor', 'reviewer'],
          description: 'Agent role adding the note. Default: executor (Claude)',
        },
        category: {
          type: 'string',
          enum: ['general', 'decision', 'blocker', 'insight'],
          description: 'Note category. Default: general',
        },
      },
      required: ['content'],
    },
  },

  // Phase Management
  {
    name: 'set_phase',
    description: `Update the project phase.

Phases:
- planning: Initial design and task creation (ChatGPT)
- execution: Implementation in progress (Claude)
- review: Validation and testing
- completed: Project finished`,
    inputSchema: {
      type: 'object',
      properties: {
        phase: {
          type: 'string',
          enum: ['planning', 'execution', 'review', 'completed'],
          description: 'New project phase',
        },
      },
      required: ['phase'],
    },
  },

  // Project Management
  {
    name: 'list_projects',
    description: 'List all projects in the CortexFlow storage.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'set_active_project',
    description: 'Set a project as the active project for subsequent operations.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID to set as active',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'delete_project',
    description: 'Delete a project from storage.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID to delete',
        },
      },
      required: ['project_id'],
    },
  },

  // Analytics & Export (Unique Features)
  {
    name: 'get_analytics',
    description: `Get detailed analytics for a project.

Returns:
- Task completion rate and statistics
- Per-agent performance metrics (tasks completed, notes added)
- Average task duration
- Blocker and decision counts
- Phase history

Use this to understand project health and agent productivity.`,
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID. If omitted, uses active project.',
        },
      },
    },
  },
  {
    name: 'export_project',
    description: `Export a project to Markdown format.

Creates a human-readable document with:
- Project metadata and description
- All tasks with status, priority, and notes
- Agent notes with categories and timestamps

Useful for documentation, sharing, or archival.`,
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID. If omitted, uses active project.',
        },
      },
    },
  },
  {
    name: 'clone_project',
    description: `Clone an existing project with optional reset options.

Use this to:
- Create a template from a successful project
- Start fresh with the same task structure
- Create variations of a project

Options:
- reset_tasks: Reset all tasks to pending (default: true)
- reset_notes: Clear all notes (default: true)`,
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID to clone. If omitted, uses active project.',
        },
        new_name: {
          type: 'string',
          description: 'Name for the cloned project',
        },
        reset_tasks: {
          type: 'boolean',
          description: 'Reset all tasks to pending status. Default: true',
        },
        reset_notes: {
          type: 'boolean',
          description: 'Clear all notes from clone. Default: true',
        },
      },
      required: ['new_name'],
    },
  },

  // ============================================================================
  // Webhook Tools
  // ============================================================================
  {
    name: 'register_webhook',
    description: `Register a webhook to receive event notifications.

Events you can subscribe to:
- project.created, project.updated, project.deleted
- phase.changed
- task.created, task.updated, task.completed, task.blocked
- note.added, blocker.added
- snapshot.created

Webhooks receive POST requests with event data.`,
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Webhook URL to receive POST requests',
        },
        events: {
          type: 'array',
          items: { type: 'string' },
          description: 'Event types to subscribe to',
        },
        secret: {
          type: 'string',
          description: 'Optional secret for HMAC signature verification',
        },
      },
      required: ['url', 'events'],
    },
  },
  {
    name: 'list_webhooks',
    description: 'List all registered webhooks.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'delete_webhook',
    description: 'Delete a registered webhook.',
    inputSchema: {
      type: 'object',
      properties: {
        webhook_id: {
          type: 'string',
          description: 'Webhook ID to delete',
        },
      },
      required: ['webhook_id'],
    },
  },

  // ============================================================================
  // Template Tools
  // ============================================================================
  {
    name: 'list_templates',
    description: `List available project templates.

Built-in templates:
- bug-fix: Standard bug fix workflow
- feature: Full feature development workflow
- refactor: Safe refactoring workflow
- review: Code review workflow`,
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by category (bug-fix, feature, refactor, review, custom)',
        },
      },
    },
  },
  {
    name: 'create_from_template',
    description: `Create a new project from a template.

Use list_templates to see available templates.`,
    inputSchema: {
      type: 'object',
      properties: {
        template_id: {
          type: 'string',
          description: 'Template ID to use (e.g., tpl-bugfix, tpl-feature)',
        },
        project_name: {
          type: 'string',
          description: 'Name for the new project',
        },
        project_description: {
          type: 'string',
          description: 'Optional description (uses template description if omitted)',
        },
      },
      required: ['template_id', 'project_name'],
    },
  },

  // ============================================================================
  // Snapshot Tools (Version Control)
  // ============================================================================
  {
    name: 'create_snapshot',
    description: `Create a snapshot of the current project state.

Use this to:
- Save state before risky operations
- Create checkpoints for rollback
- Document project milestones`,
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Human-readable snapshot name',
        },
        description: {
          type: 'string',
          description: 'Description of what this snapshot captures',
        },
        project_id: {
          type: 'string',
          description: 'Project ID. If omitted, uses active project.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_snapshots',
    description: 'List all snapshots for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID. If omitted, uses active project.',
        },
      },
    },
  },
  {
    name: 'restore_snapshot',
    description: `Restore a project to a previous snapshot state.

WARNING: This will overwrite the current project state.`,
    inputSchema: {
      type: 'object',
      properties: {
        snapshot_id: {
          type: 'string',
          description: 'Snapshot ID to restore',
        },
      },
      required: ['snapshot_id'],
    },
  },

  // ============================================================================
  // Audit Tools
  // ============================================================================
  {
    name: 'get_audit_log',
    description: `Get the audit log showing all changes to a project.

Tracks:
- Who made changes (which agent)
- What was changed (tasks, notes, phase)
- When changes occurred`,
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID. If omitted, uses active project.',
        },
        limit: {
          type: 'number',
          description: 'Maximum entries to return. Default: 50',
        },
        since: {
          type: 'string',
          description: 'ISO timestamp to filter entries after',
        },
      },
    },
  },

  // ============================================================================
  // Intelligent Features
  // ============================================================================
  {
    name: 'get_critical_path',
    description: `Analyze task dependencies and find the critical path.

Returns:
- Critical path (longest dependency chain)
- Parallelizable task groups
- Blocked and ready tasks
- Estimated completion metrics

Use this for intelligent task scheduling and bottleneck identification.`,
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID. If omitted, uses active project.',
        },
      },
    },
  },
  {
    name: 'get_smart_queue',
    description: `Get recommended next tasks using intelligent priority scoring.

Factors considered:
- Critical path priority
- Dependency unblocking potential
- Task age and priority
- Impact on overall progress

Returns tasks in optimal execution order.`,
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID. If omitted, uses active project.',
        },
        limit: {
          type: 'number',
          description: 'Max tasks to return. Default: 5',
        },
      },
    },
  },
  {
    name: 'compress_context',
    description: `Get a token-efficient compressed representation of the project.

Reduces context size by 40-60% while preserving essential information.
Ideal for:
- Passing context between AI agents
- Reducing token usage in prompts
- Efficient context serialization`,
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID. If omitted, uses active project.',
        },
        include_completed: {
          type: 'boolean',
          description: 'Include completed tasks. Default: false',
        },
        max_notes: {
          type: 'number',
          description: 'Max notes to include. Default: 10',
        },
      },
    },
  },
  {
    name: 'get_health_score',
    description: `Get comprehensive project health score and risk analysis.

Analyzes:
- Velocity and completion rate
- Blocker ratio
- Dependency health (circular deps, orphans)
- Progress rate
- Staleness and activity
- Documentation quality

Returns 0-100 score with breakdown, risks, and recommendations.`,
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID. If omitted, uses active project.',
        },
      },
    },
  },
  {
    name: 'batch_operations',
    description: `Execute multiple operations atomically in a single call.

Supported operations:
- create_task: { title, description, options }
- update_task: { taskId, updates }
- delete_task: { taskId }
- add_note: { agent, content, category }
- update_status: { taskId, status }

All operations succeed or all fail together.`,
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID. If omitted, uses active project.',
        },
        operations: {
          type: 'array',
          description: 'Array of operations to execute',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['create_task', 'update_task', 'delete_task', 'add_note', 'update_status'],
              },
              payload: {
                type: 'object',
              },
            },
            required: ['type', 'payload'],
          },
        },
      },
      required: ['operations'],
    },
  },
  {
    name: 'get_suggestions',
    description: `Get intelligent task suggestions based on project state.

Analyzes project and suggests:
- Actions to unblock tasks
- Documentation improvements
- Phase transitions
- Optimization opportunities

AI-powered recommendations for project health.`,
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID. If omitted, uses active project.',
        },
      },
    },
  },

  // ============================================================================
  // Personal Todo/Did List Tools
  // ============================================================================
  {
    name: 'add_personal_todo',
    description: `Add a personal todo item (separate from project tasks).

Personal todos are for your own task tracking across projects.
Use for reminders, personal goals, or cross-project tasks.`,
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Todo content/description',
        },
        priority: {
          type: 'number',
          description: 'Priority 1-5 (1=highest). Default: 3',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization',
        },
        due_date: {
          type: 'string',
          description: 'Due date in ISO format',
        },
        context: {
          type: 'string',
          description: 'Related project or context',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'list_personal_todos',
    description: 'List personal todo items with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        tag: {
          type: 'string',
          description: 'Filter by tag',
        },
        priority: {
          type: 'number',
          description: 'Filter by priority level',
        },
      },
    },
  },
  {
    name: 'complete_personal_todo',
    description: `Mark a personal todo as completed. Moves it to "did" list.

Optionally add reflection on what you learned or how long it took.`,
    inputSchema: {
      type: 'object',
      properties: {
        todo_id: {
          type: 'string',
          description: 'Todo ID to complete',
        },
        reflection: {
          type: 'string',
          description: 'What did you learn? Any insights?',
        },
        duration: {
          type: 'number',
          description: 'How long it took (minutes)',
        },
      },
      required: ['todo_id'],
    },
  },
  {
    name: 'list_dids',
    description: `List completed items ("did" list). Track your accomplishments.

Shows what you've completed with optional filtering.`,
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Max items to return. Default: 20',
        },
        since: {
          type: 'string',
          description: 'Only items completed after this date (ISO)',
        },
        tag: {
          type: 'string',
          description: 'Filter by tag',
        },
      },
    },
  },
  {
    name: 'set_goals',
    description: 'Set daily or weekly goals for personal tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        daily: {
          type: 'array',
          items: { type: 'string' },
          description: 'Daily goals',
        },
        weekly: {
          type: 'array',
          items: { type: 'string' },
          description: 'Weekly goals',
        },
      },
    },
  },
  {
    name: 'get_goals',
    description: 'Get current daily and weekly goals.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ============================================================================
  // Session Memory Tools
  // ============================================================================
  {
    name: 'remember',
    description: `Store something in session memory for later recall.

Categories:
- preference: User preferences
- decision: Important decisions made
- context: Contextual information
- learning: Insights learned
- reminder: Things to remember

Memory persists across sessions.`,
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Memory key for retrieval',
        },
        value: {
          type: 'string',
          description: 'Value to remember',
        },
        category: {
          type: 'string',
          enum: ['preference', 'decision', 'context', 'learning', 'reminder'],
          description: 'Memory category. Default: context',
        },
        expires_in: {
          type: 'number',
          description: 'Hours until memory expires (optional)',
        },
        project_id: {
          type: 'string',
          description: 'Link to specific project (optional)',
        },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'recall',
    description: 'Recall a previously stored memory by key.',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Memory key to recall',
        },
      },
      required: ['key'],
    },
  },
  {
    name: 'list_memories',
    description: 'List all stored memories with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['preference', 'decision', 'context', 'learning', 'reminder'],
          description: 'Filter by category',
        },
        project_id: {
          type: 'string',
          description: 'Filter by project',
        },
      },
    },
  },
  {
    name: 'forget',
    description: 'Remove a specific memory by key.',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Memory key to forget',
        },
      },
      required: ['key'],
    },
  },

  // ============================================================================
  // Time Tracking Tools
  // ============================================================================
  {
    name: 'start_time_tracking',
    description: `Start tracking time for a task.

Only one task can be tracked at a time.
Previous tracking is automatically stopped.`,
    inputSchema: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'Task ID to track',
        },
        project_id: {
          type: 'string',
          description: 'Project ID',
        },
        notes: {
          type: 'string',
          description: "Notes about what you're working on",
        },
      },
      required: ['task_id', 'project_id'],
    },
  },
  {
    name: 'stop_time_tracking',
    description: 'Stop current time tracking and log the entry.',
    inputSchema: {
      type: 'object',
      properties: {
        notes: {
          type: 'string',
          description: 'Notes about what was accomplished',
        },
      },
    },
  },
  {
    name: 'get_time_stats',
    description: 'Get time tracking statistics for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID to analyze',
        },
      },
      required: ['project_id'],
    },
  },

  // ============================================================================
  // Prompt Template Tools
  // ============================================================================
  {
    name: 'list_prompt_templates',
    description: `List available AI prompt templates.

Categories: planning, coding, debugging, review, documentation, custom`,
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by category',
        },
      },
    },
  },
  {
    name: 'generate_prompt',
    description: `Generate a filled prompt from a template using project context.

Templates auto-fill with project data like task counts, phase, etc.`,
    inputSchema: {
      type: 'object',
      properties: {
        template_id: {
          type: 'string',
          description: 'Template ID to use',
        },
        project_id: {
          type: 'string',
          description: 'Project ID for context. Default: active project',
        },
      },
      required: ['template_id'],
    },
  },

  // ============================================================================
  // CLAUDE.md Export Tools
  // ============================================================================
  {
    name: 'export_claude_md',
    description: `Export project context for AI assistants.

Supports multiple AI targets:
- claude: CLAUDE.md format (default)
- gemini: GEMINI.md format
- chatgpt: CHATGPT.md format
- cursor: CURSOR.md format
- copilot: COPILOT.md format

Formats:
- minimal: Just essentials (name, tasks, status)
- standard: Balanced detail (default)
- detailed: Everything including full history

Save in project root for automatic context loading.`,
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID. Default: active project',
        },
        format: {
          type: 'string',
          enum: ['minimal', 'standard', 'detailed'],
          description: 'Export format. Default: standard',
        },
        target: {
          type: 'string',
          enum: ['claude', 'gemini', 'chatgpt', 'cursor', 'copilot'],
          description: 'Target AI assistant. Default: claude',
        },
        save_path: {
          type: 'string',
          description: 'File path to save. If omitted, returns content only.',
        },
      },
    },
  },

  // ============================================================================
  // Productivity Dashboard Tools
  // ============================================================================
  {
    name: 'get_daily_digest',
    description: `Get a daily productivity digest.

Includes:
- Todo and did counts
- Upcoming deadlines
- Recent completions
- Goals status
- Time tracked today
- Active reminders`,
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Focus on specific project (optional)',
        },
      },
    },
  },
  {
    name: 'get_productivity_stats',
    description: `Get productivity statistics over time.

Shows:
- Tasks completed
- Average completion time
- Top tags
- Streak days
- Total time tracked`,
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['day', 'week', 'month'],
          description: 'Time period. Default: week',
        },
      },
    },
  },

  // ============================================================================
  // RAG (Retrieval-Augmented Generation) Tools
  // ============================================================================
  {
    name: 'rag_index_document',
    description: `Index a custom document for semantic search.

Use this to add external documents, notes, or any text content to the RAG system.
Documents are chunked and embedded for later retrieval.

Returns the indexed document with chunk count.`,
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Document title for identification',
        },
        content: {
          type: 'string',
          description: 'Full text content to index',
        },
        project_id: {
          type: 'string',
          description: 'Associate with specific project (optional)',
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata to store with document',
        },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'rag_index_project',
    description: `Index an entire project context for semantic search.

Indexes the project description, all tasks, and significant notes.
Useful for making project knowledge searchable.

Returns count of documents and chunks created.`,
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID to index. Uses active project if omitted.',
        },
      },
    },
  },
  {
    name: 'rag_search',
    description: `Search indexed documents using semantic, keyword, or hybrid search.

Search types:
- vector: Pure semantic search using embeddings
- keyword: Full-text keyword search
- hybrid: Combined vector + keyword (default, best results)

Returns ranked results with relevance scores.`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query text',
        },
        project_id: {
          type: 'string',
          description: 'Limit search to specific project (optional)',
        },
        search_type: {
          type: 'string',
          enum: ['vector', 'keyword', 'hybrid'],
          description: 'Search method. Default: hybrid',
        },
        top_k: {
          type: 'number',
          description: 'Number of results to return. Default: 5',
        },
        min_score: {
          type: 'number',
          description: 'Minimum relevance score (0-1). Default: 0.3',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'rag_query_context',
    description: `Get formatted context for prompts based on a query.

Performs semantic search and formats results into a context string
suitable for including in LLM prompts.

Returns context string and source references.`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Query to find relevant context for',
        },
        project_id: {
          type: 'string',
          description: 'Limit to specific project (optional)',
        },
        max_context_length: {
          type: 'number',
          description: 'Maximum context length in characters. Default: 4000',
        },
        include_metadata: {
          type: 'boolean',
          description: 'Include document metadata in context. Default: true',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'rag_list_documents',
    description: `List all indexed documents.

Shows document titles, source types, chunk counts, and project associations.
Useful for understanding what content is available for search.`,
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Filter by project (optional)',
        },
        source_type: {
          type: 'string',
          enum: ['project_context', 'task', 'note', 'custom_document'],
          description: 'Filter by source type (optional)',
        },
        limit: {
          type: 'number',
          description: 'Maximum documents to return. Default: 50',
        },
      },
    },
  },
  {
    name: 'rag_delete_document',
    description: `Delete an indexed document and its chunks.

Removes the document from the search index.
Use rag_list_documents to find document IDs.`,
    inputSchema: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Document ID to delete',
        },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'rag_get_stats',
    description: `Get RAG system statistics.

Shows:
- Total documents and chunks
- Indexed vs unindexed chunks
- Documents per project
- Embedding provider and dimensions`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'rag_configure',
    description: `Configure RAG system settings.

Configure embedding provider, chunking strategy, and search parameters.
Changes take effect for new indexing operations.

Embedding providers: local, openai, voyage, cohere, custom
Chunking strategies: paragraph, sentence, fixed, semantic`,
    inputSchema: {
      type: 'object',
      properties: {
        embedding: {
          type: 'object',
          description: 'Embedding configuration',
          properties: {
            provider: {
              type: 'string',
              enum: ['local', 'openai', 'voyage', 'cohere', 'custom'],
              description: 'Embedding provider',
            },
            model: {
              type: 'string',
              description: 'Model name (provider-specific)',
            },
            api_key: {
              type: 'string',
              description: 'API key for cloud providers',
            },
            api_endpoint: {
              type: 'string',
              description: 'Custom API endpoint URL',
            },
          },
        },
        chunking: {
          type: 'object',
          description: 'Chunking configuration',
          properties: {
            strategy: {
              type: 'string',
              enum: ['paragraph', 'sentence', 'fixed', 'semantic'],
              description: 'Chunking strategy',
            },
            chunk_size: {
              type: 'number',
              description: 'Target chunk size in characters',
            },
            chunk_overlap: {
              type: 'number',
              description: 'Overlap between chunks',
            },
          },
        },
        search: {
          type: 'object',
          description: 'Search configuration',
          properties: {
            top_k: {
              type: 'number',
              description: 'Default number of results',
            },
            min_score: {
              type: 'number',
              description: 'Default minimum score',
            },
            hybrid_vector_weight: {
              type: 'number',
              description: 'Vector weight in hybrid search (0-1)',
            },
          },
        },
      },
    },
  },
];

// ============================================================================
// Tool Handlers
// ============================================================================

type ToolResult = { content: TextContent[]; isError?: boolean };

function success(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

function error(text: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${text}` }], isError: true };
}

async function handleReadContext(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  const projectId = args.project_id as string | undefined;
  const includeCompleted = args.include_completed as boolean | undefined;

  let context: ProjectContext | null;
  if (projectId) {
    context = await storage.loadProject(projectId);
  } else {
    context = await storage.getActiveProject();
  }

  if (!context) {
    return error('No project found. Create one with write_context or set an active project.');
  }

  // Filter tasks if needed
  let tasks = context.tasks;
  if (!includeCompleted) {
    tasks = tasks.filter((t) => t.status !== TaskStatus.COMPLETED);
  }

  const summary = getProjectSummary(context);
  const taskList = tasks
    .map((t) => `  [${t.id}] ${t.status.toUpperCase()}: ${t.title}\n      ${t.description}`)
    .join('\n');
  const noteList = context.notes
    .slice(-10) // Last 10 notes
    .map((n) => `  [${n.agent}/${n.category}] ${n.content}`)
    .join('\n');

  return success(`${summary}

Tasks:
${taskList || '  (none)'}

Recent Notes:
${noteList || '  (none)'}`);
}

async function handleWriteContext(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();

  const name = args.name as string;
  const description = args.description as string;
  const phase = (args.phase as Phase) || Phase.PLANNING;
  const tags = (args.tags as string[]) || [];

  let context = createProject(name, description, { phase, tags });

  // Add initial tasks if provided
  const tasksInput = args.tasks as
    | Array<{ title: string; description: string; priority?: number }>
    | undefined;
  if (tasksInput) {
    for (const t of tasksInput) {
      const result = addTask(context, t.title, t.description, {
        priority: t.priority,
        assignedTo: AgentRole.EXECUTOR,
      });
      context = result.context;
    }
  }

  await storage.saveProject(context);
  await storage.setActiveProject(context.id);

  return success(`Project created: ${context.name} (ID: ${context.id})
Phase: ${context.phase}
Tasks: ${context.tasks.length}

Project is now active.`);
}

async function handleAddTask(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  let context = await storage.getActiveProject();

  if (!context) {
    return error('No active project. Create one with write_context first.');
  }

  const title = args.title as string;
  const description = args.description as string;
  const priority = (args.priority as number) || 1;
  const dependencies = (args.dependencies as string[]) || [];

  const result = addTask(context, title, description, {
    priority,
    dependencies,
    assignedTo: AgentRole.EXECUTOR,
  });
  context = result.context;

  await storage.saveProject(context);

  return success(`Task added: ${result.task.title} (ID: ${result.task.id})`);
}

async function handleUpdateTask(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  let context = await storage.getActiveProject();

  if (!context) {
    return error('No active project.');
  }

  const taskId = args.task_id as string;
  const status = args.status as TaskStatus | undefined;
  const note = args.note as string | undefined;

  const task = getTask(context, taskId);
  if (!task) {
    return error(`Task not found: ${taskId}`);
  }

  if (status) {
    context = updateTaskStatus(context, taskId, status);
  }
  if (note) {
    context = updateTaskNote(context, taskId, note);
  }

  await storage.saveProject(context);

  const updatedTask = getTask(context, taskId)!;
  return success(`Task updated: ${updatedTask.title}
Status: ${updatedTask.status}
Notes: ${updatedTask.notes.length}`);
}

async function handleMarkTaskComplete(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  let context = await storage.getActiveProject();

  if (!context) {
    return error('No active project.');
  }

  const taskId = args.task_id as string;
  const note = args.note as string | undefined;

  const task = getTask(context, taskId);
  if (!task) {
    return error(`Task not found: ${taskId}`);
  }

  if (note) {
    context = updateTaskNote(context, taskId, note);
  }
  context = updateTaskStatus(context, taskId, TaskStatus.COMPLETED);

  await storage.saveProject(context);

  return success(`Task completed: ${task.title}`);
}

async function handleAddNote(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  let context = await storage.getActiveProject();

  if (!context) {
    return error('No active project.');
  }

  const content = args.content as string;
  const agent = (args.agent as AgentRole) || AgentRole.EXECUTOR;
  const category = (args.category as 'general' | 'decision' | 'blocker' | 'insight') || 'general';

  const result = addNote(context, agent, content, category);
  context = result.context;

  await storage.saveProject(context);

  return success(`Note added by ${agent}: ${content.slice(0, 50)}...`);
}

async function handleSetPhase(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  let context = await storage.getActiveProject();

  if (!context) {
    return error('No active project.');
  }

  const phase = args.phase as Phase;
  context = setPhase(context, phase);

  await storage.saveProject(context);

  return success(`Project phase updated to: ${phase}`);
}

async function handleListProjects(): Promise<ToolResult> {
  const storage = await getStorage();
  const projects = await storage.listProjects();
  const activeId = await storage.getActiveProjectId();

  if (projects.length === 0) {
    return success('No projects found. Create one with write_context.');
  }

  const list = projects
    .map((p) => {
      const active = p.id === activeId ? ' (ACTIVE)' : '';
      const completed = p.tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
      return `  [${p.id}] ${p.name}${active}
      Phase: ${p.phase} | Tasks: ${completed}/${p.tasks.length} | Updated: ${p.updatedAt}`;
    })
    .join('\n');

  return success(`Projects:\n${list}`);
}

async function handleSetActiveProject(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  const projectId = args.project_id as string;

  const project = await storage.loadProject(projectId);
  if (!project) {
    return error(`Project not found: ${projectId}`);
  }

  await storage.setActiveProject(projectId);

  return success(`Active project set to: ${project.name} (${projectId})`);
}

async function handleDeleteProject(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  const projectId = args.project_id as string;

  const deleted = await storage.deleteProject(projectId);
  if (!deleted) {
    return error(`Project not found: ${projectId}`);
  }

  return success(`Project deleted: ${projectId}`);
}

async function handleGetAnalytics(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  const projectId = args.project_id as string | undefined;

  let context: ProjectContext | null;
  if (projectId) {
    context = await storage.loadProject(projectId);
  } else {
    context = await storage.getActiveProject();
  }

  if (!context) {
    return error('No project found. Create one with write_context or set an active project.');
  }

  const analytics = getProjectAnalytics(context);

  const agentStatsStr = analytics.agentStats
    .filter((s) => s.tasksCompleted > 0 || s.tasksInProgress > 0 || s.notesAdded > 0)
    .map(
      (s) =>
        `  ${s.agent}: ${s.tasksCompleted} completed, ${s.tasksInProgress} in progress, ${s.notesAdded} notes`
    )
    .join('\n');

  const durationStr = analytics.avgTaskDuration
    ? `${Math.round(analytics.avgTaskDuration / 1000 / 60)} minutes`
    : 'N/A';

  return success(`📊 Project Analytics: ${analytics.projectName}

Task Statistics:
  Total: ${analytics.totalTasks}
  Completed: ${analytics.completedTasks} (${analytics.completionRate.toFixed(1)}%)
  Pending: ${analytics.pendingTasks}
  Blocked: ${analytics.blockedTasks}

Agent Performance:
${agentStatsStr || '  (no agent activity yet)'}

Metrics:
  Average Task Duration: ${durationStr}
  Blockers Recorded: ${analytics.blockerCount}
  Decisions Made: ${analytics.decisionCount}
  Current Phase: ${context.phase}`);
}

async function handleExportProject(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  const projectId = args.project_id as string | undefined;

  let context: ProjectContext | null;
  if (projectId) {
    context = await storage.loadProject(projectId);
  } else {
    context = await storage.getActiveProject();
  }

  if (!context) {
    return error('No project found. Create one with write_context or set an active project.');
  }

  const markdown = exportToMarkdown(context);

  return success(markdown);
}

async function handleCloneProject(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  const projectId = args.project_id as string | undefined;
  const newName = args.new_name as string;
  const resetTasks = (args.reset_tasks as boolean) ?? true;
  const resetNotes = (args.reset_notes as boolean) ?? true;

  let context: ProjectContext | null;
  if (projectId) {
    context = await storage.loadProject(projectId);
  } else {
    context = await storage.getActiveProject();
  }

  if (!context) {
    return error('No project found. Create one with write_context or set an active project.');
  }

  const cloned = cloneProject(context, newName, {
    resetTasks: !resetTasks, // cloneProject uses inverse logic (resetTasks=false means keep structure)
    resetNotes,
  });

  await storage.saveProject(cloned);

  return success(`Project cloned: ${cloned.name} (ID: ${cloned.id})
Original: ${context.name} (${context.id})
Tasks: ${cloned.tasks.length}${resetTasks ? ' (reset to pending)' : ''}
Notes: ${cloned.notes.length}${resetNotes ? ' (cleared)' : ''}`);
}

// ============================================================================
// Webhook Handlers
// ============================================================================

async function handleRegisterWebhook(args: Record<string, unknown>): Promise<ToolResult> {
  const advanced = await getAdvancedStorage();
  const url = args.url as string;
  const events = args.events as string[];
  const secret = args.secret as string | undefined;

  // Validate events
  const validEvents = Object.values(EventType);
  const invalidEvents = events.filter((e) => !validEvents.includes(e as EventType));
  if (invalidEvents.length > 0) {
    return error(`Invalid event types: ${invalidEvents.join(', ')}`);
  }

  const webhook = createWebhook(url, events as EventType[], { secret });
  await advanced.webhooks.saveWebhook(webhook);

  return success(`Webhook registered: ${webhook.id}
URL: ${url}
Events: ${events.join(', ')}`);
}

async function handleListWebhooks(): Promise<ToolResult> {
  const advanced = await getAdvancedStorage();
  const webhooks = await advanced.webhooks.listWebhooks();

  if (webhooks.length === 0) {
    return success('No webhooks registered.');
  }

  const list = webhooks
    .map((w) => {
      const status = w.active ? '✓ Active' : '✗ Disabled';
      return `[${w.id}] ${status}
  URL: ${w.url}
  Events: ${w.events.join(', ')}
  Failures: ${w.failureCount}`;
    })
    .join('\n\n');

  return success(`Webhooks:\n\n${list}`);
}

async function handleDeleteWebhook(args: Record<string, unknown>): Promise<ToolResult> {
  const advanced = await getAdvancedStorage();
  const webhookId = args.webhook_id as string;

  const deleted = await advanced.webhooks.deleteWebhook(webhookId);
  if (!deleted) {
    return error(`Webhook not found: ${webhookId}`);
  }

  return success(`Webhook deleted: ${webhookId}`);
}

// ============================================================================
// Template Handlers
// ============================================================================

async function handleListTemplates(args: Record<string, unknown>): Promise<ToolResult> {
  const advanced = await getAdvancedStorage();
  const category = args.category as string | undefined;

  let templates = await advanced.templates.listTemplates();
  if (category) {
    templates = templates.filter((t) => t.category === category);
  }

  if (templates.length === 0) {
    return success('No templates found.');
  }

  const list = templates
    .map((t) => {
      const tasks = t.tasks.length;
      return `[${t.id}] ${t.name}
  Category: ${t.category}
  Tasks: ${tasks}
  ${t.description}`;
    })
    .join('\n\n');

  return success(`Templates:\n\n${list}`);
}

async function handleCreateFromTemplate(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  const advanced = await getAdvancedStorage();

  const templateId = args.template_id as string;
  const projectName = args.project_name as string;
  const projectDescription = args.project_description as string | undefined;

  const template = await advanced.templates.getTemplate(templateId);
  if (!template) {
    return error(`Template not found: ${templateId}`);
  }

  const project = createProjectFromTemplate(template, projectName, projectDescription);
  await storage.saveProject(project);
  await storage.setActiveProject(project.id);

  // Track template usage
  await advanced.templates.incrementUsage(templateId);

  // Emit event
  await advanced.events.emitEvent(EventType.PROJECT_CREATED, project.id, {
    name: project.name,
    template: templateId,
  });

  return success(`Project created from template: ${project.name} (ID: ${project.id})
Template: ${template.name}
Tasks: ${project.tasks.length}
Phase: ${project.phase}

Project is now active.`);
}

// ============================================================================
// Snapshot Handlers
// ============================================================================

async function handleCreateSnapshot(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  const advanced = await getAdvancedStorage();

  const name = args.name as string;
  const description = (args.description as string) ?? '';
  const projectId = args.project_id as string | undefined;

  let context: ProjectContext | null;
  if (projectId) {
    context = await storage.loadProject(projectId);
  } else {
    context = await storage.getActiveProject();
  }

  if (!context) {
    return error('No project found. Create one with write_context or set an active project.');
  }

  const snapshot = createSnapshot(context, name, description, AgentRole.EXECUTOR);
  await advanced.snapshots.saveSnapshot(snapshot);

  // Emit event
  await advanced.events.emitEvent(EventType.SNAPSHOT_CREATED, context.id, {
    snapshotId: snapshot.id,
    name: snapshot.name,
  });

  // Add audit entry
  const auditEntry = createAuditEntry(
    context.id,
    AuditAction.CREATE,
    'snapshot',
    snapshot.id,
    AgentRole.EXECUTOR,
    [{ field: 'snapshot', oldValue: null, newValue: snapshot.name }]
  );
  await advanced.audit.addEntry(auditEntry);

  return success(`Snapshot created: ${snapshot.name} (ID: ${snapshot.id})
Project: ${context.name}
Version: ${snapshot.version}`);
}

async function handleListSnapshots(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  const advanced = await getAdvancedStorage();

  const projectId = args.project_id as string | undefined;

  let targetProjectId: string | undefined;
  if (projectId) {
    targetProjectId = projectId;
  } else {
    const active = await storage.getActiveProject();
    targetProjectId = active?.id;
  }

  if (!targetProjectId) {
    return error('No project found. Create one with write_context or set an active project.');
  }

  const snapshots = await advanced.snapshots.listSnapshots(targetProjectId);

  if (snapshots.length === 0) {
    return success('No snapshots found for this project.');
  }

  const list = snapshots
    .map((s) => {
      return `[${s.id}] ${s.name}
  Version: ${s.version}
  Created: ${s.createdAt}
  ${s.description || '(no description)'}`;
    })
    .join('\n\n');

  return success(`Snapshots:\n\n${list}`);
}

async function handleRestoreSnapshot(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  const advanced = await getAdvancedStorage();

  const snapshotId = args.snapshot_id as string;

  const snapshot = await advanced.snapshots.getSnapshot(snapshotId);
  if (!snapshot) {
    return error(`Snapshot not found: ${snapshotId}`);
  }

  // Create a backup snapshot before restoring
  const currentProject = await storage.loadProject(snapshot.projectId);
  if (currentProject) {
    const backupSnapshot = createSnapshot(
      currentProject,
      `Auto-backup before restore to "${snapshot.name}"`,
      'Automatic backup created before snapshot restore',
      'system'
    );
    await advanced.snapshots.saveSnapshot(backupSnapshot);
  }

  // Restore the project
  const restored = restoreFromSnapshot(snapshot);
  await storage.saveProject(restored);

  // Add audit entry
  const auditEntry = createAuditEntry(
    snapshot.projectId,
    AuditAction.RESTORE,
    'snapshot',
    snapshot.id,
    AgentRole.EXECUTOR,
    [{ field: 'project', oldValue: currentProject?.version, newValue: snapshot.version }]
  );
  await advanced.audit.addEntry(auditEntry);

  return success(`Project restored from snapshot: ${snapshot.name}
Project: ${restored.name}
Restored to version: ${snapshot.version}
Current version: ${restored.version}

A backup snapshot was created before restoration.`);
}

// ============================================================================
// Audit Handlers
// ============================================================================

async function handleGetAuditLog(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  const advanced = await getAdvancedStorage();

  const projectId = args.project_id as string | undefined;
  const limit = (args.limit as number) ?? 50;
  const since = args.since as string | undefined;

  let targetProjectId: string | undefined;
  if (projectId) {
    targetProjectId = projectId;
  } else {
    const active = await storage.getActiveProject();
    targetProjectId = active?.id;
  }

  if (!targetProjectId) {
    return error('No project found. Create one with write_context or set an active project.');
  }

  const entries = await advanced.audit.listEntries({
    projectId: targetProjectId,
    limit,
    since,
  });

  if (entries.length === 0) {
    return success('No audit entries found.');
  }

  const list = entries
    .map((e) => {
      const changes = e.changes.map((c) => `${c.field}: ${c.oldValue} → ${c.newValue}`).join(', ');
      return `[${e.timestamp}] ${e.action.toUpperCase()} ${e.entityType}
  Agent: ${e.agent}
  Entity: ${e.entityId}
  Changes: ${changes || '(none)'}`;
    })
    .join('\n\n');

  return success(`Audit Log (${entries.length} entries):\n\n${list}`);
}

// ============================================================================
// Intelligent Features Handlers
// ============================================================================

async function handleGetCriticalPath(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  const projectId = args.project_id as string | undefined;

  let context: ProjectContext | null;
  if (projectId) {
    context = await storage.loadProject(projectId);
  } else {
    context = await storage.getActiveProject();
  }

  if (!context) {
    return error('No project found. Create one with write_context or set an active project.');
  }

  const analysis = analyzeCriticalPath(context);

  const criticalPathStr = analysis.criticalPath
    .map((t, i) => `  ${i + 1}. [${t.status}] ${t.title}`)
    .join('\n');

  const parallelGroups = analysis.parallelizableGroups
    .map((group, i) => `  Group ${i + 1}: ${group.map((t) => t.title).join(', ')}`)
    .join('\n');

  const readyStr = analysis.readyTasks.map((t) => `  • ${t.title}`).join('\n');
  const blockedStr = analysis.blockedTasks.map((t) => `  • ${t.title}`).join('\n');

  return success(`🔍 Critical Path Analysis

📊 Critical Path (${analysis.criticalPathLength} tasks):
${criticalPathStr || '  (none - all tasks independent)'}

⚡ Parallelizable Groups:
${parallelGroups || '  (none found)'}

✅ Ready to Start (${analysis.readyTasks.length}):
${readyStr || '  (none)'}

🚫 Blocked Tasks (${analysis.blockedTasks.length}):
${blockedStr || '  (none)'}

📈 Estimated Remaining: ${analysis.estimatedCompletion} tasks`);
}

async function handleGetSmartQueue(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  const projectId = args.project_id as string | undefined;
  const limit = (args.limit as number) ?? 5;

  let context: ProjectContext | null;
  if (projectId) {
    context = await storage.loadProject(projectId);
  } else {
    context = await storage.getActiveProject();
  }

  if (!context) {
    return error('No project found. Create one with write_context or set an active project.');
  }

  const queue = getSmartPriorityQueue(context, limit);

  if (queue.length === 0) {
    return success('No tasks available. All tasks are either completed, blocked, or in progress.');
  }

  const list = queue
    .map((t, i) => {
      const priority = '★'.repeat(6 - t.priority);
      return `${i + 1}. [P${t.priority}] ${t.title} ${priority}
     ID: ${t.id}
     ${t.description.slice(0, 80)}...`;
    })
    .join('\n\n');

  return success(`🎯 Smart Priority Queue (Top ${queue.length})

Recommended execution order:

${list}

These tasks have been prioritized based on:
• Critical path position
• Dependency unblocking potential
• Priority level
• Task age`);
}

async function handleCompressContext(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  const projectId = args.project_id as string | undefined;
  const includeCompleted = (args.include_completed as boolean) ?? false;
  const maxNotes = (args.max_notes as number) ?? 10;

  let context: ProjectContext | null;
  if (projectId) {
    context = await storage.loadProject(projectId);
  } else {
    context = await storage.getActiveProject();
  }

  if (!context) {
    return error('No project found. Create one with write_context or set an active project.');
  }

  const compressed = compressContext(context, {
    includeCompletedTasks: includeCompleted,
    maxNotes,
  });

  const stats = getCompressionStats(context, compressed);

  return success(`📦 Compressed Context

${JSON.stringify(compressed, null, 2)}

---
📊 Compression Stats:
  Original size: ${stats.originalSize} chars
  Compressed size: ${stats.compressedSize} chars
  Reduction: ${stats.ratio.toFixed(1)}%
  Estimated tokens saved: ~${stats.savedTokens}

Use this compressed format for efficient AI-to-AI context transfer.`);
}

async function handleGetHealthScore(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  const projectId = args.project_id as string | undefined;

  let context: ProjectContext | null;
  if (projectId) {
    context = await storage.loadProject(projectId);
  } else {
    context = await storage.getActiveProject();
  }

  if (!context) {
    return error('No project found. Create one with write_context or set an active project.');
  }

  const health = calculateHealthScore(context);

  const trendIcon =
    health.trend === 'improving' ? '📈' : health.trend === 'declining' ? '📉' : '➡️';
  const scoreEmoji =
    health.overall >= 80 ? '🟢' : health.overall >= 60 ? '🟡' : health.overall >= 40 ? '🟠' : '🔴';

  const risksStr = health.risks
    .map((r) => {
      const icon = r.severity === 'critical' ? '🚨' : r.severity === 'high' ? '⚠️' : 'ℹ️';
      return `  ${icon} [${r.severity.toUpperCase()}] ${r.description}`;
    })
    .join('\n');

  const recsStr = health.recommendations.map((r) => `  • ${r}`).join('\n');

  return success(`🏥 Project Health Score

${scoreEmoji} Overall Score: ${health.overall}/100 ${trendIcon} ${health.trend}

📊 Breakdown:
  Velocity:        ${health.breakdown.velocity}/100
  Blocker Ratio:   ${health.breakdown.blockerRatio}/100
  Dependencies:    ${health.breakdown.dependencyHealth}/100
  Progress Rate:   ${health.breakdown.progressRate}/100
  Activity:        ${health.breakdown.staleness}/100
  Documentation:   ${health.breakdown.documentationQuality}/100

⚠️ Risks (${health.risks.length}):
${risksStr || '  (none detected)'}

💡 Recommendations:
${recsStr || '  (none)'}`);
}

async function handleBatchOperations(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  const projectId = args.project_id as string | undefined;
  const operations = args.operations as BatchOperation[];

  let context: ProjectContext | null;
  if (projectId) {
    context = await storage.loadProject(projectId);
  } else {
    context = await storage.getActiveProject();
  }

  if (!context) {
    return error('No project found. Create one with write_context or set an active project.');
  }

  const result = executeBatchOperations(context, operations);

  if (result.success) {
    await storage.saveProject(result.context);
  }

  const resultsStr = result.results
    .map((r) => {
      const status = r.success ? '✅' : '❌';
      const extra = r.error ? ` - ${r.error}` : r.result ? ` - ${JSON.stringify(r.result)}` : '';
      return `  ${status} Operation ${r.index + 1}${extra}`;
    })
    .join('\n');

  const statusEmoji = result.success ? '✅' : '⚠️';

  return success(`${statusEmoji} Batch Operations Result

Applied: ${result.appliedCount}/${operations.length}
Failed: ${result.failedCount}

Results:
${resultsStr}

${result.success ? 'All operations completed successfully.' : 'Some operations failed. Project was NOT saved.'}`);
}

async function handleGetSuggestions(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  const projectId = args.project_id as string | undefined;

  let context: ProjectContext | null;
  if (projectId) {
    context = await storage.loadProject(projectId);
  } else {
    context = await storage.getActiveProject();
  }

  if (!context) {
    return error('No project found. Create one with write_context or set an active project.');
  }

  const suggestions = generateTaskSuggestions(context);

  if (suggestions.length === 0) {
    return success('🎉 No suggestions - project looks healthy!');
  }

  const priorityIcon = (p: string) => (p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '🟢');

  const list = suggestions
    .map((s, i) => {
      const icon = priorityIcon(s.priority);
      const taskSuggestion = s.suggestedTask
        ? `\n     Suggested task: "${s.suggestedTask.title}"`
        : '';
      return `${i + 1}. ${icon} [${s.priority.toUpperCase()}] ${s.title}
     Type: ${s.type}
     ${s.description}${taskSuggestion}`;
    })
    .join('\n\n');

  return success(`💡 Intelligent Suggestions (${suggestions.length})

${list}

These suggestions are based on:
• Dependency analysis
• Project health metrics
• Phase progression patterns
• Documentation completeness`);
}

// ============================================================================
// Productivity Feature Handlers
// ============================================================================

async function handleAddPersonalTodo(args: Record<string, unknown>): Promise<ToolResult> {
  const content = args.content as string;
  const priority = args.priority as 1 | 2 | 3 | 4 | 5 | undefined;
  const tags = args.tags as string[] | undefined;
  const dueDate = args.due_date as string | undefined;
  const context = args.context as string | undefined;

  const todo = await addPersonalTodo(content, {
    priority,
    tags,
    dueDate,
    context,
  });

  return success(`✅ Todo added: "${todo.content}"
ID: ${todo.id}
Priority: ${todo.priority}
${tags?.length ? `Tags: ${tags.join(', ')}` : ''}
${dueDate ? `Due: ${dueDate}` : ''}`);
}

async function handleListPersonalTodos(args: Record<string, unknown>): Promise<ToolResult> {
  const tag = args.tag as string | undefined;
  const priority = args.priority as number | undefined;

  const todos = await listPersonalTodos({ tag, priority });

  if (todos.length === 0) {
    return success('📋 No personal todos. Add one with add_personal_todo!');
  }

  const list = todos
    .map((t) => {
      const priorityIcon = '⚡'.repeat(6 - t.priority);
      const tagStr = t.tags.length ? ` [${t.tags.join(', ')}]` : '';
      const dueStr = t.dueDate ? ` 📅 ${t.dueDate.split('T')[0]}` : '';
      return `${priorityIcon} ${t.content}${tagStr}${dueStr}\n   ID: ${t.id}`;
    })
    .join('\n\n');

  return success(`📋 Personal Todos (${todos.length})

${list}`);
}

async function handleCompletePersonalTodo(args: Record<string, unknown>): Promise<ToolResult> {
  const todoId = args.todo_id as string;
  const reflection = args.reflection as string | undefined;
  const duration = args.duration as number | undefined;

  const did = await completeTodo(todoId, { reflection, duration });

  if (!did) {
    return error(`Todo not found: ${todoId}`);
  }

  return success(`✅ Completed: "${did.content}"

Moved to "did" list.
${duration ? `Time spent: ${duration} minutes` : ''}
${reflection ? `Reflection: ${reflection}` : ''}

Use list_dids to see your accomplishments!`);
}

async function handleListDids(args: Record<string, unknown>): Promise<ToolResult> {
  const limit = (args.limit as number) ?? 20;
  const since = args.since as string | undefined;
  const tag = args.tag as string | undefined;

  const dids = await listDids({ limit, since, tag });

  if (dids.length === 0) {
    return success('📝 No completed items yet. Complete a todo to see it here!');
  }

  const list = dids
    .map((d) => {
      const durationStr = d.duration ? ` (${d.duration}min)` : '';
      const tagStr = d.tags.length ? ` [${d.tags.join(', ')}]` : '';
      const date = d.completedAt.split('T')[0];
      return `✓ ${d.content}${tagStr}${durationStr}\n  Completed: ${date}${d.reflection ? `\n  Insight: ${d.reflection}` : ''}`;
    })
    .join('\n\n');

  return success(`📝 Did List (${dids.length} items)

${list}`);
}

async function handleSetGoals(args: Record<string, unknown>): Promise<ToolResult> {
  const daily = args.daily as string[] | undefined;
  const weekly = args.weekly as string[] | undefined;

  if (daily) {
    await setDailyGoals(daily);
  }
  if (weekly) {
    await setWeeklyGoals(weekly);
  }

  const goals = await getGoals();

  return success(`🎯 Goals Updated

Daily Goals:
${goals.daily.map((g) => `  • ${g}`).join('\n') || '  (none set)'}

Weekly Goals:
${goals.weekly.map((g) => `  • ${g}`).join('\n') || '  (none set)'}`);
}

async function handleGetGoals(): Promise<ToolResult> {
  const goals = await getGoals();

  return success(`🎯 Current Goals

Daily Goals:
${goals.daily.map((g) => `  • ${g}`).join('\n') || '  (none set)'}

Weekly Goals:
${goals.weekly.map((g) => `  • ${g}`).join('\n') || '  (none set)'}`);
}

async function handleRemember(args: Record<string, unknown>): Promise<ToolResult> {
  const key = args.key as string;
  const value = args.value as string;
  const category = args.category as
    | 'preference'
    | 'decision'
    | 'context'
    | 'learning'
    | 'reminder'
    | undefined;
  const expiresIn = args.expires_in as number | undefined;
  const projectId = args.project_id as string | undefined;

  const memory = await remember(key, value, {
    category,
    expiresIn,
    projectId,
  });

  return success(`🧠 Remembered: "${key}"
Category: ${memory.category}
${memory.expiresAt ? `Expires: ${memory.expiresAt}` : 'Never expires'}
${memory.projectId ? `Project: ${memory.projectId}` : ''}

Use recall("${key}") to retrieve this later.`);
}

async function handleRecall(args: Record<string, unknown>): Promise<ToolResult> {
  const key = args.key as string;
  const value = await recall(key);

  if (value === null) {
    return error(`No memory found for key: "${key}"`);
  }

  return success(`🧠 Recalled "${key}":

${value}`);
}

async function handleListMemories(args: Record<string, unknown>): Promise<ToolResult> {
  const category = args.category as
    | 'preference'
    | 'decision'
    | 'context'
    | 'learning'
    | 'reminder'
    | undefined;
  const projectId = args.project_id as string | undefined;

  const memories = await listMemories({ category, projectId });

  if (memories.length === 0) {
    return success('🧠 No memories stored. Use remember() to store information.');
  }

  const categoryIcon = (c: string) => {
    switch (c) {
      case 'preference':
        return '⚙️';
      case 'decision':
        return '🎯';
      case 'context':
        return '📌';
      case 'learning':
        return '💡';
      case 'reminder':
        return '⏰';
      default:
        return '📝';
    }
  };

  const list = memories
    .map(
      (m) =>
        `${categoryIcon(m.category)} ${m.key}: ${m.value.substring(0, 50)}${m.value.length > 50 ? '...' : ''}`
    )
    .join('\n');

  return success(`🧠 Stored Memories (${memories.length})

${list}`);
}

async function handleForget(args: Record<string, unknown>): Promise<ToolResult> {
  const key = args.key as string;
  const forgotten = await forget(key);

  if (!forgotten) {
    return error(`No memory found for key: "${key}"`);
  }

  return success(`🧠 Forgotten: "${key}"`);
}

async function handleStartTimeTracking(args: Record<string, unknown>): Promise<ToolResult> {
  const taskId = args.task_id as string;
  const projectId = args.project_id as string;
  const notes = args.notes as string | undefined;

  const entry = await startTimeTracking(taskId, projectId, notes);

  return success(`⏱️ Time tracking started
Task: ${entry.taskId}
Project: ${entry.projectId}
Started: ${entry.startedAt}
${notes ? `Notes: ${notes}` : ''}

Use stop_time_tracking when done.`);
}

async function handleStopTimeTracking(args: Record<string, unknown>): Promise<ToolResult> {
  const notes = args.notes as string | undefined;

  const entry = await stopTimeTracking(notes);

  if (!entry) {
    return error('No active time tracking to stop.');
  }

  return success(`⏱️ Time tracking stopped
Task: ${entry.taskId}
Duration: ${entry.duration} minutes
${entry.notes ? `Notes: ${entry.notes}` : ''}`);
}

async function handleGetTimeStats(args: Record<string, unknown>): Promise<ToolResult> {
  const projectId = args.project_id as string;

  const stats = await getTimeStats(projectId);

  const taskBreakdown =
    Object.entries(stats.taskBreakdown)
      .map(([taskId, minutes]) => `  ${taskId}: ${minutes}min`)
      .join('\n') || '  (no data)';

  return success(`⏱️ Time Statistics for ${projectId}

Total Time: ${stats.totalMinutes} minutes (${(stats.totalMinutes / 60).toFixed(1)} hours)
Average Session: ${stats.averageSessionLength} minutes
Longest Session: ${stats.longestSession} minutes

By Task:
${taskBreakdown}`);
}

async function handleListPromptTemplates(args: Record<string, unknown>): Promise<ToolResult> {
  const category = args.category as string | undefined;

  const templates = listPromptTemplates(category as any);

  const list = templates
    .map(
      (t) => `📝 ${t.name} (${t.id})
   Category: ${t.category}
   ${t.description}`
    )
    .join('\n\n');

  return success(`📚 Prompt Templates (${templates.length})

${list}

Use generate_prompt with template_id to fill a template with project context.`);
}

async function handleGeneratePrompt(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  const templateId = args.template_id as string;
  const projectId = args.project_id as string | undefined;

  let context: ProjectContext | null;
  if (projectId) {
    context = await storage.loadProject(projectId);
  } else {
    context = await storage.getActiveProject();
  }

  if (!context) {
    return error('No project found. Create one with write_context or set an active project.');
  }

  const prompt = generatePromptFromContext(context, templateId);

  if (!prompt) {
    return error(`Template not found: ${templateId}`);
  }

  return success(`📝 Generated Prompt

${prompt}`);
}

async function handleExportMd(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  const projectId = args.project_id as string | undefined;
  const format = (args.format as 'minimal' | 'standard' | 'detailed') ?? 'standard';
  const savePath = args.save_path as string | undefined;
  const target = (args.target as string) ?? 'claude';

  let context: ProjectContext | null;
  if (projectId) {
    context = await storage.loadProject(projectId);
  } else {
    context = await storage.getActiveProject();
  }

  if (!context) {
    return error('No project found. Create one with write_context or set an active project.');
  }

  const exported = generateClaudeMd(context, format);

  // Add target-specific header
  let content = exported.content;
  if (target !== 'claude') {
    const targetHeaders: Record<string, string> = {
      gemini: '<!-- For Google Gemini AI -->\n',
      chatgpt: '<!-- For OpenAI ChatGPT -->\n',
      cursor: '<!-- For Cursor AI -->\n',
      copilot: '<!-- For GitHub Copilot -->\n',
    };
    content = (targetHeaders[target.toLowerCase()] ?? '') + content;
  }

  if (savePath) {
    await saveClaudeMd(context, savePath, format);
    return success(`📄 Exported to: ${savePath}

Format: ${format}
Target: ${target.toUpperCase()}

This file can be placed in your project root for automatic context loading.`);
  }

  return success(`📄 Export Preview (${format} format, for ${target.toUpperCase()})

${content}`);
}

async function handleGetDailyDigest(args: Record<string, unknown>): Promise<ToolResult> {
  const projectId = args.project_id as string | undefined;

  const digest = await getDailyDigest(projectId);

  const deadlines =
    digest.upcomingDeadlines
      .map((t) => `  📅 ${t.dueDate?.split('T')[0]}: ${t.content}`)
      .join('\n') || '  (none)';

  const completions =
    digest.recentCompletions.map((d) => `  ✓ ${d.content}`).join('\n') || '  (none today)';

  return success(`📊 Daily Digest - ${digest.date}

📋 Todos: ${digest.todosCount} pending
✅ Done Today: ${digest.didsCount}
⏱️ Time Tracked: ${digest.timeTracked} minutes

📅 Upcoming Deadlines:
${deadlines}

✅ Recent Completions:
${completions}

🎯 Daily Goals:
${digest.goals.daily.map((g) => `  • ${g}`).join('\n') || '  (none set)'}

⏰ Reminders:
${digest.memories.map((m) => `  • ${m.value}`).join('\n') || '  (none)'}`);
}

async function handleGetProductivityStats(args: Record<string, unknown>): Promise<ToolResult> {
  const period = (args.period as 'day' | 'week' | 'month') ?? 'week';

  const stats = await getProductivityStats(period);

  const topTags = stats.topTags.map((t) => `  ${t.tag}: ${t.count}`).join('\n') || '  (no tags)';

  return success(`📈 Productivity Stats (${period})

✅ Tasks Completed: ${stats.tasksCompleted}
⏱️ Avg Completion Time: ${stats.averageCompletionTime} minutes
🔥 Streak: ${stats.streakDays} days
⏰ Total Time Tracked: ${stats.totalTimeTracked} minutes

🏷️ Top Tags:
${topTags}`);
}

// ============================================================================
// RAG Tool Handlers
// ============================================================================

async function handleRAGIndexDocument(args: Record<string, unknown>): Promise<ToolResult> {
  const title = args.title as string;
  const content = args.content as string;
  const projectId = args.project_id as string | undefined;
  const metadata = args.metadata as Record<string, unknown> | undefined;

  if (!title || !content) {
    return error('Title and content are required');
  }

  const doc = await indexDocument(title, content, {
    projectId,
    sourceType: 'custom_document',
    metadata,
  });

  return success(`📄 Document indexed successfully!

ID: ${doc.id}
Title: ${doc.title}
Chunks: ${doc.chunkCount}
Project: ${doc.projectId ?? 'none'}
Created: ${doc.createdAt}`);
}

async function handleRAGIndexProject(args: Record<string, unknown>): Promise<ToolResult> {
  const projectId = args.project_id as string | undefined;

  const storage = await getStorage();
  let project: ProjectContext | null;

  if (projectId) {
    project = await storage.loadProject(projectId);
  } else {
    project = await storage.getActiveProject();
  }

  if (!project) {
    return error('No project found. Specify project_id or set an active project.');
  }

  const result = await indexProjectContext(project);

  return success(`📚 Project indexed successfully!

Project: ${project.name}
Documents created: ${result.documents.length}
Total chunks: ${result.totalChunks}

Indexed:
- 1 project context
- ${project.tasks.length} tasks
- ${result.documents.length - 1 - project.tasks.length} significant notes`);
}

async function handleRAGSearch(args: Record<string, unknown>): Promise<ToolResult> {
  const query = args.query as string;
  const projectId = args.project_id as string | undefined;
  const searchType = args.search_type as 'vector' | 'keyword' | 'hybrid' | undefined;
  const topK = args.top_k as number | undefined;
  const minScore = args.min_score as number | undefined;

  if (!query) {
    return error('Query is required');
  }

  const result = await search(query, {
    projectId,
    searchType,
    topK,
    minScore,
  });

  if (result.results.length === 0) {
    return success(`🔍 No results found for: "${query}"

Try:
- Different search terms
- Lowering min_score threshold
- Using keyword search for exact matches
- Indexing more documents`);
  }

  const resultList = result.results
    .map(
      (r, i) =>
        `${i + 1}. [${(r.score * 100).toFixed(1)}%] ${r.document.title}
   ${r.chunk.content.substring(0, 150)}${r.chunk.content.length > 150 ? '...' : ''}`
    )
    .join('\n\n');

  return success(`🔍 Search Results for: "${query}"

Found: ${result.totalFound} results
Search time: ${result.searchTimeMs}ms
Embedding provider: ${result.embeddingProvider}

${resultList}`);
}

async function handleRAGQueryContext(args: Record<string, unknown>): Promise<ToolResult> {
  const query = args.query as string;
  const projectId = args.project_id as string | undefined;
  const maxContextLength = args.max_context_length as number | undefined;
  const includeMetadata = args.include_metadata as boolean | undefined;

  if (!query) {
    return error('Query is required');
  }

  const result = await buildContextFromSearch(query, {
    projectId,
    maxContextLength,
    includeMetadata,
  });

  if (result.sources.length === 0) {
    return success(`📋 No relevant context found for: "${query}"

Try indexing more documents or using different search terms.`);
  }

  const sourceList = result.sources
    .map((s) => `- ${s.title} (${(s.score * 100).toFixed(1)}%)`)
    .join('\n');

  return success(`📋 Context for: "${query}"

Sources (${result.sources.length}):
${sourceList}

--- CONTEXT START ---
${result.context}
--- CONTEXT END ---

Search time: ${result.searchResult.searchTimeMs}ms
Context length: ${result.context.length} characters`);
}

async function handleRAGListDocuments(args: Record<string, unknown>): Promise<ToolResult> {
  const projectId = args.project_id as string | undefined;
  const sourceType = args.source_type as string | undefined;
  const limit = args.limit as number | undefined;

  const docs = await listDocuments({
    projectId,
    sourceType,
    limit: limit ?? 50,
  });

  if (docs.length === 0) {
    return success(`📄 No documents indexed yet.

Use rag_index_document or rag_index_project to add content.`);
  }

  const docList = docs
    .map(
      (d) =>
        `- [${d.id.substring(0, 8)}] ${d.title}
    Type: ${d.sourceType} | Chunks: ${d.chunkCount} | Project: ${d.projectId ?? 'none'}`
    )
    .join('\n');

  return success(`📄 Indexed Documents (${docs.length})

${docList}`);
}

async function handleRAGDeleteDocument(args: Record<string, unknown>): Promise<ToolResult> {
  const documentId = args.document_id as string;

  if (!documentId) {
    return error('document_id is required');
  }

  const deleted = await deleteRAGDocument(documentId);

  if (deleted) {
    return success(`🗑️ Document deleted: ${documentId}`);
  } else {
    return error(`Document not found: ${documentId}`);
  }
}

async function handleRAGGetStats(): Promise<ToolResult> {
  const stats = await getRAGStats();

  const projectBreakdown =
    Object.entries(stats.projectBreakdown)
      .map(([pid, count]) => `  ${pid}: ${count} documents`)
      .join('\n') || '  (no project associations)';

  return success(`📊 RAG System Statistics

Documents: ${stats.totalDocuments}
Chunks: ${stats.totalChunks}
Indexed chunks: ${stats.indexedChunks} (${((stats.indexedChunks / Math.max(stats.totalChunks, 1)) * 100).toFixed(1)}%)

Embedding Provider: ${stats.embeddingProvider}
Embedding Dimensions: ${stats.embeddingDimensions}

Documents by Project:
${projectBreakdown}`);
}

async function handleRAGConfigure(args: Record<string, unknown>): Promise<ToolResult> {
  const embeddingConfig = args.embedding as Record<string, unknown> | undefined;
  const chunkingConfig = args.chunking as Record<string, unknown> | undefined;
  const searchConfig = args.search as Record<string, unknown> | undefined;

  const updates: Parameters<typeof updateRAGConfig>[0] = {};

  if (embeddingConfig) {
    updates.embedding = {
      provider: embeddingConfig.provider as EmbeddingProvider | undefined,
      model: embeddingConfig.model as string | undefined,
      apiKey: embeddingConfig.api_key as string | undefined,
      apiEndpoint: embeddingConfig.api_endpoint as string | undefined,
    };
    // Reset embedding provider to pick up new config
    resetEmbeddingProvider();
  }

  if (chunkingConfig) {
    updates.chunking = {
      strategy: chunkingConfig.strategy as ChunkingStrategy | undefined,
      chunkSize: chunkingConfig.chunk_size as number | undefined,
      chunkOverlap: chunkingConfig.chunk_overlap as number | undefined,
    };
  }

  if (searchConfig) {
    updates.search = {
      topK: searchConfig.top_k as number | undefined,
      minScore: searchConfig.min_score as number | undefined,
      hybridVectorWeight: searchConfig.hybrid_vector_weight as number | undefined,
    };
  }

  await updateRAGConfig(updates);

  const config = await getRAGConfig();

  return success(`⚙️ RAG Configuration Updated

Embedding:
  Provider: ${config.embedding.provider}
  Model: ${config.embedding.model}
  Dimensions: ${config.embedding.dimensions}

Chunking:
  Strategy: ${config.chunking.strategy}
  Chunk size: ${config.chunking.chunkSize}
  Overlap: ${config.chunking.chunkOverlap}

Search:
  Top K: ${config.search.topK}
  Min score: ${config.search.minScore}
  Hybrid vector weight: ${config.search.hybridVectorWeight}`);
}

// ============================================================================
// Server Setup
// ============================================================================

export async function createServer(): Promise<Server> {
  const server = new Server(
    {
      name: 'cortexflow',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'read_context':
          return await handleReadContext(args ?? {});
        case 'write_context':
          return await handleWriteContext(args ?? {});
        case 'add_task':
          return await handleAddTask(args ?? {});
        case 'update_task':
          return await handleUpdateTask(args ?? {});
        case 'mark_task_complete':
          return await handleMarkTaskComplete(args ?? {});
        case 'add_note':
          return await handleAddNote(args ?? {});
        case 'set_phase':
          return await handleSetPhase(args ?? {});
        case 'list_projects':
          return await handleListProjects();
        case 'set_active_project':
          return await handleSetActiveProject(args ?? {});
        case 'delete_project':
          return await handleDeleteProject(args ?? {});
        case 'get_analytics':
          return await handleGetAnalytics(args ?? {});
        case 'export_project':
          return await handleExportProject(args ?? {});
        case 'clone_project':
          return await handleCloneProject(args ?? {});
        // Webhook tools
        case 'register_webhook':
          return await handleRegisterWebhook(args ?? {});
        case 'list_webhooks':
          return await handleListWebhooks();
        case 'delete_webhook':
          return await handleDeleteWebhook(args ?? {});
        // Template tools
        case 'list_templates':
          return await handleListTemplates(args ?? {});
        case 'create_from_template':
          return await handleCreateFromTemplate(args ?? {});
        // Snapshot tools
        case 'create_snapshot':
          return await handleCreateSnapshot(args ?? {});
        case 'list_snapshots':
          return await handleListSnapshots(args ?? {});
        case 'restore_snapshot':
          return await handleRestoreSnapshot(args ?? {});
        // Audit tools
        case 'get_audit_log':
          return await handleGetAuditLog(args ?? {});
        // Intelligent features
        case 'get_critical_path':
          return await handleGetCriticalPath(args ?? {});
        case 'get_smart_queue':
          return await handleGetSmartQueue(args ?? {});
        case 'compress_context':
          return await handleCompressContext(args ?? {});
        case 'get_health_score':
          return await handleGetHealthScore(args ?? {});
        case 'batch_operations':
          return await handleBatchOperations(args ?? {});
        case 'get_suggestions':
          return await handleGetSuggestions(args ?? {});

        // Productivity features
        case 'add_personal_todo':
          return await handleAddPersonalTodo(args ?? {});
        case 'list_personal_todos':
          return await handleListPersonalTodos(args ?? {});
        case 'complete_personal_todo':
          return await handleCompletePersonalTodo(args ?? {});
        case 'list_dids':
          return await handleListDids(args ?? {});
        case 'set_goals':
          return await handleSetGoals(args ?? {});
        case 'get_goals':
          return await handleGetGoals();

        // Session memory
        case 'remember':
          return await handleRemember(args ?? {});
        case 'recall':
          return await handleRecall(args ?? {});
        case 'list_memories':
          return await handleListMemories(args ?? {});
        case 'forget':
          return await handleForget(args ?? {});

        // Time tracking
        case 'start_time_tracking':
          return await handleStartTimeTracking(args ?? {});
        case 'stop_time_tracking':
          return await handleStopTimeTracking(args ?? {});
        case 'get_time_stats':
          return await handleGetTimeStats(args ?? {});

        // Prompt templates
        case 'list_prompt_templates':
          return await handleListPromptTemplates(args ?? {});
        case 'generate_prompt':
          return await handleGeneratePrompt(args ?? {});

        // Export
        case 'export_claude_md':
          return await handleExportMd(args ?? {});

        // Productivity dashboard
        case 'get_daily_digest':
          return await handleGetDailyDigest(args ?? {});
        case 'get_productivity_stats':
          return await handleGetProductivityStats(args ?? {});

        // RAG (Retrieval-Augmented Generation)
        case 'rag_index_document':
          return await handleRAGIndexDocument(args ?? {});
        case 'rag_index_project':
          return await handleRAGIndexProject(args ?? {});
        case 'rag_search':
          return await handleRAGSearch(args ?? {});
        case 'rag_query_context':
          return await handleRAGQueryContext(args ?? {});
        case 'rag_list_documents':
          return await handleRAGListDocuments(args ?? {});
        case 'rag_delete_document':
          return await handleRAGDeleteDocument(args ?? {});
        case 'rag_get_stats':
          return await handleRAGGetStats();
        case 'rag_configure':
          return await handleRAGConfigure(args ?? {});

        default:
          return error(`Unknown tool: ${name}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return error(message);
    }
  });

  // Resources (optional - expose project files as resources)
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const storage = await getStorage();
    const projects = await storage.listProjects();

    return {
      resources: projects.map((p) => ({
        uri: `cortexflow://project/${p.id}`,
        name: p.name,
        description: `Project: ${p.name} (${p.phase})`,
        mimeType: 'application/json',
      })),
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const match = uri.match(/^cortexflow:\/\/project\/(.+)$/);

    if (!match) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }

    const projectId = match[1];
    const storage = await getStorage();
    const project = await storage.loadProject(projectId);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(project, null, 2),
        },
      ],
    };
  });

  return server;
}

export async function runServer(): Promise<void> {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('CortexFlow MCP server running on stdio');
}
