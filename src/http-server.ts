/**
 * CortexFlow - HTTP API Server
 *
 * REST API for universal AI client support:
 * - ChatGPT (via plugins/actions)
 * - Gemini / Gemini CLI
 * - Qwen CLI
 * - Cursor
 * - VS Code extensions
 * - Any HTTP-capable client
 */

import { createServer as createHttpServer, IncomingMessage, ServerResponse } from "http";
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

const PORT = parseInt(process.env.CORTEXFLOW_PORT ?? "3210", 10);

// ============================================================================
// HTTP Utilities
// ============================================================================

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data, null, 2));
}

function error(res: ServerResponse, message: string, status = 400): void {
  json(res, { error: message }, status);
}

// ============================================================================
// Route Handlers
// ============================================================================

async function handleProjects(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const storage = await getStorage();
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const pathParts = url.pathname.split("/").filter(Boolean);

  // GET /api/projects - List all projects
  if (req.method === "GET" && pathParts.length === 2) {
    const projects = await storage.listProjects();
    const activeId = await storage.getActiveProjectId();
    json(res, {
      projects: projects.map((p) => ({
        ...p,
        isActive: p.id === activeId,
      })),
      activeProjectId: activeId,
    });
    return;
  }

  // POST /api/projects - Create new project
  if (req.method === "POST" && pathParts.length === 2) {
    const body = JSON.parse(await readBody(req));
    const { name, description, phase, tasks, tags } = body;

    if (!name || !description) {
      error(res, "name and description are required");
      return;
    }

    let context = createProject(name, description, {
      phase: phase as Phase,
      tags,
    });

    if (tasks) {
      for (const t of tasks) {
        const result = addTask(context, t.title, t.description, {
          priority: t.priority,
          assignedTo: AgentRole.EXECUTOR,
        });
        context = result.context;
      }
    }

    await storage.saveProject(context);
    await storage.setActiveProject(context.id);
    json(res, context, 201);
    return;
  }

  // GET /api/projects/:id - Get specific project
  if (req.method === "GET" && pathParts.length === 3) {
    const projectId = pathParts[2];
    const project = await storage.loadProject(projectId);
    if (!project) {
      error(res, "Project not found", 404);
      return;
    }
    json(res, project);
    return;
  }

  // DELETE /api/projects/:id - Delete project
  if (req.method === "DELETE" && pathParts.length === 3) {
    const projectId = pathParts[2];
    const deleted = await storage.deleteProject(projectId);
    if (!deleted) {
      error(res, "Project not found", 404);
      return;
    }
    json(res, { deleted: true });
    return;
  }

  error(res, "Not found", 404);
}

async function handleContext(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const storage = await getStorage();

  // GET /api/context - Read active project context
  if (req.method === "GET") {
    const context = await storage.getActiveProject();
    if (!context) {
      error(res, "No active project", 404);
      return;
    }
    json(res, {
      ...context,
      summary: getProjectSummary(context),
      pendingTasks: getPendingTasks(context),
    });
    return;
  }

  // PUT /api/context - Update active project context
  if (req.method === "PUT") {
    let context = await storage.getActiveProject();
    if (!context) {
      error(res, "No active project", 404);
      return;
    }

    const body = JSON.parse(await readBody(req));

    if (body.phase) {
      context = setPhase(context, body.phase as Phase);
    }
    if (body.name) {
      context = { ...context, name: body.name };
    }
    if (body.description) {
      context = { ...context, description: body.description };
    }

    await storage.saveProject(context);
    json(res, context);
    return;
  }

  error(res, "Method not allowed", 405);
}

