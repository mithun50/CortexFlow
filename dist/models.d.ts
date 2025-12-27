/**
 * CortexFlow - Context Schema and Data Models
 *
 * Defines the shared context structure for AI-to-AI task continuation.
 * Supports project metadata, task lists, agent notes, and progress tracking.
 */
export declare enum Phase {
    PLANNING = "planning",
    EXECUTION = "execution",
    REVIEW = "review",
    COMPLETED = "completed"
}
export declare enum TaskStatus {
    PENDING = "pending",
    IN_PROGRESS = "in_progress",
    BLOCKED = "blocked",
    COMPLETED = "completed",
    CANCELLED = "cancelled"
}
export declare enum AgentRole {
    PLANNER = "planner",// ChatGPT - ideation, design
    EXECUTOR = "executor",// Claude - implementation
    REVIEWER = "reviewer"
}
export interface Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: number;
    assignedTo: AgentRole | null;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    notes: string[];
    dependencies: string[];
}
export interface AgentNote {
    id: string;
    agent: AgentRole;
    content: string;
    timestamp: string;
    category: "general" | "decision" | "blocker" | "insight";
}
export interface ProjectContext {
    id: string;
    name: string;
    description: string;
    phase: Phase;
    version: number;
    createdAt: string;
    updatedAt: string;
    tasks: Task[];
    notes: AgentNote[];
    tags: string[];
    config: Record<string, unknown>;
}
export declare function createTask(title: string, description: string, options?: Partial<Omit<Task, "id" | "title" | "description" | "createdAt" | "updatedAt">>): Task;
export declare function createNote(agent: AgentRole, content: string, category?: AgentNote["category"]): AgentNote;
export declare function createProject(name: string, description: string, options?: Partial<Omit<ProjectContext, "id" | "name" | "description" | "createdAt" | "updatedAt">>): ProjectContext;
export declare function bumpVersion(context: ProjectContext): ProjectContext;
export declare function addTask(context: ProjectContext, title: string, description: string, options?: Partial<Omit<Task, "id" | "title" | "description" | "createdAt" | "updatedAt">>): {
    context: ProjectContext;
    task: Task;
};
export declare function addNote(context: ProjectContext, agent: AgentRole, content: string, category?: AgentNote["category"]): {
    context: ProjectContext;
    note: AgentNote;
};
export declare function updateTaskStatus(context: ProjectContext, taskId: string, status: TaskStatus): ProjectContext;
export declare function updateTaskNote(context: ProjectContext, taskId: string, note: string): ProjectContext;
export declare function setPhase(context: ProjectContext, phase: Phase): ProjectContext;
export declare function getTask(context: ProjectContext, taskId: string): Task | undefined;
export declare function getPendingTasks(context: ProjectContext): Task[];
export declare function getProjectSummary(context: ProjectContext): string;
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
export interface TaskGraph {
    nodes: TaskNode[];
    executionOrder: string[];
    blockedTasks: string[];
    readyTasks: string[];
}
export interface TaskNode {
    id: string;
    title: string;
    status: TaskStatus;
    dependencies: string[];
    dependents: string[];
}
/**
 * Validates all task dependencies in a project
 * Checks for circular dependencies and missing task references
 */
export declare function validateTaskDependencies(context: ProjectContext): ValidationResult;
/**
 * Returns tasks in topological order (dependencies first)
 * Returns empty array if circular dependencies exist
 */
export declare function getTaskExecutionOrder(context: ProjectContext): Task[];
/**
 * Checks if a task can be started (all dependencies are completed)
 */
export declare function canStartTask(context: ProjectContext, taskId: string): boolean;
/**
 * Returns tasks that are blocked by incomplete dependencies
 */
export declare function getBlockedTasks(context: ProjectContext): Task[];
/**
 * Returns tasks that can be started right now
 */
export declare function getReadyTasks(context: ProjectContext): Task[];
/**
 * Generates a graph representation of task dependencies
 */
export declare function getTaskGraph(context: ProjectContext): TaskGraph;
export declare function serializeContext(context: ProjectContext): string;
export declare function deserializeContext(json: string): ProjectContext;
//# sourceMappingURL=models.d.ts.map