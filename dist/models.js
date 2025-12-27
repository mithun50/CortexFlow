/**
 * CortexFlow - Context Schema and Data Models
 *
 * Defines the shared context structure for AI-to-AI task continuation.
 * Supports project metadata, task lists, agent notes, and progress tracking.
 */
import { randomUUID } from "crypto";
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
export function createNote(agent, content, category = "general") {
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
export function addNote(context, agent, content, category = "general") {
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
/**
 * Validates all task dependencies in a project
 * Checks for circular dependencies and missing task references
 */
export function validateTaskDependencies(context) {
    const errors = [];
    const warnings = [];
    const taskIds = new Set(context.tasks.map((t) => t.id));
    // Check for missing task references
    for (const task of context.tasks) {
        for (const depId of task.dependencies) {
            if (!taskIds.has(depId)) {
                errors.push(`Task "${task.title}" (${task.id}) references non-existent dependency: ${depId}`);
            }
        }
    }
    // Check for circular dependencies
    const visited = new Set();
    const recursionStack = new Set();
    function hasCycle(taskId, path = []) {
        if (recursionStack.has(taskId)) {
            const cycle = [...path, taskId].join(" → ");
            errors.push(`Circular dependency detected: ${cycle}`);
            return true;
        }
        if (visited.has(taskId)) {
            return false;
        }
        visited.add(taskId);
        recursionStack.add(taskId);
        const task = context.tasks.find((t) => t.id === taskId);
        if (task) {
            for (const depId of task.dependencies) {
                if (hasCycle(depId, [...path, taskId])) {
                    return true;
                }
            }
        }
        recursionStack.delete(taskId);
        return false;
    }
    for (const task of context.tasks) {
        hasCycle(task.id);
    }
    // Check for completed tasks with incomplete dependencies
    for (const task of context.tasks) {
        if (task.status === TaskStatus.COMPLETED) {
            for (const depId of task.dependencies) {
                const dep = context.tasks.find((t) => t.id === depId);
                if (dep && dep.status !== TaskStatus.COMPLETED) {
                    warnings.push(`Task "${task.title}" is completed but dependency "${dep.title}" is not`);
                }
            }
        }
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
}
/**
 * Returns tasks in topological order (dependencies first)
 * Returns empty array if circular dependencies exist
 */
export function getTaskExecutionOrder(context) {
    const validation = validateTaskDependencies(context);
    if (!validation.isValid) {
        return []; // Cannot determine order with circular dependencies
    }
    const taskMap = new Map(context.tasks.map((t) => [t.id, t]));
    const visited = new Set();
    const result = [];
    function visit(taskId) {
        if (visited.has(taskId)) {
            return;
        }
        visited.add(taskId);
        const task = taskMap.get(taskId);
        if (!task) {
            return;
        }
        // Visit dependencies first
        for (const depId of task.dependencies) {
            visit(depId);
        }
        result.push(task);
    }
    for (const task of context.tasks) {
        visit(task.id);
    }
    return result;
}
/**
 * Checks if a task can be started (all dependencies are completed)
 */
export function canStartTask(context, taskId) {
    const task = getTask(context, taskId);
    if (!task) {
        return false;
    }
    // Already completed or in progress
    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.IN_PROGRESS) {
        return false;
    }
    // Check all dependencies are completed
    for (const depId of task.dependencies) {
        const dep = getTask(context, depId);
        if (!dep || dep.status !== TaskStatus.COMPLETED) {
            return false;
        }
    }
    return true;
}
/**
 * Returns tasks that are blocked by incomplete dependencies
 */
export function getBlockedTasks(context) {
    return context.tasks.filter((task) => {
        if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED) {
            return false;
        }
        // Check if any dependency is not completed
        return task.dependencies.some((depId) => {
            const dep = getTask(context, depId);
            return !dep || dep.status !== TaskStatus.COMPLETED;
        });
    });
}
/**
 * Returns tasks that can be started right now
 */
export function getReadyTasks(context) {
    return context.tasks.filter((task) => canStartTask(context, task.id));
}
/**
 * Generates a graph representation of task dependencies
 */
export function getTaskGraph(context) {
    const nodes = [];
    // Build dependency graph
    for (const task of context.tasks) {
        const dependents = [];
        // Find tasks that depend on this one
        for (const otherTask of context.tasks) {
            if (otherTask.dependencies.includes(task.id)) {
                dependents.push(otherTask.id);
            }
        }
        nodes.push({
            id: task.id,
            title: task.title,
            status: task.status,
            dependencies: task.dependencies,
            dependents,
        });
    }
    const executionOrder = getTaskExecutionOrder(context).map((t) => t.id);
    const blockedTasks = getBlockedTasks(context).map((t) => t.id);
    const readyTasks = getReadyTasks(context).map((t) => t.id);
    return {
        nodes,
        executionOrder,
        blockedTasks,
        readyTasks,
    };
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