async function handleTasks(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const storage = await getStorage();
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const pathParts = url.pathname.split("/").filter(Boolean);

  let context = await storage.getActiveProject();
  if (!context) {
    error(res, "No active project", 404);
    return;
  }

  // GET /api/tasks - List tasks
  if (req.method === "GET" && pathParts.length === 2) {
    const includeDone = url.searchParams.get("include_completed") === "true";
    const tasks = includeDone ? context.tasks : getPendingTasks(context);
    json(res, { tasks });
    return;
  }

  // POST /api/tasks - Add task
  if (req.method === "POST" && pathParts.length === 2) {
    const body = JSON.parse(await readBody(req));
    const { title, description, priority, dependencies } = body;

    if (!title || !description) {
      error(res, "title and description are required");
      return;
    }

    const result = addTask(context, title, description, {
      priority,
      dependencies,
      assignedTo: AgentRole.EXECUTOR,
    });

    await storage.saveProject(result.context);
    json(res, result.task, 201);
    return;
  }

  // GET /api/tasks/:id - Get task
  if (req.method === "GET" && pathParts.length === 3) {
    const taskId = pathParts[2];
    const task = getTask(context, taskId);
    if (!task) {
      error(res, "Task not found", 404);
      return;
    }
    json(res, task);
    return;
  }

  // PUT /api/tasks/:id - Update task
  if (req.method === "PUT" && pathParts.length === 3) {
    const taskId = pathParts[2];
    const task = getTask(context, taskId);
    if (!task) {
      error(res, "Task not found", 404);
      return;
    }

    const body = JSON.parse(await readBody(req));

    if (body.status) {
      context = updateTaskStatus(context, taskId, body.status as TaskStatus);
    }
    if (body.note) {
      context = updateTaskNote(context, taskId, body.note);
    }

    await storage.saveProject(context);
    json(res, getTask(context, taskId));
    return;
  }

  // POST /api/tasks/:id/complete - Mark task complete
  if (req.method === "POST" && pathParts.length === 4 && pathParts[3] === "complete") {
    const taskId = pathParts[2];
    const task = getTask(context, taskId);
    if (!task) {
      error(res, "Task not found", 404);
      return;
    }

    const body = await readBody(req);
    if (body) {
      const { note } = JSON.parse(body);
      if (note) {
        context = updateTaskNote(context, taskId, note);
      }
    }

    context = updateTaskStatus(context, taskId, TaskStatus.COMPLETED);
    await storage.saveProject(context);
    json(res, getTask(context, taskId));
    return;
  }

  error(res, "Not found", 404);
}

async function handleNotes(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const storage = await getStorage();
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const pathParts = url.pathname.split("/").filter(Boolean);

  let context = await storage.getActiveProject();
  if (!context) {
    error(res, "No active project", 404);
    return;
  }

  // GET /api/notes - List notes
  if (req.method === "GET" && pathParts.length === 2) {
    const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
    json(res, { notes: context.notes.slice(-limit) });
    return;
  }

  // POST /api/notes - Add note
  if (req.method === "POST" && pathParts.length === 2) {
    const body = JSON.parse(await readBody(req));
    const { content, agent, category } = body;

    if (!content) {
      error(res, "content is required");
      return;
    }

    const result = addNote(
      context,
      (agent as AgentRole) ?? AgentRole.EXECUTOR,
      content,
      category ?? "general"
    );

    await storage.saveProject(result.context);
    json(res, result.note, 201);
    return;
  }

  error(res, "Not found", 404);
}

async function handleActive(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const storage = await getStorage();

  // POST /api/active - Set active project
  if (req.method === "POST") {
    const body = JSON.parse(await readBody(req));
    const { project_id } = body;

    if (!project_id) {
      error(res, "project_id is required");
      return;
    }

    const project = await storage.loadProject(project_id);
    if (!project) {
      error(res, "Project not found", 404);
      return;
    }

    await storage.setActiveProject(project_id);
    json(res, { active: project_id, project });
    return;
  }

  error(res, "Method not allowed", 405);
}

// ============================================================================
// OpenAPI Spec (for ChatGPT Actions / OpenAI Plugins)
// ============================================================================

