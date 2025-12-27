/**
 * CortexFlow - Context Schema and Data Models
 *
 * Defines the shared context structure for AI-to-AI task continuation.
 * Supports project metadata, task lists, agent notes, and progress tracking.
 */
import { randomUUID } from 'crypto';
// ============================================================================
// Enums
// ============================================================================
export var Phase;
(function (Phase) {
    Phase["PLANNING"] = "planning";
    Phase["EXECUTION"] = "execution";
    Phase["REVIEW"] = "review";
    Phase["COMPLETED"] = "completed";
})(Phase || (Phase = {}));
export var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PENDING"] = "pending";
    TaskStatus["IN_PROGRESS"] = "in_progress";
    TaskStatus["BLOCKED"] = "blocked";
    TaskStatus["COMPLETED"] = "completed";
    TaskStatus["CANCELLED"] = "cancelled";
})(TaskStatus || (TaskStatus = {}));
export var AgentRole;
(function (AgentRole) {
    AgentRole["PLANNER"] = "planner";
    AgentRole["EXECUTOR"] = "executor";
    AgentRole["REVIEWER"] = "reviewer";
})(AgentRole || (AgentRole = {}));
// ============================================================================
// Factory Functions
// ============================================================================
function generateId() {
    return randomUUID().slice(0, 8);
}
function timestamp() {
    return new Date().toISOString();
}
export function createTask(title, description, options = {}) {
    const now = timestamp();
    return {
        id: generateId(),
        title,
        description,
        status: options.status ?? TaskStatus.PENDING,
        priority: options.priority ?? 1,
        assignedTo: options.assignedTo ?? null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        notes: options.notes ?? [],
        dependencies: options.dependencies ?? [],
    };
}
export function createNote(agent, content, category = 'general') {
    return {
        id: generateId(),
        agent,
        content,
        timestamp: timestamp(),
        category,
    };
}
export function createProject(name, description, options = {}) {
    const now = timestamp();
    return {
        id: generateId(),
        name,
        description,
        phase: options.phase ?? Phase.PLANNING,
        version: 1,
        createdAt: now,
        updatedAt: now,
        tasks: options.tasks ?? [],
        notes: options.notes ?? [],
        tags: options.tags ?? [],
        config: options.config ?? {},
    };
}
// ============================================================================
// Context Utilities
// ============================================================================
export function bumpVersion(context) {
    return {
        ...context,
        version: context.version + 1,
        updatedAt: timestamp(),
    };
}
export function addTask(context, title, description, options = {}) {
    const task = createTask(title, description, options);
    const updated = bumpVersion({
        ...context,
        tasks: [...context.tasks, task],
    });
    return { context: updated, task };
}
export function addNote(context, agent, content, category = 'general') {
    const note = createNote(agent, content, category);
    const updated = bumpVersion({
        ...context,
        notes: [...context.notes, note],
    });
    return { context: updated, note };
}
export function updateTaskStatus(context, taskId, status) {
    const now = timestamp();
    const tasks = context.tasks.map((t) => {
        if (t.id === taskId) {
            return {
                ...t,
                status,
                updatedAt: now,
                completedAt: status === TaskStatus.COMPLETED ? now : t.completedAt,
            };
        }
        return t;
    });
    return bumpVersion({ ...context, tasks });
}
export function updateTaskNote(context, taskId, note) {
    const now = timestamp();
    const tasks = context.tasks.map((t) => {
        if (t.id === taskId) {
            return {
                ...t,
                notes: [...t.notes, note],
                updatedAt: now,
            };
        }
        return t;
    });
    return bumpVersion({ ...context, tasks });
}
export function setPhase(context, phase) {
    return bumpVersion({ ...context, phase });
}
export function getTask(context, taskId) {
    return context.tasks.find((t) => t.id === taskId);
}
export function getPendingTasks(context) {
    return context.tasks.filter((t) => t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.CANCELLED);
}
export function getProjectSummary(context) {
    const completed = context.tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
    const total = context.tasks.length;
    const pending = getPendingTasks(context).length;
    return `Project: ${context.name}
Phase: ${context.phase}
Tasks: ${completed}/${total} completed, ${pending} pending
Version: ${context.version}
Last Updated: ${context.updatedAt}`;
}
// ============================================================================
// Serialization
// ============================================================================
export function serializeContext(context) {
    return JSON.stringify(context, null, 2);
}
export function deserializeContext(json) {
    return JSON.parse(json);
}
//# sourceMappingURL=models.js.map