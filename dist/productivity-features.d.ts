/**
 * CortexFlow - Productivity Features
 *
 * Personal productivity tools: Todo/Did lists, CLAUDE.md export,
 * session memory, prompt templates, and time tracking.
 */
import { ProjectContext } from './models.js';
export interface PersonalTodo {
    id: string;
    content: string;
    priority: 1 | 2 | 3 | 4 | 5;
    tags: string[];
    createdAt: string;
    dueDate?: string;
    context?: string;
}
export interface DidItem {
    id: string;
    content: string;
    completedAt: string;
    duration?: number;
    tags: string[];
    originalTodoId?: string;
    reflection?: string;
}
export interface PersonalData {
    todos: PersonalTodo[];
    dids: DidItem[];
    dailyGoals: string[];
    weeklyGoals: string[];
}
export interface SessionMemory {
    id: string;
    key: string;
    value: string;
    category: 'preference' | 'decision' | 'context' | 'learning' | 'reminder';
    createdAt: string;
    expiresAt?: string;
    projectId?: string;
}
export interface MemoryStore {
    memories: SessionMemory[];
    lastUpdated: string;
}
export interface TimeEntry {
    id: string;
    taskId: string;
    projectId: string;
    startedAt: string;
    endedAt?: string;
    duration?: number;
    notes?: string;
}
export interface TimeTrackingData {
    entries: TimeEntry[];
    activeEntry?: TimeEntry;
}
export interface PromptTemplate {
    id: string;
    name: string;
    category: 'planning' | 'coding' | 'debugging' | 'review' | 'documentation' | 'custom';
    template: string;
    variables: string[];
    description: string;
    isBuiltIn: boolean;
}
export interface ClaudeMdExport {
    format: 'minimal' | 'standard' | 'detailed';
    content: string;
    generatedAt: string;
    projectId: string;
}
export declare const BUILT_IN_PROMPTS: PromptTemplate[];
export declare function addPersonalTodo(content: string, options?: {
    priority?: 1 | 2 | 3 | 4 | 5;
    tags?: string[];
    dueDate?: string;
    context?: string;
}): Promise<PersonalTodo>;
export declare function listPersonalTodos(options?: {
    tag?: string;
    priority?: number;
    includeCompleted?: boolean;
}): Promise<PersonalTodo[]>;
export declare function completeTodo(todoId: string, options?: {
    reflection?: string;
    duration?: number;
}): Promise<DidItem | null>;
export declare function listDids(options?: {
    limit?: number;
    since?: string;
    tag?: string;
}): Promise<DidItem[]>;
export declare function setDailyGoals(goals: string[]): Promise<void>;
export declare function setWeeklyGoals(goals: string[]): Promise<void>;
export declare function getGoals(): Promise<{
    daily: string[];
    weekly: string[];
}>;
export declare function remember(key: string, value: string, options?: {
    category?: SessionMemory['category'];
    expiresIn?: number;
    projectId?: string;
}): Promise<SessionMemory>;
export declare function recall(key: string): Promise<string | null>;
export declare function listMemories(options?: {
    category?: SessionMemory['category'];
    projectId?: string;
}): Promise<SessionMemory[]>;
export declare function forget(key: string): Promise<boolean>;
export declare function forgetAll(options?: {
    category?: SessionMemory['category'];
    projectId?: string;
}): Promise<number>;
export declare function startTimeTracking(taskId: string, projectId: string, notes?: string): Promise<TimeEntry>;
export declare function stopTimeTracking(notes?: string): Promise<TimeEntry | null>;
export declare function getActiveTimeEntry(): Promise<TimeEntry | null>;
export declare function getTimeEntries(options?: {
    projectId?: string;
    taskId?: string;
    since?: string;
    limit?: number;
}): Promise<TimeEntry[]>;
export declare function getTimeStats(projectId: string): Promise<{
    totalMinutes: number;
    taskBreakdown: Record<string, number>;
    averageSessionLength: number;
    longestSession: number;
}>;
export declare function listPromptTemplates(category?: PromptTemplate['category']): PromptTemplate[];
export declare function getPromptTemplate(id: string): PromptTemplate | null;
export declare function fillPromptTemplate(template: PromptTemplate, variables: Record<string, string>): string;
export declare function generatePromptFromContext(context: ProjectContext, templateId: string): string | null;
export declare function generateClaudeMd(context: ProjectContext, format?: 'minimal' | 'standard' | 'detailed'): ClaudeMdExport;
export declare function saveClaudeMd(context: ProjectContext, outputPath: string, format?: 'minimal' | 'standard' | 'detailed'): Promise<string>;
export interface DailyDigest {
    date: string;
    todosCount: number;
    didsCount: number;
    activeProject?: string;
    upcomingDeadlines: PersonalTodo[];
    recentCompletions: DidItem[];
    goals: {
        daily: string[];
        weekly: string[];
    };
    timeTracked: number;
    memories: SessionMemory[];
}
export declare function getDailyDigest(projectId?: string): Promise<DailyDigest>;
export interface ProductivityStats {
    period: 'day' | 'week' | 'month';
    tasksCompleted: number;
    averageCompletionTime: number;
    topTags: Array<{
        tag: string;
        count: number;
    }>;
    streakDays: number;
    totalTimeTracked: number;
}
export declare function getProductivityStats(period?: 'day' | 'week' | 'month'): Promise<ProductivityStats>;
//# sourceMappingURL=productivity-features.d.ts.map