function getOpenAPISpec(): object {
  return {
    openapi: "3.1.0",
    info: {
      title: "CortexFlow API",
      description: "AI-to-AI task continuation and project context sharing",
      version: "1.0.0",
    },
    servers: [{ url: `http://localhost:${PORT}` }],
    paths: {
      "/api/context": {
        get: {
          operationId: "readContext",
          summary: "Read active project context",
          responses: { "200": { description: "Project context" } },
        },
        put: {
          operationId: "updateContext",
          summary: "Update project phase or metadata",
          requestBody: {
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: { "200": { description: "Updated context" } },
        },
      },
      "/api/projects": {
        get: {
          operationId: "listProjects",
          summary: "List all projects",
          responses: { "200": { description: "Project list" } },
        },
        post: {
          operationId: "createProject",
          summary: "Create new project",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "description"],
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    phase: { type: "string" },
                    tasks: { type: "array" },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Created project" } },
        },
      },
      "/api/tasks": {
        get: {
          operationId: "listTasks",
          summary: "List tasks",
          responses: { "200": { description: "Task list" } },
        },
        post: {
          operationId: "addTask",
          summary: "Add new task",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title", "description"],
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Created task" } },
        },
      },
      "/api/tasks/{taskId}": {
        put: {
          operationId: "updateTask",
          summary: "Update task status",
          parameters: [{ name: "taskId", in: "path", required: true }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    note: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Updated task" } },
        },
      },
      "/api/tasks/{taskId}/complete": {
        post: {
          operationId: "completeTask",
          summary: "Mark task complete",
          parameters: [{ name: "taskId", in: "path", required: true }],
          responses: { "200": { description: "Completed task" } },
        },
      },
      "/api/notes": {
        get: {
          operationId: "listNotes",
          summary: "List project notes",
          responses: { "200": { description: "Note list" } },
        },
        post: {
          operationId: "addNote",
          summary: "Add note",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["content"],
                  properties: {
                    content: { type: "string" },
                    agent: { type: "string" },
                    category: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Created note" } },
        },
      },
      "/api/active": {
        post: {
          operationId: "setActiveProject",
          summary: "Set active project",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["project_id"],
                  properties: { project_id: { type: "string" } },
                },
              },
            },
          },
          responses: { "200": { description: "Active project set" } },
        },
      },
    },
  };
}

// ============================================================================
// Router
// ============================================================================

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // Health check
  if (url.pathname === "/" || url.pathname === "/health") {
    json(res, { status: "ok", service: "cortexflow", version: "1.0.0" });
    return;
  }

  // OpenAPI spec
  if (url.pathname === "/openapi.json") {
    json(res, getOpenAPISpec());
    return;
  }

  // API routes
  try {
    if (url.pathname.startsWith("/api/projects")) {
      await handleProjects(req, res);
    } else if (url.pathname.startsWith("/api/context")) {
      await handleContext(req, res);
    } else if (url.pathname.startsWith("/api/tasks")) {
      await handleTasks(req, res);
    } else if (url.pathname.startsWith("/api/notes")) {
      await handleNotes(req, res);
    } else if (url.pathname.startsWith("/api/active")) {
      await handleActive(req, res);
    } else {
      error(res, "Not found", 404);
    }
  } catch (err) {
    console.error("Request error:", err);
    error(res, err instanceof Error ? err.message : "Internal error", 500);
  }
}

// ============================================================================
// Server
// ============================================================================

export function runHttpServer(): void {
  const server = createHttpServer(handleRequest);

  server.listen(PORT, () => {
    console.log(`CortexFlow HTTP API running at http://localhost:${PORT}`);
    console.log(`OpenAPI spec: http://localhost:${PORT}/openapi.json`);
    console.log("");
    console.log("Endpoints:");
    console.log("  GET  /api/context          - Read active project");
    console.log("  POST /api/projects         - Create project");
    console.log("  GET  /api/tasks            - List tasks");
    console.log("  POST /api/tasks            - Add task");
    console.log("  PUT  /api/tasks/:id        - Update task");
    console.log("  POST /api/tasks/:id/complete - Complete task");
    console.log("  POST /api/notes            - Add note");
  });
}
