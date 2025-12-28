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
    AgentRole["TESTER"] = "tester";
    AgentRole["DOCUMENTER"] = "documenter";
    AgentRole["SECURITY"] = "security";
})(AgentRole || (AgentRole = {}));
// Event types for webhooks
export var EventType;
(function (EventType) {
    EventType["PROJECT_CREATED"] = "project.created";
    EventType["PROJECT_UPDATED"] = "project.updated";
    EventType["PROJECT_DELETED"] = "project.deleted";
    EventType["PHASE_CHANGED"] = "phase.changed";
    EventType["TASK_CREATED"] = "task.created";
    EventType["TASK_UPDATED"] = "task.updated";
    EventType["TASK_COMPLETED"] = "task.completed";
    EventType["TASK_BLOCKED"] = "task.blocked";
    EventType["NOTE_ADDED"] = "note.added";
    EventType["BLOCKER_ADDED"] = "blocker.added";
    EventType["SNAPSHOT_CREATED"] = "snapshot.created";
})(EventType || (EventType = {}));
// Audit action types
export var AuditAction;
(function (AuditAction) {
    AuditAction["CREATE"] = "create";
    AuditAction["UPDATE"] = "update";
    AuditAction["DELETE"] = "delete";
    AuditAction["RESTORE"] = "restore";
})(AuditAction || (AuditAction = {}));
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
export function createWebhook(url, events, options = {}) {
    return {
        id: generateId(),
        url,
        events,
        secret: options.secret,
        active: options.active ?? true,
        createdAt: timestamp(),
        lastTriggeredAt: null,
        failureCount: 0,
    };
}
export function createTemplate(name, description, tasks, options = {}) {
    return {
        id: generateId(),
        name,
        description,
        category: options.category ?? 'custom',
        tasks,
        defaultPhase: options.defaultPhase ?? Phase.PLANNING,
        tags: options.tags ?? [],
        createdAt: timestamp(),
        usageCount: 0,
    };
}
export function createSnapshot(project, name, description, createdBy = 'system') {
    return {
        id: generateId(),
        projectId: project.id,
        version: project.version,
        name,
        description,
        data: JSON.parse(JSON.stringify(project)), // Deep clone
        createdAt: timestamp(),
        createdBy,
    };
}
export function createAuditEntry(projectId, action, entityType, entityId, agent, changes, metadata) {
    return {
        id: generateId(),
        projectId,
        action,
        entityType,
        entityId,
        agent,
        timestamp: timestamp(),
        changes,
        metadata,
    };
}
export function createWebhookEvent(type, projectId, data) {
    return {
        id: generateId(),
        type,
        projectId,
        timestamp: timestamp(),
        data,
    };
}
// ============================================================================
// Built-in Templates
// ============================================================================
export const BUILT_IN_TEMPLATES = [
    {
        id: 'tpl-bugfix',
        name: 'Bug Fix',
        description: 'Standard bug fix workflow: reproduce, investigate, fix, test, document',
        category: 'bug-fix',
        tasks: [
            {
                title: 'Reproduce the bug',
                description: 'Create reliable reproduction steps',
                priority: 1,
                dependencies: [],
            },
            {
                title: 'Investigate root cause',
                description: 'Analyze code to find the source of the bug',
                priority: 1,
                dependencies: ['Reproduce the bug'],
            },
            {
                title: 'Implement fix',
                description: 'Write the code fix for the identified issue',
                priority: 1,
                dependencies: ['Investigate root cause'],
            },
            {
                title: 'Write tests',
                description: 'Add tests to prevent regression',
                priority: 2,
                dependencies: ['Implement fix'],
            },
            {
                title: 'Update documentation',
                description: 'Document the fix and any behavior changes',
                priority: 3,
                dependencies: ['Implement fix'],
            },
        ],
        defaultPhase: Phase.EXECUTION,
        tags: ['bug', 'fix', 'maintenance'],
        createdAt: '2024-01-01T00:00:00.000Z',
        usageCount: 0,
    },
    {
        id: 'tpl-feature',
        name: 'Feature Implementation',
        description: 'Full feature development workflow: design, implement, test, review, deploy',
        category: 'feature',
        tasks: [
            {
                title: 'Design feature',
                description: 'Create technical design and architecture',
                priority: 1,
                dependencies: [],
            },
            {
                title: 'Implement core functionality',
                description: 'Build the main feature logic',
                priority: 1,
                dependencies: ['Design feature'],
            },
            {
                title: 'Add UI/API layer',
                description: 'Create user-facing interface or API endpoints',
                priority: 2,
                dependencies: ['Implement core functionality'],
            },
            {
                title: 'Write unit tests',
                description: 'Add comprehensive unit test coverage',
                priority: 2,
                dependencies: ['Implement core functionality'],
            },
            {
                title: 'Write integration tests',
                description: 'Add integration and e2e tests',
                priority: 2,
                dependencies: ['Add UI/API layer'],
            },
            {
                title: 'Code review',
                description: 'Review code for quality and best practices',
                priority: 2,
                dependencies: ['Write unit tests'],
            },
            {
                title: 'Update documentation',
                description: 'Document the new feature',
                priority: 3,
                dependencies: ['Code review'],
            },
        ],
        defaultPhase: Phase.PLANNING,
        tags: ['feature', 'new', 'development'],
        createdAt: '2024-01-01T00:00:00.000Z',
        usageCount: 0,
    },
    {
        id: 'tpl-refactor',
        name: 'Code Refactoring',
        description: 'Safe refactoring workflow: analyze, plan, execute, validate',
        category: 'refactor',
        tasks: [
            {
                title: 'Analyze current code',
                description: 'Understand existing implementation and pain points',
                priority: 1,
                dependencies: [],
            },
            {
                title: 'Ensure test coverage',
                description: 'Add tests if missing to catch regressions',
                priority: 1,
                dependencies: ['Analyze current code'],
            },
            {
                title: 'Plan refactoring steps',
                description: 'Break down refactoring into safe incremental changes',
                priority: 1,
                dependencies: ['Ensure test coverage'],
            },
            {
                title: 'Execute refactoring',
                description: 'Implement the planned changes',
                priority: 1,
                dependencies: ['Plan refactoring steps'],
            },
            {
                title: 'Run all tests',
                description: 'Verify no regressions introduced',
                priority: 1,
                dependencies: ['Execute refactoring'],
            },
            {
                title: 'Performance validation',
                description: 'Ensure performance is not degraded',
                priority: 2,
                dependencies: ['Run all tests'],
            },
        ],
        defaultPhase: Phase.PLANNING,
        tags: ['refactor', 'cleanup', 'improvement'],
        createdAt: '2024-01-01T00:00:00.000Z',
        usageCount: 0,
    },
    {
        id: 'tpl-review',
        name: 'Code Review',
        description: 'Thorough code review workflow: security, quality, performance',
        category: 'review',
        tasks: [
            {
                title: 'Security review',
                description: 'Check for security vulnerabilities and issues',
                priority: 1,
                dependencies: [],
            },
            {
                title: 'Code quality review',
                description: 'Review code style, patterns, and best practices',
                priority: 2,
                dependencies: [],
            },
            {
                title: 'Performance review',
                description: 'Identify potential performance issues',
                priority: 2,
                dependencies: [],
            },
            {
                title: 'Test coverage review',
                description: 'Verify adequate test coverage exists',
                priority: 2,
                dependencies: [],
            },
            {
                title: 'Documentation review',
                description: 'Check documentation accuracy and completeness',
                priority: 3,
                dependencies: [],
            },
            {
                title: 'Compile findings',
                description: 'Summarize all findings and recommendations',
                priority: 1,
                dependencies: ['Security review', 'Code quality review', 'Performance review'],
            },
        ],
        defaultPhase: Phase.REVIEW,
        tags: ['review', 'audit', 'quality'],
        createdAt: '2024-01-01T00:00:00.000Z',
        usageCount: 0,
    },
];
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
export function getProjectAnalytics(context) {
    const completed = context.tasks.filter((t) => t.status === TaskStatus.COMPLETED);
    const pending = context.tasks.filter((t) => t.status === TaskStatus.PENDING || t.status === TaskStatus.IN_PROGRESS);
    const blocked = context.tasks.filter((t) => t.status === TaskStatus.BLOCKED);
    // Calculate agent stats
    const agentStatsMap = new Map();
    for (const role of Object.values(AgentRole)) {
        agentStatsMap.set(role, {
            agent: role,
            tasksCompleted: 0,
            tasksInProgress: 0,
            notesAdded: 0,
            avgCompletionTime: null,
        });
    }
    // Count tasks per agent
    for (const task of context.tasks) {
        if (task.assignedTo) {
            const stats = agentStatsMap.get(task.assignedTo);
            if (task.status === TaskStatus.COMPLETED) {
                stats.tasksCompleted++;
            }
            else if (task.status === TaskStatus.IN_PROGRESS) {
                stats.tasksInProgress++;
            }
        }
    }
    // Count notes per agent
    for (const note of context.notes) {
        const stats = agentStatsMap.get(note.agent);
        stats.notesAdded++;
    }
    // Calculate average task duration for completed tasks
    const durations = [];
    for (const task of completed) {
        if (task.completedAt && task.createdAt) {
            const duration = new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime();
            if (duration > 0) {
                durations.push(duration);
            }
        }
    }
    const avgTaskDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
    return {
        projectId: context.id,
        projectName: context.name,
        totalTasks: context.tasks.length,
        completedTasks: completed.length,
        pendingTasks: pending.length,
        blockedTasks: blocked.length,
        completionRate: context.tasks.length > 0 ? (completed.length / context.tasks.length) * 100 : 0,
        agentStats: Array.from(agentStatsMap.values()),
        phaseHistory: [{ phase: context.phase, timestamp: context.updatedAt }],
        avgTaskDuration,
        blockerCount: context.notes.filter((n) => n.category === 'blocker').length,
        decisionCount: context.notes.filter((n) => n.category === 'decision').length,
    };
}
// ============================================================================
// Export Functions
// ============================================================================
export function exportToMarkdown(context) {
    const lines = [];
    lines.push(`# ${context.name}`);
    lines.push('');
    lines.push(`> ${context.description}`);
    lines.push('');
    lines.push(`**Phase:** ${context.phase} | **Version:** ${context.version}`);
    lines.push(`**Created:** ${context.createdAt} | **Updated:** ${context.updatedAt}`);
    lines.push('');
    if (context.tags.length > 0) {
        lines.push(`**Tags:** ${context.tags.join(', ')}`);
        lines.push('');
    }
    // Tasks section
    lines.push('## Tasks');
    lines.push('');
    if (context.tasks.length === 0) {
        lines.push('_No tasks yet_');
    }
    else {
        for (const task of context.tasks) {
            const checkbox = task.status === TaskStatus.COMPLETED ? '[x]' : '[ ]';
            const priority = '!'.repeat(6 - task.priority); // !!!!! for priority 1
            const status = task.status !== TaskStatus.COMPLETED ? ` (${task.status})` : '';
            lines.push(`- ${checkbox} **${task.title}**${status} ${priority}`);
            lines.push(`  - ${task.description}`);
            if (task.assignedTo) {
                lines.push(`  - _Assigned to: ${task.assignedTo}_`);
            }
            if (task.notes.length > 0) {
                for (const note of task.notes) {
                    lines.push(`  - Note: ${note}`);
                }
            }
            if (task.dependencies.length > 0) {
                lines.push(`  - _Depends on: ${task.dependencies.join(', ')}_`);
            }
        }
    }
    lines.push('');
    // Notes section
    lines.push('## Agent Notes');
    lines.push('');
    if (context.notes.length === 0) {
        lines.push('_No notes yet_');
    }
    else {
        for (const note of context.notes) {
            const icon = note.category === 'decision'
                ? '🔷'
                : note.category === 'blocker'
                    ? '🔴'
                    : note.category === 'insight'
                        ? '💡'
                        : '📝';
            lines.push(`- ${icon} **[${note.agent}]** ${note.content}`);
            lines.push(`  - _${note.timestamp}_`);
        }
    }
    lines.push('');
    // Footer
    lines.push('---');
    lines.push(`_Exported from CortexFlow (ID: ${context.id})_`);
    return lines.join('\n');
}
export function cloneProject(context, newName, options = {}) {
    const now = timestamp();
    const cloned = {
        id: generateId(),
        name: newName,
        description: context.description,
        phase: Phase.PLANNING,
        version: 1,
        createdAt: now,
        updatedAt: now,
        tasks: options.resetTasks
            ? []
            : context.tasks.map((t) => ({
                ...t,
                id: generateId(),
                status: TaskStatus.PENDING,
                completedAt: null,
                notes: [],
                createdAt: now,
                updatedAt: now,
            })),
        notes: options.resetNotes ? [] : [],
        tags: [...context.tags],
        config: { ...context.config },
    };
    return cloned;
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
// ============================================================================
// Template Utilities
// ============================================================================
export function createProjectFromTemplate(template, projectName, projectDescription) {
    const now = new Date().toISOString();
    const taskIdMap = new Map(); // Map task titles to generated IDs
    // First pass: generate IDs for all tasks
    const tasks = template.tasks.map((t) => {
        const id = randomUUID().slice(0, 8);
        taskIdMap.set(t.title, id);
        return {
            id,
            title: t.title,
            description: t.description,
            status: TaskStatus.PENDING,
            priority: t.priority,
            assignedTo: AgentRole.EXECUTOR,
            createdAt: now,
            updatedAt: now,
            completedAt: null,
            notes: [],
            dependencies: [], // Will be filled in second pass
        };
    });
    // Second pass: resolve dependencies by title to ID
    template.tasks.forEach((t, index) => {
        tasks[index].dependencies = t.dependencies
            .map((depTitle) => taskIdMap.get(depTitle))
            .filter((id) => id !== undefined);
    });
    return {
        id: randomUUID().slice(0, 8),
        name: projectName,
        description: projectDescription ?? template.description,
        phase: template.defaultPhase,
        version: 1,
        createdAt: now,
        updatedAt: now,
        tasks,
        notes: [],
        tags: [...template.tags],
        config: { templateId: template.id, templateName: template.name },
    };
}
export function getTemplateById(templateId) {
    return BUILT_IN_TEMPLATES.find((t) => t.id === templateId);
}
export function getTemplatesByCategory(category) {
    return BUILT_IN_TEMPLATES.filter((t) => t.category === category);
}
// ============================================================================
// Snapshot Utilities
// ============================================================================
export function restoreFromSnapshot(snapshot) {
    // Deep clone the snapshot data to create a new project state
    const restored = JSON.parse(JSON.stringify(snapshot.data));
    restored.updatedAt = new Date().toISOString();
    return restored;
}
export function compareSnapshots(older, newer) {
    const olderTaskIds = new Set(older.data.tasks.map((t) => t.id));
    const newerTaskIds = new Set(newer.data.tasks.map((t) => t.id));
    const tasksAdded = newer.data.tasks.filter((t) => !olderTaskIds.has(t.id));
    const tasksRemoved = older.data.tasks.filter((t) => !newerTaskIds.has(t.id));
    const tasksModified = [];
    for (const newerTask of newer.data.tasks) {
        const olderTask = older.data.tasks.find((t) => t.id === newerTask.id);
        if (olderTask) {
            const changes = [];
            if (olderTask.status !== newerTask.status)
                changes.push(`status: ${olderTask.status} → ${newerTask.status}`);
            if (olderTask.title !== newerTask.title)
                changes.push(`title changed`);
            if (olderTask.notes.length !== newerTask.notes.length)
                changes.push(`notes: ${olderTask.notes.length} → ${newerTask.notes.length}`);
            if (changes.length > 0) {
                tasksModified.push({ taskId: newerTask.id, changes });
            }
        }
    }
    return {
        tasksAdded,
        tasksRemoved,
        tasksModified,
        notesAdded: newer.data.notes.length - older.data.notes.length,
        phaseChanged: older.data.phase !== newer.data.phase,
    };
}
// ============================================================================
// Audit Utilities
// ============================================================================
export function filterAuditLog(entries, options) {
    let filtered = entries;
    if (options.projectId) {
        filtered = filtered.filter((e) => e.projectId === options.projectId);
    }
    if (options.action) {
        filtered = filtered.filter((e) => e.action === options.action);
    }
    if (options.entityType) {
        filtered = filtered.filter((e) => e.entityType === options.entityType);
    }
    if (options.agent) {
        filtered = filtered.filter((e) => e.agent === options.agent);
    }
    if (options.since) {
        filtered = filtered.filter((e) => e.timestamp >= options.since);
    }
    if (options.until) {
        filtered = filtered.filter((e) => e.timestamp <= options.until);
    }
    // Sort by timestamp descending (newest first)
    filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    if (options.limit) {
        filtered = filtered.slice(0, options.limit);
    }
    return filtered;
}
//# sourceMappingURL=models.js.map