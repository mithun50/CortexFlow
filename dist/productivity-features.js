/**
 * CortexFlow - Productivity Features
 *
 * Personal productivity tools: Todo/Did lists, CLAUDE.md export,
 * session memory, prompt templates, and time tracking.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
// ============================================================================
// Storage Paths
// ============================================================================
const DATA_DIR = process.env.CORTEXFLOW_DATA_DIR ?? join(process.cwd(), '.cortexflow');
const PERSONAL_FILE = join(DATA_DIR, '.personal.json');
const MEMORY_FILE = join(DATA_DIR, '.memory.json');
const TIME_TRACKING_FILE = join(DATA_DIR, '.timetracking.json');
// ============================================================================
// Built-in Prompt Templates
// ============================================================================
export const BUILT_IN_PROMPTS = [
    {
        id: 'prompt-plan',
        name: 'Project Planning',
        category: 'planning',
        template: `You are helping plan a project called "{{project_name}}".

Current Status:
- Phase: {{phase}}
- Tasks: {{task_count}} total, {{completed_count}} completed
- Blockers: {{blocker_count}}

Goals:
{{description}}

Please help me:
1. Break down the remaining work into actionable tasks
2. Identify dependencies and blockers
3. Suggest a priority order for execution`,
        variables: [
            'project_name',
            'phase',
            'task_count',
            'completed_count',
            'blocker_count',
            'description',
        ],
        description: 'Create a structured project plan with priorities',
        isBuiltIn: true,
    },
    {
        id: 'prompt-debug',
        name: 'Debugging Assistant',
        category: 'debugging',
        template: `I'm debugging an issue in project "{{project_name}}".

Current task: {{current_task}}
Task description: {{task_description}}

The problem:
{{problem_description}}

What I've tried:
{{attempted_solutions}}

Please help me:
1. Identify possible root causes
2. Suggest debugging steps
3. Recommend fixes`,
        variables: [
            'project_name',
            'current_task',
            'task_description',
            'problem_description',
            'attempted_solutions',
        ],
        description: 'Systematic debugging assistance',
        isBuiltIn: true,
    },
    {
        id: 'prompt-review',
        name: 'Code Review',
        category: 'review',
        template: `Please review the changes for project "{{project_name}}".

Changes made:
{{changes_summary}}

Focus areas:
- Code quality and best practices
- Potential bugs or edge cases
- Performance considerations
- Security implications

Completed tasks:
{{completed_tasks}}`,
        variables: ['project_name', 'changes_summary', 'completed_tasks'],
        description: 'Comprehensive code review template',
        isBuiltIn: true,
    },
    {
        id: 'prompt-handoff',
        name: 'AI Handoff',
        category: 'planning',
        template: `# Project Handoff: {{project_name}}

## Context
{{description}}

## Current Phase: {{phase}}

## Completed Work
{{completed_tasks}}

## Remaining Tasks
{{pending_tasks}}

## Important Notes
{{notes}}

## Next Steps
Please continue from where we left off. The immediate priority is:
{{next_priority}}`,
        variables: [
            'project_name',
            'description',
            'phase',
            'completed_tasks',
            'pending_tasks',
            'notes',
            'next_priority',
        ],
        description: 'Handoff context to another AI agent',
        isBuiltIn: true,
    },
    {
        id: 'prompt-standup',
        name: 'Daily Standup',
        category: 'planning',
        template: `# Daily Standup - {{date}}

## Project: {{project_name}}

### What was completed yesterday:
{{yesterday_completed}}

### What's planned for today:
{{today_planned}}

### Blockers:
{{blockers}}

### Notes:
{{notes}}`,
        variables: [
            'date',
            'project_name',
            'yesterday_completed',
            'today_planned',
            'blockers',
            'notes',
        ],
        description: 'Daily standup summary template',
        isBuiltIn: true,
    },
];
// ============================================================================
// Helper Functions
// ============================================================================
async function ensureDir(path) {
    try {
        await mkdir(path, { recursive: true });
    }
    catch {
        // Directory exists
    }
}
function generateId() {
    return Math.random().toString(36).substring(2, 10);
}
// ============================================================================
// Personal Todo/Did List Functions
// ============================================================================
async function loadPersonalData() {
    try {
        const content = await readFile(PERSONAL_FILE, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return {
            todos: [],
            dids: [],
            dailyGoals: [],
            weeklyGoals: [],
        };
    }
}
async function savePersonalData(data) {
    await ensureDir(DATA_DIR);
    await writeFile(PERSONAL_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
export async function addPersonalTodo(content, options = {}) {
    const data = await loadPersonalData();
    const todo = {
        id: `todo-${generateId()}`,
        content,
        priority: options.priority ?? 3,
        tags: options.tags ?? [],
        createdAt: new Date().toISOString(),
        dueDate: options.dueDate,
        context: options.context,
    };
    data.todos.push(todo);
    await savePersonalData(data);
    return todo;
}
export async function listPersonalTodos(options = {}) {
    const data = await loadPersonalData();
    let todos = data.todos;
    if (options.tag) {
        todos = todos.filter((t) => t.tags.includes(options.tag));
    }
    if (options.priority) {
        todos = todos.filter((t) => t.priority === options.priority);
    }
    // Sort by priority (1 = highest) then by creation date
    todos.sort((a, b) => {
        if (a.priority !== b.priority)
            return a.priority - b.priority;
        return a.createdAt.localeCompare(b.createdAt);
    });
    return todos;
}
export async function completeTodo(todoId, options = {}) {
    const data = await loadPersonalData();
    const todoIndex = data.todos.findIndex((t) => t.id === todoId);
    if (todoIndex < 0)
        return null;
    const todo = data.todos[todoIndex];
    const didItem = {
        id: `did-${generateId()}`,
        content: todo.content,
        completedAt: new Date().toISOString(),
        tags: todo.tags,
        originalTodoId: todo.id,
        duration: options.duration,
        reflection: options.reflection,
    };
    data.dids.push(didItem);
    data.todos.splice(todoIndex, 1);
    await savePersonalData(data);
    return didItem;
}
export async function listDids(options = {}) {
    const data = await loadPersonalData();
    let dids = data.dids;
    if (options.since) {
        dids = dids.filter((d) => d.completedAt >= options.since);
    }
    if (options.tag) {
        dids = dids.filter((d) => d.tags.includes(options.tag));
    }
    // Sort by completion date descending
    dids.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    if (options.limit) {
        dids = dids.slice(0, options.limit);
    }
    return dids;
}
export async function setDailyGoals(goals) {
    const data = await loadPersonalData();
    data.dailyGoals = goals;
    await savePersonalData(data);
}
export async function setWeeklyGoals(goals) {
    const data = await loadPersonalData();
    data.weeklyGoals = goals;
    await savePersonalData(data);
}
export async function getGoals() {
    const data = await loadPersonalData();
    return {
        daily: data.dailyGoals,
        weekly: data.weeklyGoals,
    };
}
// ============================================================================
// Session Memory Functions
// ============================================================================
async function loadMemory() {
    try {
        const content = await readFile(MEMORY_FILE, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return {
            memories: [],
            lastUpdated: new Date().toISOString(),
        };
    }
}
async function saveMemory(store) {
    await ensureDir(DATA_DIR);
    store.lastUpdated = new Date().toISOString();
    await writeFile(MEMORY_FILE, JSON.stringify(store, null, 2), 'utf-8');
}
export async function remember(key, value, options = {}) {
    const store = await loadMemory();
    // Remove existing memory with same key
    store.memories = store.memories.filter((m) => m.key !== key);
    const memory = {
        id: `mem-${generateId()}`,
        key,
        value,
        category: options.category ?? 'context',
        createdAt: new Date().toISOString(),
        projectId: options.projectId,
    };
    if (options.expiresIn) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + options.expiresIn);
        memory.expiresAt = expiresAt.toISOString();
    }
    store.memories.push(memory);
    await saveMemory(store);
    return memory;
}
export async function recall(key) {
    const store = await loadMemory();
    const memory = store.memories.find((m) => m.key === key);
    if (!memory)
        return null;
    // Check expiration
    if (memory.expiresAt && new Date(memory.expiresAt) < new Date()) {
        // Memory expired, remove it
        store.memories = store.memories.filter((m) => m.id !== memory.id);
        await saveMemory(store);
        return null;
    }
    return memory.value;
}
export async function listMemories(options = {}) {
    const store = await loadMemory();
    const now = new Date();
    // Filter out expired memories
    let memories = store.memories.filter((m) => !m.expiresAt || new Date(m.expiresAt) > now);
    if (options.category) {
        memories = memories.filter((m) => m.category === options.category);
    }
    if (options.projectId) {
        memories = memories.filter((m) => m.projectId === options.projectId);
    }
    return memories;
}
export async function forget(key) {
    const store = await loadMemory();
    const originalLength = store.memories.length;
    store.memories = store.memories.filter((m) => m.key !== key);
    if (store.memories.length < originalLength) {
        await saveMemory(store);
        return true;
    }
    return false;
}
export async function forgetAll(options = {}) {
    const store = await loadMemory();
    const originalLength = store.memories.length;
    if (options.category) {
        store.memories = store.memories.filter((m) => m.category !== options.category);
    }
    else if (options.projectId) {
        store.memories = store.memories.filter((m) => m.projectId !== options.projectId);
    }
    else {
        store.memories = [];
    }
    await saveMemory(store);
    return originalLength - store.memories.length;
}
// ============================================================================
// Time Tracking Functions
// ============================================================================
async function loadTimeTracking() {
    try {
        const content = await readFile(TIME_TRACKING_FILE, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return { entries: [] };
    }
}
async function saveTimeTracking(data) {
    await ensureDir(DATA_DIR);
    await writeFile(TIME_TRACKING_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
export async function startTimeTracking(taskId, projectId, notes) {
    const data = await loadTimeTracking();
    // Stop any active entry first
    if (data.activeEntry) {
        await stopTimeTracking();
    }
    const entry = {
        id: `time-${generateId()}`,
        taskId,
        projectId,
        startedAt: new Date().toISOString(),
        notes,
    };
    data.activeEntry = entry;
    await saveTimeTracking(data);
    return entry;
}
export async function stopTimeTracking(notes) {
    const data = await loadTimeTracking();
    if (!data.activeEntry)
        return null;
    const entry = data.activeEntry;
    entry.endedAt = new Date().toISOString();
    entry.duration = Math.round((new Date(entry.endedAt).getTime() - new Date(entry.startedAt).getTime()) / 60000);
    if (notes)
        entry.notes = notes;
    data.entries.push(entry);
    data.activeEntry = undefined;
    await saveTimeTracking(data);
    return entry;
}
export async function getActiveTimeEntry() {
    const data = await loadTimeTracking();
    return data.activeEntry ?? null;
}
export async function getTimeEntries(options = {}) {
    const data = await loadTimeTracking();
    let entries = data.entries;
    if (options.projectId) {
        entries = entries.filter((e) => e.projectId === options.projectId);
    }
    if (options.taskId) {
        entries = entries.filter((e) => e.taskId === options.taskId);
    }
    if (options.since) {
        entries = entries.filter((e) => e.startedAt >= options.since);
    }
    // Sort by start time descending
    entries.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    if (options.limit) {
        entries = entries.slice(0, options.limit);
    }
    return entries;
}
export async function getTimeStats(projectId) {
    const entries = await getTimeEntries({ projectId });
    const totalMinutes = entries.reduce((sum, e) => sum + (e.duration ?? 0), 0);
    const taskBreakdown = {};
    entries.forEach((e) => {
        taskBreakdown[e.taskId] = (taskBreakdown[e.taskId] ?? 0) + (e.duration ?? 0);
    });
    const durations = entries.map((e) => e.duration ?? 0).filter((d) => d > 0);
    const averageSessionLength = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const longestSession = durations.length > 0 ? Math.max(...durations) : 0;
    return {
        totalMinutes,
        taskBreakdown,
        averageSessionLength,
        longestSession,
    };
}
// ============================================================================
// Prompt Template Functions
// ============================================================================
export function listPromptTemplates(category) {
    if (category) {
        return BUILT_IN_PROMPTS.filter((p) => p.category === category);
    }
    return BUILT_IN_PROMPTS;
}
export function getPromptTemplate(id) {
    return BUILT_IN_PROMPTS.find((p) => p.id === id) ?? null;
}
export function fillPromptTemplate(template, variables) {
    let result = template.template;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    // Replace any remaining unfilled variables with [MISSING]
    result = result.replace(/{{[\w_]+}}/g, '[MISSING]');
    return result;
}
export function generatePromptFromContext(context, templateId) {
    const template = getPromptTemplate(templateId);
    if (!template)
        return null;
    const completedTasks = context.tasks.filter((t) => t.status === 'completed');
    const pendingTasks = context.tasks.filter((t) => t.status === 'pending');
    const blockedTasks = context.tasks.filter((t) => t.status === 'blocked');
    const inProgressTasks = context.tasks.filter((t) => t.status === 'in_progress');
    const variables = {
        project_name: context.name,
        description: context.description,
        phase: context.phase,
        task_count: context.tasks.length.toString(),
        completed_count: completedTasks.length.toString(),
        pending_count: pendingTasks.length.toString(),
        blocker_count: blockedTasks.length.toString(),
        completed_tasks: completedTasks.map((t) => `- ${t.title}`).join('\n') || 'None',
        pending_tasks: pendingTasks.map((t) => `- [P${t.priority}] ${t.title}`).join('\n') || 'None',
        blockers: blockedTasks.map((t) => `- ${t.title}`).join('\n') || 'None',
        notes: context.notes.map((n) => `- [${n.category}] ${n.content}`).join('\n') || 'None',
        next_priority: inProgressTasks[0]?.title ?? pendingTasks[0]?.title ?? 'No pending tasks',
        date: new Date().toISOString().split('T')[0],
    };
    return fillPromptTemplate(template, variables);
}
// ============================================================================
// CLAUDE.md Export Functions
// ============================================================================
export function generateClaudeMd(context, format = 'standard') {
    let content = '';
    if (format === 'minimal') {
        // Minimal format - just the essentials
        content = `# ${context.name}

${context.description}

## Status: ${context.phase}

## Tasks
${context.tasks.map((t) => `- [${t.status === 'completed' ? 'x' : ' '}] ${t.title}`).join('\n')}
`;
    }
    else if (format === 'standard') {
        // Standard format - balanced detail
        const completedTasks = context.tasks.filter((t) => t.status === 'completed');
        const pendingTasks = context.tasks.filter((t) => t.status !== 'completed');
        content = `# ${context.name}

> ${context.description}

## Project Status

- **Phase**: ${context.phase}
- **Version**: ${context.version}
- **Progress**: ${completedTasks.length}/${context.tasks.length} tasks completed

## Pending Tasks

${pendingTasks
            .map((t) => `### ${t.status === 'in_progress' ? '🔄' : t.status === 'blocked' ? '🚫' : '📋'} ${t.title}
- Priority: ${t.priority}
- Status: ${t.status}
${t.description ? `- Description: ${t.description}` : ''}
${t.dependencies.length > 0 ? `- Dependencies: ${t.dependencies.join(', ')}` : ''}
`)
            .join('\n')}

## Completed Tasks

${completedTasks.map((t) => `- ✅ ${t.title}`).join('\n') || 'None yet'}

## Notes

${context.notes
            .map((n) => `### ${n.category.toUpperCase()} (${n.agent})
${n.content}
`)
            .join('\n') || 'No notes yet'}

---
*Generated by CortexFlow on ${new Date().toISOString()}*
`;
    }
    else {
        // Detailed format - everything
        content = `# ${context.name}

> ${context.description}

## Metadata

| Property | Value |
|----------|-------|
| ID | ${context.id} |
| Phase | ${context.phase} |
| Version | ${context.version} |
| Created | ${context.createdAt} |
| Updated | ${context.updatedAt} |
| Tags | ${context.tags.join(', ') || 'None'} |

## Progress Overview

- **Total Tasks**: ${context.tasks.length}
- **Completed**: ${context.tasks.filter((t) => t.status === 'completed').length}
- **In Progress**: ${context.tasks.filter((t) => t.status === 'in_progress').length}
- **Blocked**: ${context.tasks.filter((t) => t.status === 'blocked').length}
- **Pending**: ${context.tasks.filter((t) => t.status === 'pending').length}

## All Tasks

${context.tasks
            .map((t) => `### ${getStatusEmoji(t.status)} ${t.title}

| Property | Value |
|----------|-------|
| ID | \`${t.id}\` |
| Status | ${t.status} |
| Priority | ${t.priority} |
| Created | ${t.createdAt} |
| Updated | ${t.updatedAt} |
${t.dependencies.length > 0 ? `| Dependencies | ${t.dependencies.join(', ')} |` : ''}

**Description**: ${t.description || 'No description'}

${t.notes.length > 0 ? `**Task Notes**:\n${t.notes.map((n) => `- ${n}`).join('\n')}` : ''}
`)
            .join('\n---\n\n')}

## Agent Notes

${context.notes
            .map((n) => `### ${getCategoryEmoji(n.category)} ${n.category.toUpperCase()}

- **Agent**: ${n.agent}
- **Time**: ${n.timestamp}

${n.content}
`)
            .join('\n---\n\n') || 'No notes recorded'}

## Instructions for Next AI

1. Read this context to understand the project state
2. Check the pending tasks and their priorities
3. Review any blocker notes before proceeding
4. Update task status as you work using CortexFlow
5. Add notes for important decisions or blockers

---
*Generated by CortexFlow v2.0.0 on ${new Date().toISOString()}*
*Save this file as CLAUDE.md in your project root for automatic context loading*
`;
    }
    return {
        format,
        content,
        generatedAt: new Date().toISOString(),
        projectId: context.id,
    };
}
function getStatusEmoji(status) {
    switch (status) {
        case 'completed':
            return '✅';
        case 'in_progress':
            return '🔄';
        case 'blocked':
            return '🚫';
        case 'cancelled':
            return '❌';
        default:
            return '📋';
    }
}
function getCategoryEmoji(category) {
    switch (category) {
        case 'decision':
            return '🎯';
        case 'blocker':
            return '🚧';
        case 'insight':
            return '💡';
        default:
            return '📝';
    }
}
export async function saveClaudeMd(context, outputPath, format = 'standard') {
    const exported = generateClaudeMd(context, format);
    await writeFile(outputPath, exported.content, 'utf-8');
    return outputPath;
}
export async function getDailyDigest(projectId) {
    const today = new Date().toISOString().split('T')[0];
    const todayStart = `${today}T00:00:00.000Z`;
    const [todos, dids, goals, memories, timeEntries] = await Promise.all([
        listPersonalTodos(),
        listDids({ since: todayStart }),
        getGoals(),
        listMemories({ category: 'reminder' }),
        getTimeEntries({ since: todayStart }),
    ]);
    // Find todos with due dates within 3 days
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const upcomingDeadlines = todos.filter((t) => t.dueDate && new Date(t.dueDate) <= threeDaysFromNow);
    return {
        date: today,
        todosCount: todos.length,
        didsCount: dids.length,
        activeProject: projectId,
        upcomingDeadlines,
        recentCompletions: dids.slice(0, 5),
        goals,
        timeTracked: timeEntries.reduce((sum, e) => sum + (e.duration ?? 0), 0),
        memories,
    };
}
export async function getProductivityStats(period = 'week') {
    const now = new Date();
    let since;
    switch (period) {
        case 'day':
            since = new Date(now.setHours(0, 0, 0, 0)).toISOString();
            break;
        case 'week': {
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            since = weekAgo.toISOString();
            break;
        }
        case 'month': {
            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            since = monthAgo.toISOString();
            break;
        }
    }
    const dids = await listDids({ since });
    const timeEntries = await getTimeEntries({ since });
    // Calculate tag frequency
    const tagCounts = {};
    dids.forEach((d) => {
        d.tags.forEach((tag) => {
            tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
        });
    });
    const topTags = Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    // Calculate average completion time
    const completionTimes = dids.filter((d) => d.duration).map((d) => d.duration);
    const averageCompletionTime = completionTimes.length > 0
        ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
        : 0;
    // Calculate streak (consecutive days with completions)
    const completionDays = new Set(dids.map((d) => d.completedAt.split('T')[0]));
    let streakDays = 0;
    const checkDate = new Date();
    while (completionDays.has(checkDate.toISOString().split('T')[0])) {
        streakDays++;
        checkDate.setDate(checkDate.getDate() - 1);
    }
    return {
        period,
        tasksCompleted: dids.length,
        averageCompletionTime,
        topTags,
        streakDays,
        totalTimeTracked: timeEntries.reduce((sum, e) => sum + (e.duration ?? 0), 0),
    };
}
//# sourceMappingURL=productivity-features.js.map