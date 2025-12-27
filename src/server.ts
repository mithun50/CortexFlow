/**
 * CortexFlow - MCP Server Implementation
 *
 * Model Context Protocol server for AI-to-AI task continuation.
 * Provides tools for reading/writing shared project context.
 *
 * Transport: stdio (Claude Desktop compatible)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  Tool,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";

import { getStorage } from "./storage.js";
import {
  ProjectContext,
  Phase,
  TaskStatus,
  AgentRole,
  createProject,
  addTask,
  addNote,
  updateTaskStatus,
  updateTaskNote,
  setPhase,
  getTask,
  getPendingTasks,
  getProjectSummary,
} from "./models.js";

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS: Tool[] = [
  // Context Management
  {
    name: "read_context",
    description: `Read the current shared project context. Returns project metadata, tasks, notes, and current phase.

Use this to understand:
- What the project is about
- Current phase (planning/execution/review)
- All tasks and their statuses
- Notes from other AI agents (ChatGPT planner notes)

Call this first when continuing work on a project.`,
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "Project ID. If omitted, reads the active project.",
        },
        include_completed: {
          type: "boolean",
          description: "Include completed tasks in response. Default: false",
        },
      },
    },
  },
  {
    name: "write_context",
    description: `Create a new project context or completely overwrite an existing one.

Use this to:
- Start a new project (ChatGPT planning phase)
- Define project goals and initial task list
- Set project metadata

Typically used by the Planner (ChatGPT) to initialize a project.`,
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Project name",
        },
        description: {
          type: "string",
          description: "Project description and goals",
        },
        phase: {
          type: "string",
          enum: ["planning", "execution", "review", "completed"],
          description: "Initial project phase. Default: planning",
        },
        tasks: {
          type: "array",
          description: "Initial tasks to create",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              priority: { type: "number", minimum: 1, maximum: 5 },
            },
            required: ["title", "description"],
          },
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Project tags for categorization",
        },
      },
      required: ["name", "description"],
    },
  },

  // Task Management
  {
    name: "add_task",
    description: `Add a new task to the active project.

Use this to:
- Add tasks discovered during execution
- Break down work into smaller pieces
- Add tasks identified during review`,
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Task title",
        },
        description: {
          type: "string",
          description: "Detailed task description",
        },
        priority: {
          type: "number",
          minimum: 1,
          maximum: 5,
          description: "Priority (1=highest, 5=lowest). Default: 1",
        },
        dependencies: {
          type: "array",
          items: { type: "string" },
          description: "Task IDs this task depends on",
        },
      },
      required: ["title", "description"],
    },
  },
  {
    name: "update_task",
    description: `Update a task's status or add notes to it.

Use this to:
- Mark task as in_progress when starting work
- Add implementation notes or findings
- Record blockers or issues`,
    inputSchema: {
      type: "object",
      properties: {
        task_id: {
          type: "string",
          description: "Task ID to update",
        },
        status: {
          type: "string",
          enum: ["pending", "in_progress", "blocked", "completed", "cancelled"],
          description: "New task status",
        },
        note: {
          type: "string",
          description: "Note to add to the task",
        },
      },
      required: ["task_id"],
    },
  },
  {
    name: "mark_task_complete",
    description: `Mark a task as completed with an optional completion note.

Use this when:
- Task implementation is finished
- Task has been verified/tested
- Task is no longer needed (will be cancelled instead)`,
    inputSchema: {
      type: "object",
      properties: {
        task_id: {
          type: "string",
          description: "Task ID to complete",
        },
        note: {
          type: "string",
          description: "Completion note (what was done, results, etc.)",
        },
      },
      required: ["task_id"],
    },
  },

  // Notes and Communication
  {
    name: "add_note",
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
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Note content",
        },
        agent: {
          type: "string",
          enum: ["planner", "executor", "reviewer"],
          description: "Agent role adding the note. Default: executor (Claude)",
        },
        category: {
          type: "string",
          enum: ["general", "decision", "blocker", "insight"],
          description: "Note category. Default: general",
        },
      },
      required: ["content"],
    },
  },

  // Phase Management
  {
    name: "set_phase",
    description: `Update the project phase.

Phases:
- planning: Initial design and task creation (ChatGPT)
- execution: Implementation in progress (Claude)
- review: Validation and testing
- completed: Project finished`,
    inputSchema: {
      type: "object",
      properties: {
        phase: {
          type: "string",
          enum: ["planning", "execution", "review", "completed"],
          description: "New project phase",
        },
      },
      required: ["phase"],
    },
  },

  // Project Management
  {
    name: "list_projects",
    description: "List all projects in the CortexFlow storage.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "set_active_project",
    description: "Set a project as the active project for subsequent operations.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "Project ID to set as active",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "delete_project",
    description: "Delete a project from storage.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "Project ID to delete",
        },
      },
      required: ["project_id"],
    },
  },
];

// ============================================================================
// Tool Handlers
// ============================================================================

type ToolResult = { content: TextContent[]; isError?: boolean };

function success(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

function error(text: string): ToolResult {
  return { content: [{ type: "text", text: `Error: ${text}` }], isError: true };
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
    return error("No project found. Create one with write_context or set an active project.");
  }

  // Filter tasks if needed
  let tasks = context.tasks;
  if (!includeCompleted) {
    tasks = tasks.filter((t) => t.status !== TaskStatus.COMPLETED);
  }

  const summary = getProjectSummary(context);
  const taskList = tasks
    .map((t) => `  [${t.id}] ${t.status.toUpperCase()}: ${t.title}\n      ${t.description}`)
    .join("\n");
  const noteList = context.notes
    .slice(-10) // Last 10 notes
    .map((n) => `  [${n.agent}/${n.category}] ${n.content}`)
    .join("\n");

  return success(`${summary}

Tasks:
${taskList || "  (none)"}

Recent Notes:
${noteList || "  (none)"}`);
}

async function handleWriteContext(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();

  const name = args.name as string;
  const description = args.description as string;
  const phase = (args.phase as Phase) || Phase.PLANNING;
  const tags = (args.tags as string[]) || [];

  let context = createProject(name, description, { phase, tags });

  // Add initial tasks if provided
  const tasksInput = args.tasks as Array<{ title: string; description: string; priority?: number }> | undefined;
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
    return error("No active project. Create one with write_context first.");
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
    return error("No active project.");
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
    return error("No active project.");
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
    return error("No active project.");
  }

  const content = args.content as string;
  const agent = (args.agent as AgentRole) || AgentRole.EXECUTOR;
  const category = (args.category as "general" | "decision" | "blocker" | "insight") || "general";

  const result = addNote(context, agent, content, category);
  context = result.context;

  await storage.saveProject(context);

  return success(`Note added by ${agent}: ${content.slice(0, 50)}...`);
}

async function handleSetPhase(args: Record<string, unknown>): Promise<ToolResult> {
  const storage = await getStorage();
  let context = await storage.getActiveProject();

  if (!context) {
    return error("No active project.");
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
    return success("No projects found. Create one with write_context.");
  }

  const list = projects
    .map((p) => {
      const active = p.id === activeId ? " (ACTIVE)" : "";
      const completed = p.tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
      return `  [${p.id}] ${p.name}${active}
      Phase: ${p.phase} | Tasks: ${completed}/${p.tasks.length} | Updated: ${p.updatedAt}`;
    })
    .join("\n");

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

// ============================================================================
// Server Setup
// ============================================================================

export async function createServer(): Promise<Server> {
  const server = new Server(
    {
      name: "cortexflow",
      version: "1.0.0",
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
        case "read_context":
          return await handleReadContext(args ?? {});
        case "write_context":
          return await handleWriteContext(args ?? {});
        case "add_task":
          return await handleAddTask(args ?? {});
        case "update_task":
          return await handleUpdateTask(args ?? {});
        case "mark_task_complete":
          return await handleMarkTaskComplete(args ?? {});
        case "add_note":
          return await handleAddNote(args ?? {});
        case "set_phase":
          return await handleSetPhase(args ?? {});
        case "list_projects":
          return await handleListProjects();
        case "set_active_project":
          return await handleSetActiveProject(args ?? {});
        case "delete_project":
          return await handleDeleteProject(args ?? {});
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
        mimeType: "application/json",
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
          mimeType: "application/json",
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
  console.error("CortexFlow MCP server running on stdio");
}
