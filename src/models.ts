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

export enum Phase {
  PLANNING = "planning",
  EXECUTION = "execution",
  REVIEW = "review",
  COMPLETED = "completed",
}

export enum TaskStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  BLOCKED = "blocked",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum AgentRole {
  PLANNER = "planner", // ChatGPT - ideation, design
  EXECUTOR = "executor", // Claude - implementation
  REVIEWER = "reviewer", // Either AI - validation
}

// ============================================================================
// Interfaces
// ============================================================================

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: number; // 1=highest, 5=lowest
  assignedTo: AgentRole | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  notes: string[];
  dependencies: string[]; // Task IDs
}

export interface AgentNote {
  id: string;
  agent: AgentRole;
  content: string;
  timestamp: string;
  category: "general" | "decision" | "blocker" | "insight";
}

export interface ProjectContext {
  // Core identity
  id: string;
  name: string;
  description: string;

  // State tracking
  phase: Phase;
  version: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Content
  tasks: Task[];
  notes: AgentNote[];

  // Metadata
  tags: string[];
  config: Record<string, unknown>;
}

// ============================================================================
// Factory Functions
// ============================================================================

function generateId(): string {
  return randomUUID().slice(0, 8);
}

function timestamp(): string {
  return new Date().toISOString();
}

export function createTask(
  title: string,
  description: string,
  options: Partial<Omit<Task, "id" | "title" | "description" | "createdAt" | "updatedAt">> = {}
): Task {
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

export function createNote(
  agent: AgentRole,
  content: string,
  category: AgentNote["category"] = "general"
): AgentNote {
  return {
    id: generateId(),
    agent,
    content,
    timestamp: timestamp(),
    category,
  };
}

export function createProject(
  name: string,
  description: string,
  options: Partial<Omit<ProjectContext, "id" | "name" | "description" | "createdAt" | "updatedAt">> = {}
): ProjectContext {
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

export function bumpVersion(context: ProjectContext): ProjectContext {
  return {
    ...context,
    version: context.version + 1,
    updatedAt: timestamp(),
  };
}

export function addTask(
  context: ProjectContext,
  title: string,
  description: string,
  options: Partial<Omit<Task, "id" | "title" | "description" | "createdAt" | "updatedAt">> = {}
): { context: ProjectContext; task: Task } {
  const task = createTask(title, description, options);
  const updated = bumpVersion({
    ...context,
    tasks: [...context.tasks, task],
  });
  return { context: updated, task };
}

export function addNote(
  context: ProjectContext,
  agent: AgentRole,
  content: string,
  category: AgentNote["category"] = "general"
): { context: ProjectContext; note: AgentNote } {
  const note = createNote(agent, content, category);
  const updated = bumpVersion({
    ...context,
    notes: [...context.notes, note],
  });
  return { context: updated, note };
}

export function updateTaskStatus(
  context: ProjectContext,
  taskId: string,
  status: TaskStatus
): ProjectContext {
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

export function updateTaskNote(
  context: ProjectContext,
  taskId: string,
  note: string
): ProjectContext {
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

export function setPhase(context: ProjectContext, phase: Phase): ProjectContext {
  return bumpVersion({ ...context, phase });
}

export function getTask(context: ProjectContext, taskId: string): Task | undefined {
  return context.tasks.find((t) => t.id === taskId);
}

export function getPendingTasks(context: ProjectContext): Task[] {
  return context.tasks.filter(
    (t) => t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.CANCELLED
  );
}

export function getProjectSummary(context: ProjectContext): string {
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
// Task Dependency Management
// ============================================================================

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
  dependents: string[]; // Tasks that depend on this one
}

/**
 * Validates all task dependencies in a project
 * Checks for circular dependencies and missing task references
 */
export function validateTaskDependencies(context: ProjectContext): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
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
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(taskId: string, path: string[] = []): boolean {
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
          warnings.push(
            `Task "${task.title}" is completed but dependency "${dep.title}" is not`
          );
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
export function getTaskExecutionOrder(context: ProjectContext): Task[] {
  const validation = validateTaskDependencies(context);
  if (!validation.isValid) {
    return []; // Cannot determine order with circular dependencies
  }

  const taskMap = new Map(context.tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const result: Task[] = [];

  function visit(taskId: string) {
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
export function canStartTask(context: ProjectContext, taskId: string): boolean {
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
export function getBlockedTasks(context: ProjectContext): Task[] {
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
export function getReadyTasks(context: ProjectContext): Task[] {
  return context.tasks.filter((task) => canStartTask(context, task.id));
}

/**
 * Generates a graph representation of task dependencies
 */
export function getTaskGraph(context: ProjectContext): TaskGraph {
  const nodes: TaskNode[] = [];

  // Build dependency graph
  for (const task of context.tasks) {
    const dependents: string[] = [];

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

export function serializeContext(context: ProjectContext): string {
  return JSON.stringify(context, null, 2);
}

export function deserializeContext(json: string): ProjectContext {
  return JSON.parse(json) as ProjectContext;
}
