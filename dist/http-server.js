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
import { createServer as createHttpServer } from 'http';
import { getStorage } from './storage.js';
import { getAdvancedStorage } from './advanced-storage.js';
import { analyzeCriticalPath, getSmartPriorityQueue, compressContext, getCompressionStats, calculateHealthScore, executeBatchOperations, generateTaskSuggestions, } from './intelligent-features.js';
import { addPersonalTodo, listPersonalTodos, completeTodo, listDids, setDailyGoals, setWeeklyGoals, getGoals, remember, recall, listMemories, forget, startTimeTracking, stopTimeTracking, getTimeStats, listPromptTemplates, generatePromptFromContext, generateClaudeMd, saveClaudeMd, getDailyDigest, getProductivityStats, } from './productivity-features.js';
import { TaskStatus, AgentRole, createProject, addTask, addNote, updateTaskStatus, updateTaskNote, setPhase, getTask, getPendingTasks, getProjectSummary, getProjectAnalytics, exportToMarkdown, cloneProject, createWebhook, createSnapshot, createProjectFromTemplate, restoreFromSnapshot, } from './models.js';
const PORT = parseInt(process.env.CORTEXFLOW_PORT ?? '3210', 10);
// ============================================================================
// HTTP Utilities
// ============================================================================
async function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}
async function parseBody(req) {
    const text = await readBody(req);
    if (!text)
        return {};
    return JSON.parse(text);
}
function json(res, data, status = 200) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify(data, null, 2));
}
function error(res, message, status = 400) {
    json(res, { error: message }, status);
}
// ============================================================================
// Route Handlers
// ============================================================================
async function handleProjects(req, res) {
    const storage = await getStorage();
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // GET /api/projects - List all projects
    if (req.method === 'GET' && pathParts.length === 2) {
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
    if (req.method === 'POST' && pathParts.length === 2) {
        const body = JSON.parse(await readBody(req));
        const { name, description, phase, tasks, tags } = body;
        if (!name || !description) {
            error(res, 'name and description are required');
            return;
        }
        let context = createProject(name, description, {
            phase: phase,
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
    if (req.method === 'GET' && pathParts.length === 3) {
        const projectId = pathParts[2];
        const project = await storage.loadProject(projectId);
        if (!project) {
            error(res, 'Project not found', 404);
            return;
        }
        json(res, project);
        return;
    }
    // DELETE /api/projects/:id - Delete project
    if (req.method === 'DELETE' && pathParts.length === 3) {
        const projectId = pathParts[2];
        const deleted = await storage.deleteProject(projectId);
        if (!deleted) {
            error(res, 'Project not found', 404);
            return;
        }
        json(res, { deleted: true });
        return;
    }
    error(res, 'Not found', 404);
}
async function handleContext(req, res) {
    const storage = await getStorage();
    // GET /api/context - Read active project context
    if (req.method === 'GET') {
        const context = await storage.getActiveProject();
        if (!context) {
            error(res, 'No active project', 404);
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
    if (req.method === 'PUT') {
        let context = await storage.getActiveProject();
        if (!context) {
            error(res, 'No active project', 404);
            return;
        }
        const body = JSON.parse(await readBody(req));
        if (body.phase) {
            context = setPhase(context, body.phase);
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
    error(res, 'Method not allowed', 405);
}
async function handleTasks(req, res) {
    const storage = await getStorage();
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    let context = await storage.getActiveProject();
    if (!context) {
        error(res, 'No active project', 404);
        return;
    }
    // GET /api/tasks - List tasks
    if (req.method === 'GET' && pathParts.length === 2) {
        const includeDone = url.searchParams.get('include_completed') === 'true';
        const tasks = includeDone ? context.tasks : getPendingTasks(context);
        json(res, { tasks });
        return;
    }
    // POST /api/tasks - Add task
    if (req.method === 'POST' && pathParts.length === 2) {
        const body = JSON.parse(await readBody(req));
        const { title, description, priority, dependencies } = body;
        if (!title || !description) {
            error(res, 'title and description are required');
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
    if (req.method === 'GET' && pathParts.length === 3) {
        const taskId = pathParts[2];
        const task = getTask(context, taskId);
        if (!task) {
            error(res, 'Task not found', 404);
            return;
        }
        json(res, task);
        return;
    }
    // PUT /api/tasks/:id - Update task
    if (req.method === 'PUT' && pathParts.length === 3) {
        const taskId = pathParts[2];
        const task = getTask(context, taskId);
        if (!task) {
            error(res, 'Task not found', 404);
            return;
        }
        const body = JSON.parse(await readBody(req));
        if (body.status) {
            context = updateTaskStatus(context, taskId, body.status);
        }
        if (body.note) {
            context = updateTaskNote(context, taskId, body.note);
        }
        await storage.saveProject(context);
        json(res, getTask(context, taskId));
        return;
    }
    // POST /api/tasks/:id/complete - Mark task complete
    if (req.method === 'POST' && pathParts.length === 4 && pathParts[3] === 'complete') {
        const taskId = pathParts[2];
        const task = getTask(context, taskId);
        if (!task) {
            error(res, 'Task not found', 404);
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
    error(res, 'Not found', 404);
}
async function handleNotes(req, res) {
    const storage = await getStorage();
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const context = await storage.getActiveProject();
    if (!context) {
        error(res, 'No active project', 404);
        return;
    }
    // GET /api/notes - List notes
    if (req.method === 'GET' && pathParts.length === 2) {
        const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
        json(res, { notes: context.notes.slice(-limit) });
        return;
    }
    // POST /api/notes - Add note
    if (req.method === 'POST' && pathParts.length === 2) {
        const body = JSON.parse(await readBody(req));
        const { content, agent, category } = body;
        if (!content) {
            error(res, 'content is required');
            return;
        }
        const result = addNote(context, agent ?? AgentRole.EXECUTOR, content, category ?? 'general');
        await storage.saveProject(result.context);
        json(res, result.note, 201);
        return;
    }
    error(res, 'Not found', 404);
}
async function handleActive(req, res) {
    const storage = await getStorage();
    // POST /api/active - Set active project
    if (req.method === 'POST') {
        const body = JSON.parse(await readBody(req));
        const { project_id } = body;
        if (!project_id) {
            error(res, 'project_id is required');
            return;
        }
        const project = await storage.loadProject(project_id);
        if (!project) {
            error(res, 'Project not found', 404);
            return;
        }
        await storage.setActiveProject(project_id);
        json(res, { active: project_id, project });
        return;
    }
    error(res, 'Method not allowed', 405);
}
async function handleAnalytics(req, res) {
    const storage = await getStorage();
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const projectId = url.searchParams.get('project_id');
    // GET /api/analytics - Get project analytics
    if (req.method === 'GET') {
        let context;
        if (projectId) {
            context = await storage.loadProject(projectId);
        }
        else {
            context = await storage.getActiveProject();
        }
        if (!context) {
            error(res, 'No project found', 404);
            return;
        }
        const analytics = getProjectAnalytics(context);
        json(res, analytics);
        return;
    }
    error(res, 'Method not allowed', 405);
}
async function handleExport(req, res) {
    const storage = await getStorage();
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const projectId = url.searchParams.get('project_id');
    const format = url.searchParams.get('format') ?? 'markdown';
    // GET /api/export - Export project
    if (req.method === 'GET') {
        let context;
        if (projectId) {
            context = await storage.loadProject(projectId);
        }
        else {
            context = await storage.getActiveProject();
        }
        if (!context) {
            error(res, 'No project found', 404);
            return;
        }
        if (format === 'markdown' || format === 'md') {
            const markdown = exportToMarkdown(context);
            res.writeHead(200, {
                'Content-Type': 'text/markdown',
                'Access-Control-Allow-Origin': '*',
                'Content-Disposition': `attachment; filename="${context.name.replace(/[^a-z0-9]/gi, '_')}.md"`,
            });
            res.end(markdown);
            return;
        }
        else if (format === 'json') {
            json(res, context);
            return;
        }
        error(res, 'Unsupported format. Use: markdown, md, or json');
        return;
    }
    error(res, 'Method not allowed', 405);
}
async function handleClone(req, res) {
    const storage = await getStorage();
    // POST /api/clone - Clone a project
    if (req.method === 'POST') {
        const body = JSON.parse(await readBody(req));
        const { project_id, new_name, reset_tasks, reset_notes } = body;
        if (!new_name) {
            error(res, 'new_name is required');
            return;
        }
        let context;
        if (project_id) {
            context = await storage.loadProject(project_id);
        }
        else {
            context = await storage.getActiveProject();
        }
        if (!context) {
            error(res, 'No project found', 404);
            return;
        }
        const cloned = cloneProject(context, new_name, {
            resetTasks: reset_tasks !== false, // default true
            resetNotes: reset_notes !== false, // default true
        });
        await storage.saveProject(cloned);
        json(res, {
            original: { id: context.id, name: context.name },
            cloned: cloned,
        }, 201);
        return;
    }
    error(res, 'Method not allowed', 405);
}
// ============================================================================
// Intelligent Features Handlers
// ============================================================================
async function handleCriticalPath(req, res) {
    const storage = await getStorage();
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const projectId = url.searchParams.get('project_id');
    if (req.method === 'GET') {
        let context;
        if (projectId) {
            context = await storage.loadProject(projectId);
        }
        else {
            context = await storage.getActiveProject();
        }
        if (!context) {
            error(res, 'No project found', 404);
            return;
        }
        const analysis = analyzeCriticalPath(context);
        json(res, analysis);
        return;
    }
    error(res, 'Method not allowed', 405);
}
async function handleSmartQueue(req, res) {
    const storage = await getStorage();
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const projectId = url.searchParams.get('project_id');
    const limit = parseInt(url.searchParams.get('limit') ?? '5', 10);
    if (req.method === 'GET') {
        let context;
        if (projectId) {
            context = await storage.loadProject(projectId);
        }
        else {
            context = await storage.getActiveProject();
        }
        if (!context) {
            error(res, 'No project found', 404);
            return;
        }
        const queue = getSmartPriorityQueue(context, limit);
        json(res, { queue, count: queue.length });
        return;
    }
    error(res, 'Method not allowed', 405);
}
async function handleCompress(req, res) {
    const storage = await getStorage();
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const projectId = url.searchParams.get('project_id');
    const includeCompleted = url.searchParams.get('include_completed') === 'true';
    const maxNotes = parseInt(url.searchParams.get('max_notes') ?? '10', 10);
    if (req.method === 'GET') {
        let context;
        if (projectId) {
            context = await storage.loadProject(projectId);
        }
        else {
            context = await storage.getActiveProject();
        }
        if (!context) {
            error(res, 'No project found', 404);
            return;
        }
        const compressed = compressContext(context, {
            includeCompletedTasks: includeCompleted,
            maxNotes,
        });
        const stats = getCompressionStats(context, compressed);
        json(res, { compressed, stats });
        return;
    }
    error(res, 'Method not allowed', 405);
}
async function handleHealthScore(req, res) {
    const storage = await getStorage();
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const projectId = url.searchParams.get('project_id');
    if (req.method === 'GET') {
        let context;
        if (projectId) {
            context = await storage.loadProject(projectId);
        }
        else {
            context = await storage.getActiveProject();
        }
        if (!context) {
            error(res, 'No project found', 404);
            return;
        }
        const health = calculateHealthScore(context);
        json(res, health);
        return;
    }
    error(res, 'Method not allowed', 405);
}
async function handleBatch(req, res) {
    const storage = await getStorage();
    if (req.method === 'POST') {
        const body = JSON.parse(await readBody(req));
        const { project_id, operations } = body;
        if (!operations || !Array.isArray(operations)) {
            error(res, 'operations array is required');
            return;
        }
        let context;
        if (project_id) {
            context = await storage.loadProject(project_id);
        }
        else {
            context = await storage.getActiveProject();
        }
        if (!context) {
            error(res, 'No project found', 404);
            return;
        }
        const result = executeBatchOperations(context, operations);
        if (result.success) {
            await storage.saveProject(result.context);
        }
        json(res, result, result.success ? 200 : 400);
        return;
    }
    error(res, 'Method not allowed', 405);
}
async function handleSuggestions(req, res) {
    const storage = await getStorage();
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const projectId = url.searchParams.get('project_id');
    if (req.method === 'GET') {
        let context;
        if (projectId) {
            context = await storage.loadProject(projectId);
        }
        else {
            context = await storage.getActiveProject();
        }
        if (!context) {
            error(res, 'No project found', 404);
            return;
        }
        const suggestions = generateTaskSuggestions(context);
        json(res, { suggestions, count: suggestions.length });
        return;
    }
    error(res, 'Method not allowed', 405);
}
// ============================================================================
// Advanced Features Handlers (Webhooks, Templates, Snapshots)
// ============================================================================
async function handleWebhooks(req, res) {
    const advanced = await getAdvancedStorage();
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // GET /api/webhooks - List all webhooks
    if (req.method === 'GET' && pathParts.length === 2) {
        const webhooks = await advanced.webhooks.listWebhooks();
        json(res, { webhooks });
        return;
    }
    // POST /api/webhooks - Register webhook
    if (req.method === 'POST' && pathParts.length === 2) {
        const body = JSON.parse(await readBody(req));
        const { url: webhookUrl, events, secret } = body;
        if (!webhookUrl || !events) {
            error(res, 'url and events are required');
            return;
        }
        const webhook = createWebhook(webhookUrl, events, { secret });
        await advanced.webhooks.saveWebhook(webhook);
        json(res, webhook, 201);
        return;
    }
    // DELETE /api/webhooks/:id
    if (req.method === 'DELETE' && pathParts.length === 3) {
        const webhookId = pathParts[2];
        const deleted = await advanced.webhooks.deleteWebhook(webhookId);
        if (!deleted) {
            error(res, 'Webhook not found', 404);
            return;
        }
        json(res, { deleted: true });
        return;
    }
    error(res, 'Not found', 404);
}
async function handleTemplates(req, res) {
    const storage = await getStorage();
    const advanced = await getAdvancedStorage();
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // GET /api/templates - List templates
    if (req.method === 'GET' && pathParts.length === 2) {
        const templates = await advanced.templates.listTemplates();
        json(res, { templates });
        return;
    }
    // POST /api/templates/create - Create project from template
    if (req.method === 'POST' && pathParts.length === 3 && pathParts[2] === 'create') {
        const body = JSON.parse(await readBody(req));
        const { template_id, project_name, project_description } = body;
        if (!template_id || !project_name) {
            error(res, 'template_id and project_name are required');
            return;
        }
        const template = await advanced.templates.getTemplate(template_id);
        if (!template) {
            error(res, 'Template not found', 404);
            return;
        }
        const project = createProjectFromTemplate(template, project_name, project_description);
        await storage.saveProject(project);
        await storage.setActiveProject(project.id);
        await advanced.templates.incrementUsage(template_id);
        json(res, project, 201);
        return;
    }
    error(res, 'Not found', 404);
}
async function handleSnapshots(req, res) {
    const storage = await getStorage();
    const advanced = await getAdvancedStorage();
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const projectId = url.searchParams.get('project_id');
    // GET /api/snapshots - List snapshots
    if (req.method === 'GET' && pathParts.length === 2) {
        let targetProjectId;
        if (projectId) {
            targetProjectId = projectId;
        }
        else {
            const active = await storage.getActiveProject();
            targetProjectId = active?.id;
        }
        if (!targetProjectId) {
            error(res, 'No project found', 404);
            return;
        }
        const snapshots = await advanced.snapshots.listSnapshots(targetProjectId);
        json(res, { snapshots });
        return;
    }
    // POST /api/snapshots - Create snapshot
    if (req.method === 'POST' && pathParts.length === 2) {
        const body = JSON.parse(await readBody(req));
        const { name, description, project_id: bodyProjectId } = body;
        if (!name) {
            error(res, 'name is required');
            return;
        }
        let context;
        if (bodyProjectId) {
            context = await storage.loadProject(bodyProjectId);
        }
        else {
            context = await storage.getActiveProject();
        }
        if (!context) {
            error(res, 'No project found', 404);
            return;
        }
        const snapshot = createSnapshot(context, name, description ?? '', AgentRole.EXECUTOR);
        await advanced.snapshots.saveSnapshot(snapshot);
        json(res, snapshot, 201);
        return;
    }
    // POST /api/snapshots/:id/restore - Restore snapshot
    if (req.method === 'POST' && pathParts.length === 4 && pathParts[3] === 'restore') {
        const snapshotId = pathParts[2];
        const snapshot = await advanced.snapshots.getSnapshot(snapshotId);
        if (!snapshot) {
            error(res, 'Snapshot not found', 404);
            return;
        }
        const restored = restoreFromSnapshot(snapshot);
        await storage.saveProject(restored);
        json(res, restored);
        return;
    }
    error(res, 'Not found', 404);
}
async function handleAudit(req, res) {
    const storage = await getStorage();
    const advanced = await getAdvancedStorage();
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const projectId = url.searchParams.get('project_id');
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const since = url.searchParams.get('since') ?? undefined;
    if (req.method === 'GET') {
        let targetProjectId;
        if (projectId) {
            targetProjectId = projectId;
        }
        else {
            const active = await storage.getActiveProject();
            targetProjectId = active?.id;
        }
        if (!targetProjectId) {
            error(res, 'No project found', 404);
            return;
        }
        const entries = await advanced.audit.listEntries({
            projectId: targetProjectId,
            limit,
            since,
        });
        json(res, { entries, count: entries.length });
        return;
    }
    error(res, 'Method not allowed', 405);
}
// ============================================================================
// Productivity Handlers
// ============================================================================
async function handlePersonalTodos(req, res) {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    if (req.method === 'GET') {
        const tag = url.searchParams.get('tag') ?? undefined;
        const priority = url.searchParams.get('priority')
            ? parseInt(url.searchParams.get('priority'), 10)
            : undefined;
        const todos = await listPersonalTodos({ tag, priority });
        json(res, { todos, count: todos.length });
        return;
    }
    if (req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.content) {
            error(res, 'content is required', 400);
            return;
        }
        const todo = await addPersonalTodo(body.content, {
            priority: body.priority,
            tags: body.tags,
            dueDate: body.due_date,
            context: body.context,
        });
        json(res, todo, 201);
        return;
    }
    error(res, 'Method not allowed', 405);
}
async function handlePersonalTodoComplete(req, res) {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const parts = url.pathname.split('/');
    const todoId = parts[3]; // /api/personal-todos/:id/complete
    if (req.method === 'POST') {
        const body = await parseBody(req);
        const did = await completeTodo(todoId, {
            reflection: body.reflection,
            duration: body.duration,
        });
        if (!did) {
            error(res, 'Todo not found', 404);
            return;
        }
        json(res, did);
        return;
    }
    error(res, 'Method not allowed', 405);
}
async function handleDids(req, res) {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    if (req.method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
        const since = url.searchParams.get('since') ?? undefined;
        const tag = url.searchParams.get('tag') ?? undefined;
        const dids = await listDids({ limit, since, tag });
        json(res, { dids, count: dids.length });
        return;
    }
    error(res, 'Method not allowed', 405);
}
async function handleGoals(req, res) {
    if (req.method === 'GET') {
        const goals = await getGoals();
        json(res, goals);
        return;
    }
    if (req.method === 'PUT' || req.method === 'POST') {
        const body = await parseBody(req);
        if (body.daily)
            await setDailyGoals(body.daily);
        if (body.weekly)
            await setWeeklyGoals(body.weekly);
        const goals = await getGoals();
        json(res, goals);
        return;
    }
    error(res, 'Method not allowed', 405);
}
async function handleMemory(req, res) {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    if (req.method === 'GET') {
        // List memories or recall specific key
        const key = url.searchParams.get('key');
        if (key) {
            const value = await recall(key);
            if (value === null) {
                error(res, 'Memory not found', 404);
                return;
            }
            json(res, { key, value });
            return;
        }
        const category = url.searchParams.get('category');
        const projectId = url.searchParams.get('project_id') ?? undefined;
        const memories = await listMemories({ category, projectId });
        json(res, { memories, count: memories.length });
        return;
    }
    if (req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.key || !body.value) {
            error(res, 'key and value are required', 400);
            return;
        }
        const memory = await remember(body.key, body.value, {
            category: body.category,
            expiresIn: body.expires_in,
            projectId: body.project_id,
        });
        json(res, memory, 201);
        return;
    }
    if (req.method === 'DELETE') {
        const key = url.searchParams.get('key');
        if (!key) {
            error(res, 'key parameter required', 400);
            return;
        }
        const forgotten = await forget(key);
        if (!forgotten) {
            error(res, 'Memory not found', 404);
            return;
        }
        json(res, { success: true, key });
        return;
    }
    error(res, 'Method not allowed', 405);
}
async function handleTimeTracking(req, res) {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    if (url.pathname.endsWith('/start') && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.task_id || !body.project_id) {
            error(res, 'task_id and project_id are required', 400);
            return;
        }
        const entry = await startTimeTracking(body.task_id, body.project_id, body.notes);
        json(res, entry, 201);
        return;
    }
    if (url.pathname.endsWith('/stop') && req.method === 'POST') {
        const body = await parseBody(req);
        const entry = await stopTimeTracking(body.notes);
        if (!entry) {
            error(res, 'No active time tracking', 400);
            return;
        }
        json(res, entry);
        return;
    }
    if (url.pathname.endsWith('/stats') && req.method === 'GET') {
        const projectId = url.searchParams.get('project_id');
        if (!projectId) {
            error(res, 'project_id parameter required', 400);
            return;
        }
        const stats = await getTimeStats(projectId);
        json(res, stats);
        return;
    }
    error(res, 'Method not allowed', 405);
}
async function handlePromptTemplates(req, res) {
    const storage = await getStorage();
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    if (url.pathname.endsWith('/generate') && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.template_id) {
            error(res, 'template_id is required', 400);
            return;
        }
        const projectId = body.project_id;
        let context;
        if (projectId) {
            context = await storage.loadProject(projectId);
        }
        else {
            context = await storage.getActiveProject();
        }
        if (!context) {
            error(res, 'No project found', 404);
            return;
        }
        const prompt = generatePromptFromContext(context, body.template_id);
        if (!prompt) {
            error(res, 'Template not found', 404);
            return;
        }
        json(res, { prompt });
        return;
    }
    if (req.method === 'GET') {
        const category = url.searchParams.get('category');
        const templates = listPromptTemplates(category);
        json(res, { templates, count: templates.length });
        return;
    }
    error(res, 'Method not allowed', 405);
}
async function handleExportMd(req, res) {
    const storage = await getStorage();
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    if (req.method === 'GET' || req.method === 'POST') {
        const projectId = url.searchParams.get('project_id');
        const format = url.searchParams.get('format') ?? 'standard';
        const target = url.searchParams.get('target') ?? 'claude';
        let context;
        if (projectId) {
            context = await storage.loadProject(projectId);
        }
        else {
            context = await storage.getActiveProject();
        }
        if (!context) {
            error(res, 'No project found', 404);
            return;
        }
        const exported = generateClaudeMd(context, format);
        let content = exported.content;
        // Add target-specific header
        if (target !== 'claude') {
            const targetHeaders = {
                gemini: '<!-- For Google Gemini AI -->\n',
                chatgpt: '<!-- For OpenAI ChatGPT -->\n',
                cursor: '<!-- For Cursor AI -->\n',
                copilot: '<!-- For GitHub Copilot -->\n',
            };
            content = (targetHeaders[target.toLowerCase()] ?? '') + content;
        }
        // Check if saving to file
        if (req.method === 'POST') {
            const body = await parseBody(req);
            if (body.save_path) {
                await saveClaudeMd(context, body.save_path, format);
                json(res, { saved: true, path: body.save_path, format, target });
                return;
            }
        }
        json(res, { content, format, target, projectId: context.id });
        return;
    }
    error(res, 'Method not allowed', 405);
}
async function handleDigest(req, res) {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    if (req.method === 'GET') {
        const projectId = url.searchParams.get('project_id') ?? undefined;
        const digest = await getDailyDigest(projectId);
        json(res, digest);
        return;
    }
    error(res, 'Method not allowed', 405);
}
async function handleProductivityStats(req, res) {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    if (req.method === 'GET') {
        const period = url.searchParams.get('period') ?? 'week';
        const stats = await getProductivityStats(period);
        json(res, stats);
        return;
    }
    error(res, 'Method not allowed', 405);
}
// ============================================================================
// OpenAPI Spec (for ChatGPT Actions / OpenAI Plugins)
// ============================================================================
function getOpenAPISpec() {
    return {
        openapi: '3.1.0',
        info: {
            title: 'CortexFlow API',
            description: 'AI-to-AI task continuation and project context sharing',
            version: '1.0.0',
        },
        servers: [{ url: `http://localhost:${PORT}` }],
        paths: {
            '/api/context': {
                get: {
                    operationId: 'readContext',
                    summary: 'Read active project context',
                    responses: { '200': { description: 'Project context' } },
                },
                put: {
                    operationId: 'updateContext',
                    summary: 'Update project phase or metadata',
                    requestBody: {
                        content: { 'application/json': { schema: { type: 'object' } } },
                    },
                    responses: { '200': { description: 'Updated context' } },
                },
            },
            '/api/projects': {
                get: {
                    operationId: 'listProjects',
                    summary: 'List all projects',
                    responses: { '200': { description: 'Project list' } },
                },
                post: {
                    operationId: 'createProject',
                    summary: 'Create new project',
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['name', 'description'],
                                    properties: {
                                        name: { type: 'string' },
                                        description: { type: 'string' },
                                        phase: { type: 'string' },
                                        tasks: { type: 'array' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '201': { description: 'Created project' } },
                },
            },
            '/api/tasks': {
                get: {
                    operationId: 'listTasks',
                    summary: 'List tasks',
                    responses: { '200': { description: 'Task list' } },
                },
                post: {
                    operationId: 'addTask',
                    summary: 'Add new task',
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['title', 'description'],
                                    properties: {
                                        title: { type: 'string' },
                                        description: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '201': { description: 'Created task' } },
                },
            },
            '/api/tasks/{taskId}': {
                put: {
                    operationId: 'updateTask',
                    summary: 'Update task status',
                    parameters: [{ name: 'taskId', in: 'path', required: true }],
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string' },
                                        note: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '200': { description: 'Updated task' } },
                },
            },
            '/api/tasks/{taskId}/complete': {
                post: {
                    operationId: 'completeTask',
                    summary: 'Mark task complete',
                    parameters: [{ name: 'taskId', in: 'path', required: true }],
                    responses: { '200': { description: 'Completed task' } },
                },
            },
            '/api/notes': {
                get: {
                    operationId: 'listNotes',
                    summary: 'List project notes',
                    responses: { '200': { description: 'Note list' } },
                },
                post: {
                    operationId: 'addNote',
                    summary: 'Add note',
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['content'],
                                    properties: {
                                        content: { type: 'string' },
                                        agent: { type: 'string' },
                                        category: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '201': { description: 'Created note' } },
                },
            },
            '/api/active': {
                post: {
                    operationId: 'setActiveProject',
                    summary: 'Set active project',
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['project_id'],
                                    properties: { project_id: { type: 'string' } },
                                },
                            },
                        },
                    },
                    responses: { '200': { description: 'Active project set' } },
                },
            },
            '/api/analytics': {
                get: {
                    operationId: 'getAnalytics',
                    summary: 'Get project analytics',
                    parameters: [
                        { name: 'project_id', in: 'query', required: false, schema: { type: 'string' } },
                    ],
                    responses: {
                        '200': {
                            description: 'Project analytics including task stats, agent performance, and metrics',
                        },
                    },
                },
            },
            '/api/export': {
                get: {
                    operationId: 'exportProject',
                    summary: 'Export project to Markdown or JSON',
                    parameters: [
                        { name: 'project_id', in: 'query', required: false, schema: { type: 'string' } },
                        {
                            name: 'format',
                            in: 'query',
                            required: false,
                            schema: { type: 'string', enum: ['markdown', 'md', 'json'] },
                        },
                    ],
                    responses: {
                        '200': { description: 'Exported project content' },
                    },
                },
            },
            '/api/clone': {
                post: {
                    operationId: 'cloneProject',
                    summary: 'Clone a project with optional resets',
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['new_name'],
                                    properties: {
                                        project_id: {
                                            type: 'string',
                                            description: 'Project to clone (uses active if omitted)',
                                        },
                                        new_name: { type: 'string', description: 'Name for cloned project' },
                                        reset_tasks: {
                                            type: 'boolean',
                                            description: 'Reset tasks to pending (default: true)',
                                        },
                                        reset_notes: { type: 'boolean', description: 'Clear notes (default: true)' },
                                    },
                                },
                            },
                        },
                    },
                    responses: { '201': { description: 'Cloned project' } },
                },
            },
        },
    };
}
// ============================================================================
// Router
// ============================================================================
async function handleRequest(req, res) {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
        return;
    }
    // Health check
    if (url.pathname === '/' || url.pathname === '/health') {
        json(res, { status: 'ok', service: 'cortexflow', version: '1.0.0' });
        return;
    }
    // OpenAPI spec
    if (url.pathname === '/openapi.json') {
        json(res, getOpenAPISpec());
        return;
    }
    // API routes
    try {
        if (url.pathname.startsWith('/api/projects')) {
            await handleProjects(req, res);
        }
        else if (url.pathname.startsWith('/api/context')) {
            await handleContext(req, res);
        }
        else if (url.pathname.startsWith('/api/tasks')) {
            await handleTasks(req, res);
        }
        else if (url.pathname.startsWith('/api/notes')) {
            await handleNotes(req, res);
        }
        else if (url.pathname.startsWith('/api/active')) {
            await handleActive(req, res);
        }
        else if (url.pathname.startsWith('/api/analytics')) {
            await handleAnalytics(req, res);
        }
        else if (url.pathname.startsWith('/api/export')) {
            await handleExport(req, res);
        }
        else if (url.pathname.startsWith('/api/clone')) {
            await handleClone(req, res);
        }
        else if (url.pathname.startsWith('/api/critical-path')) {
            await handleCriticalPath(req, res);
        }
        else if (url.pathname.startsWith('/api/smart-queue')) {
            await handleSmartQueue(req, res);
        }
        else if (url.pathname.startsWith('/api/compress')) {
            await handleCompress(req, res);
        }
        else if (url.pathname.startsWith('/api/health-score')) {
            await handleHealthScore(req, res);
        }
        else if (url.pathname.startsWith('/api/batch')) {
            await handleBatch(req, res);
        }
        else if (url.pathname.startsWith('/api/suggestions')) {
            await handleSuggestions(req, res);
        }
        else if (url.pathname.startsWith('/api/webhooks')) {
            await handleWebhooks(req, res);
        }
        else if (url.pathname.startsWith('/api/templates')) {
            await handleTemplates(req, res);
        }
        else if (url.pathname.startsWith('/api/snapshots')) {
            await handleSnapshots(req, res);
        }
        else if (url.pathname.startsWith('/api/audit')) {
            await handleAudit(req, res);
        }
        else if (url.pathname.match(/^\/api\/personal-todos\/[^/]+\/complete/)) {
            await handlePersonalTodoComplete(req, res);
        }
        else if (url.pathname.startsWith('/api/personal-todos')) {
            await handlePersonalTodos(req, res);
        }
        else if (url.pathname.startsWith('/api/dids')) {
            await handleDids(req, res);
        }
        else if (url.pathname.startsWith('/api/goals')) {
            await handleGoals(req, res);
        }
        else if (url.pathname.startsWith('/api/memory')) {
            await handleMemory(req, res);
        }
        else if (url.pathname.startsWith('/api/time-tracking')) {
            await handleTimeTracking(req, res);
        }
        else if (url.pathname.startsWith('/api/prompts')) {
            await handlePromptTemplates(req, res);
        }
        else if (url.pathname.startsWith('/api/export-md')) {
            await handleExportMd(req, res);
        }
        else if (url.pathname.startsWith('/api/digest')) {
            await handleDigest(req, res);
        }
        else if (url.pathname.startsWith('/api/productivity-stats')) {
            await handleProductivityStats(req, res);
        }
        else {
            error(res, 'Not found', 404);
        }
    }
    catch (err) {
        console.error('Request error:', err);
        error(res, err instanceof Error ? err.message : 'Internal error', 500);
    }
}
// ============================================================================
// Server
// ============================================================================
export function runHttpServer() {
    const server = createHttpServer(handleRequest);
    server.listen(PORT, () => {
        console.log(`CortexFlow HTTP API running at http://localhost:${PORT}`);
        console.log(`OpenAPI spec: http://localhost:${PORT}/openapi.json`);
        console.log('');
        console.log('Core Endpoints:');
        console.log('  GET  /api/context            - Read active project');
        console.log('  POST /api/projects           - Create project');
        console.log('  GET  /api/tasks              - List tasks');
        console.log('  POST /api/tasks              - Add task');
        console.log('  PUT  /api/tasks/:id          - Update task');
        console.log('  POST /api/tasks/:id/complete - Complete task');
        console.log('  POST /api/notes              - Add note');
        console.log('  GET  /api/analytics          - Get project analytics');
        console.log('  GET  /api/export             - Export project');
        console.log('  POST /api/clone              - Clone a project');
        console.log('');
        console.log('Intelligent Features:');
        console.log('  GET  /api/critical-path      - Analyze task dependencies');
        console.log('  GET  /api/smart-queue        - Get prioritized task queue');
        console.log('  GET  /api/compress           - Get compressed context');
        console.log('  GET  /api/health-score       - Get project health score');
        console.log('  POST /api/batch              - Execute batch operations');
        console.log('  GET  /api/suggestions        - Get AI suggestions');
        console.log('');
        console.log('Advanced Features:');
        console.log('  GET  /api/webhooks           - List webhooks');
        console.log('  POST /api/webhooks           - Register webhook');
        console.log('  GET  /api/templates          - List templates');
        console.log('  POST /api/templates/create   - Create from template');
        console.log('  GET  /api/snapshots          - List snapshots');
        console.log('  POST /api/snapshots          - Create snapshot');
        console.log('  GET  /api/audit              - Get audit log');
        console.log('');
        console.log('Productivity Features:');
        console.log('  GET  /api/personal-todos     - List personal todos');
        console.log('  POST /api/personal-todos     - Add personal todo');
        console.log('  POST /api/personal-todos/:id/complete - Complete todo');
        console.log('  GET  /api/dids               - List completed items');
        console.log('  GET  /api/goals              - Get goals');
        console.log('  PUT  /api/goals              - Set goals');
        console.log('  GET  /api/memory             - List memories');
        console.log('  POST /api/memory             - Remember something');
        console.log('  DELETE /api/memory?key=...   - Forget memory');
        console.log('  POST /api/time-tracking/start- Start time tracking');
        console.log('  POST /api/time-tracking/stop - Stop time tracking');
        console.log('  GET  /api/time-tracking/stats- Get time stats');
        console.log('  GET  /api/prompts            - List prompt templates');
        console.log('  POST /api/prompts/generate   - Generate filled prompt');
        console.log('  GET  /api/export-md          - Export for AI (claude/gemini/chatgpt)');
        console.log('  GET  /api/digest             - Get daily digest');
        console.log('  GET  /api/productivity-stats - Get productivity stats');
    });
}
//# sourceMappingURL=http-server.js.map