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

export enum Phase {
  PLANNING = 'planning',
  EXECUTION = 'execution',
  REVIEW = 'review',
  COMPLETED = 'completed',
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum AgentRole {
  PLANNER = 'planner', // ChatGPT - ideation, design
  EXECUTOR = 'executor', // Claude - implementation
  REVIEWER = 'reviewer', // Either AI - validation
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
  category: 'general' | 'decision' | 'blocker' | 'insight';
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
  options: Partial<Omit<Task, 'id' | 'title' | 'description' | 'createdAt' | 'updatedAt'>> = {}
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
  category: AgentNote['category'] = 'general'
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
  options: Partial<
    Omit<ProjectContext, 'id' | 'name' | 'description' | 'createdAt' | 'updatedAt'>
  > = {}
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
  options: Partial<Omit<Task, 'id' | 'title' | 'description' | 'createdAt' | 'updatedAt'>> = {}
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
  category: AgentNote['category'] = 'general'
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
// Serialization
// ============================================================================

export function serializeContext(context: ProjectContext): string {
  return JSON.stringify(context, null, 2);
}

export function deserializeContext(json: string): ProjectContext {
  return JSON.parse(json) as ProjectContext;
}
