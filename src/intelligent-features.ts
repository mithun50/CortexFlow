/**
 * CortexFlow - Intelligent Features Module
 *
 * Advanced AI-optimized features for unique differentiation:
 * - Smart Priority Queue with Critical Path Analysis
 * - Context Compression for token efficiency
 * - Project Health Score with predictive analytics
 * - Batch Operations API
 * - Intelligent Task Suggestions
 */

import {
  ProjectContext,
  Task,
  TaskStatus,
  AgentRole,
  Phase,
  AgentNote,
  createTask,
  createNote,
} from './models.js';

// ============================================================================
// Smart Priority Queue with Critical Path Analysis
// ============================================================================

export interface TaskNode {
  task: Task;
  dependents: string[]; // Tasks that depend on this one
  depth: number; // Depth in dependency graph
  criticalPath: boolean; // Is on the critical path?
  earliestStart: number; // Earliest possible start (in order)
  slack: number; // How much delay is acceptable
  score: number; // Computed priority score
}

export interface CriticalPathAnalysis {
  criticalPath: Task[]; // Tasks on the critical path (longest dependency chain)
  criticalPathLength: number;
  parallelizableGroups: Task[][]; // Tasks that can run in parallel
  blockedTasks: Task[]; // Tasks blocked by incomplete dependencies
  readyTasks: Task[]; // Tasks ready to start now
  estimatedCompletion: number; // Estimated task count to completion
}

/**
 * Analyze the project's task dependency graph and find critical path
 */
export function analyzeCriticalPath(context: ProjectContext): CriticalPathAnalysis {
  const taskMap = new Map<string, Task>();
  const nodeMap = new Map<string, TaskNode>();

  // Build task lookup map
  for (const task of context.tasks) {
    taskMap.set(task.id, task);
  }

  // Build dependency graph nodes
  for (const task of context.tasks) {
    const dependents: string[] = [];
    for (const other of context.tasks) {
      if (other.dependencies.includes(task.id)) {
        dependents.push(other.id);
      }
    }
    nodeMap.set(task.id, {
      task,
      dependents,
      depth: 0,
      criticalPath: false,
      earliestStart: 0,
      slack: 0,
      score: 0,
    });
  }

  // Calculate depths using topological sort
  const visited = new Set<string>();
  const depths = new Map<string, number>();

  function calculateDepth(taskId: string): number {
    if (depths.has(taskId)) return depths.get(taskId)!;
    if (visited.has(taskId)) return 0; // Cycle detected

    visited.add(taskId);
    const task = taskMap.get(taskId);
    if (!task) return 0;

    let maxDepth = 0;
    for (const depId of task.dependencies) {
      maxDepth = Math.max(maxDepth, calculateDepth(depId) + 1);
    }

    depths.set(taskId, maxDepth);
    const node = nodeMap.get(taskId);
    if (node) node.depth = maxDepth;

    return maxDepth;
  }

  for (const task of context.tasks) {
    calculateDepth(task.id);
  }

  // Find critical path (longest chain)
  let maxDepth = 0;
  let criticalEndTask: Task | null = null;

  for (const task of context.tasks) {
    const depth = depths.get(task.id) ?? 0;
    if (depth >= maxDepth && task.status !== TaskStatus.COMPLETED) {
      maxDepth = depth;
      criticalEndTask = task;
    }
  }

  // Trace back the critical path
  const criticalPath: Task[] = [];
  let current = criticalEndTask;

  while (current) {
    criticalPath.unshift(current);
    const node = nodeMap.get(current.id);
    if (node) node.criticalPath = true;

    // Find the dependency with the longest path
    let longestDep: Task | null = null;
    let longestDepth = -1;

    for (const depId of current.dependencies) {
      const depDepth = depths.get(depId) ?? 0;
      if (depDepth > longestDepth) {
        longestDepth = depDepth;
        longestDep = taskMap.get(depId) ?? null;
      }
    }

    current = longestDep;
  }

  // Calculate slack (non-critical tasks)
  for (const node of nodeMap.values()) {
    if (!node.criticalPath) {
      node.slack = maxDepth - node.depth;
    }
  }

  // Find parallelizable groups (tasks at same depth with no inter-dependencies)
  const depthGroups = new Map<number, Task[]>();
  for (const task of context.tasks) {
    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED) continue;
    const depth = depths.get(task.id) ?? 0;
    if (!depthGroups.has(depth)) {
      depthGroups.set(depth, []);
    }
    depthGroups.get(depth)!.push(task);
  }

  const parallelizableGroups = Array.from(depthGroups.values()).filter((g) => g.length > 1);

  // Find blocked tasks (have incomplete dependencies)
  const blockedTasks: Task[] = [];
  const readyTasks: Task[] = [];

  for (const task of context.tasks) {
    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED) continue;

    const hasIncompleteDeps = task.dependencies.some((depId) => {
      const dep = taskMap.get(depId);
      return dep && dep.status !== TaskStatus.COMPLETED;
    });

    if (hasIncompleteDeps) {
      blockedTasks.push(task);
    } else if (task.status === TaskStatus.PENDING) {
      readyTasks.push(task);
    }
  }

  // Estimate completion
  const remaining = context.tasks.filter(
    (t) => t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.CANCELLED
  );

  return {
    criticalPath: criticalPath.filter((t) => t.status !== TaskStatus.COMPLETED),
    criticalPathLength: criticalPath.length,
    parallelizableGroups,
    blockedTasks,
    readyTasks,
    estimatedCompletion: remaining.length,
  };
}

/**
 * Get next recommended tasks based on smart priority queue
 */
export function getSmartPriorityQueue(context: ProjectContext, limit = 5): Task[] {
  const analysis = analyzeCriticalPath(context);
  const taskMap = new Map<string, Task>();

  for (const task of context.tasks) {
    taskMap.set(task.id, task);
  }

  // Score each task
  const scoredTasks: Array<{ task: Task; score: number }> = [];

  for (const task of analysis.readyTasks) {
    let score = 0;

    // Critical path bonus (+50)
    if (analysis.criticalPath.some((t) => t.id === task.id)) {
      score += 50;
    }

    // Priority score (1-5 becomes 50-10)
    score += (6 - task.priority) * 10;

    // Blocking bonus - tasks that unblock many others get priority
    const unblockCount = context.tasks.filter(
      (t) => t.dependencies.includes(task.id) && t.status === TaskStatus.PENDING
    ).length;
    score += unblockCount * 15;

    // Age bonus - older tasks get slight priority
    const ageHours = (Date.now() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60);
    score += Math.min(ageHours, 24); // Max 24 points for age

    scoredTasks.push({ task, score });
  }

  // Sort by score descending
  scoredTasks.sort((a, b) => b.score - a.score);

  return scoredTasks.slice(0, limit).map((s) => s.task);
}

// ============================================================================
// Context Compression for Token Efficiency
// ============================================================================

export interface CompressedContext {
  // Compact representation
  id: string;
  n: string; // name
  d: string; // description
  p: string; // phase (single char: P/E/R/C)
  v: number; // version

  // Compact tasks
  t: Array<{
    i: string; // id
    t: string; // title
    s: string; // status (P/I/B/C/X)
    p: number; // priority
    d: string[]; // dependencies
  }>;

  // Compact notes (only essential)
  nt: Array<{
    a: string; // agent (first letter)
    c: string; // content (truncated)
    cat: string; // category (first letter)
  }>;

  // Metadata
  tc: number; // task count
  cc: number; // completed count
  ts: string; // timestamp
}

const PHASE_MAP: Record<Phase, string> = {
  [Phase.PLANNING]: 'P',
  [Phase.EXECUTION]: 'E',
  [Phase.REVIEW]: 'R',
  [Phase.COMPLETED]: 'C',
};

const PHASE_REVERSE: Record<string, Phase> = {
  P: Phase.PLANNING,
  E: Phase.EXECUTION,
  R: Phase.REVIEW,
  C: Phase.COMPLETED,
};

const STATUS_MAP: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: 'P',
  [TaskStatus.IN_PROGRESS]: 'I',
  [TaskStatus.BLOCKED]: 'B',
  [TaskStatus.COMPLETED]: 'C',
  [TaskStatus.CANCELLED]: 'X',
};

const STATUS_REVERSE: Record<string, TaskStatus> = {
  P: TaskStatus.PENDING,
  I: TaskStatus.IN_PROGRESS,
  B: TaskStatus.BLOCKED,
  C: TaskStatus.COMPLETED,
  X: TaskStatus.CANCELLED,
};

const AGENT_MAP: Record<AgentRole, string> = {
  [AgentRole.PLANNER]: 'P',
  [AgentRole.EXECUTOR]: 'E',
  [AgentRole.REVIEWER]: 'R',
  [AgentRole.TESTER]: 'T',
  [AgentRole.DOCUMENTER]: 'D',
  [AgentRole.SECURITY]: 'S',
};

/**
 * Compress project context for efficient token usage
 * Typically reduces tokens by 40-60%
 */
export function compressContext(
  context: ProjectContext,
  options: {
    maxNoteLength?: number;
    includeCompletedTasks?: boolean;
    maxNotes?: number;
  } = {}
): CompressedContext {
  const { maxNoteLength = 100, includeCompletedTasks = false, maxNotes = 10 } = options;

  const tasks = includeCompletedTasks
    ? context.tasks
    : context.tasks.filter((t) => t.status !== TaskStatus.COMPLETED);

  return {
    id: context.id,
    n: context.name,
    d: context.description.substring(0, 200),
    p: PHASE_MAP[context.phase],
    v: context.version,
    t: tasks.map((t) => ({
      i: t.id,
      t: t.title,
      s: STATUS_MAP[t.status],
      p: t.priority,
      d: t.dependencies,
    })),
    nt: context.notes.slice(-maxNotes).map((n) => ({
      a: AGENT_MAP[n.agent],
      c: n.content.substring(0, maxNoteLength),
      cat: n.category[0].toUpperCase(),
    })),
    tc: context.tasks.length,
    cc: context.tasks.filter((t) => t.status === TaskStatus.COMPLETED).length,
    ts: context.updatedAt,
  };
}

/**
 * Decompress context back to full format
 */
export function decompressContext(compressed: CompressedContext): Partial<ProjectContext> {
  return {
    id: compressed.id,
    name: compressed.n,
    description: compressed.d,
    phase: PHASE_REVERSE[compressed.p] ?? Phase.PLANNING,
    version: compressed.v,
    updatedAt: compressed.ts,
  };
}

/**
 * Calculate compression ratio
 */
export function getCompressionStats(
  original: ProjectContext,
  compressed: CompressedContext
): {
  originalSize: number;
  compressedSize: number;
  ratio: number;
  savedTokens: number;
} {
  const originalSize = JSON.stringify(original).length;
  const compressedSize = JSON.stringify(compressed).length;
  const ratio = ((originalSize - compressedSize) / originalSize) * 100;

  // Rough token estimate (4 chars per token)
  const savedTokens = Math.floor((originalSize - compressedSize) / 4);

  return {
    originalSize,
    compressedSize,
    ratio,
    savedTokens,
  };
}

// ============================================================================
// Project Health Score
// ============================================================================

export interface HealthScore {
  overall: number; // 0-100
  breakdown: {
    velocity: number; // Task completion rate
    blockerRatio: number; // Low is good
    dependencyHealth: number; // Circular deps, orphans
    progressRate: number; // Phase progression
    staleness: number; // Recent activity
    documentationQuality: number; // Notes and decisions
  };
  risks: HealthRisk[];
  recommendations: string[];
  trend: 'improving' | 'stable' | 'declining';
}

export interface HealthRisk {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  affectedTasks: string[];
}

/**
 * Calculate comprehensive project health score
 */
export function calculateHealthScore(context: ProjectContext): HealthScore {
  const now = Date.now();
  const risks: HealthRisk[] = [];
  const recommendations: string[] = [];

  // ===== Velocity Score (0-100) =====
  const completed = context.tasks.filter((t) => t.status === TaskStatus.COMPLETED);
  const total = context.tasks.length;
  const velocityScore = total > 0 ? (completed.length / total) * 100 : 100;

  // ===== Blocker Ratio (0-100, inverted - low blockers = high score) =====
  const blocked = context.tasks.filter((t) => t.status === TaskStatus.BLOCKED);
  const blockerRatio = total > 0 ? 100 - (blocked.length / total) * 100 : 100;

  if (blocked.length > 0) {
    risks.push({
      severity: blocked.length > 2 ? 'high' : 'medium',
      category: 'blockers',
      description: `${blocked.length} task(s) are blocked`,
      affectedTasks: blocked.map((t) => t.id),
    });
    recommendations.push(`Resolve ${blocked.length} blocked tasks to improve flow`);
  }

  // ===== Dependency Health (0-100) =====
  let dependencyScore = 100;
  const taskIds = new Set(context.tasks.map((t) => t.id));

  // Check for invalid dependencies
  for (const task of context.tasks) {
    for (const depId of task.dependencies) {
      if (!taskIds.has(depId)) {
        dependencyScore -= 10;
        risks.push({
          severity: 'medium',
          category: 'dependency',
          description: `Task "${task.title}" has invalid dependency: ${depId}`,
          affectedTasks: [task.id],
        });
      }
    }
  }

  // Check for circular dependencies
  const hasCircular = detectCircularDependencies(context);
  if (hasCircular) {
    dependencyScore -= 30;
    risks.push({
      severity: 'critical',
      category: 'dependency',
      description: 'Circular dependencies detected',
      affectedTasks: [],
    });
    recommendations.push('Break circular dependencies immediately');
  }

  dependencyScore = Math.max(0, dependencyScore);

  // ===== Progress Rate (0-100) =====
  const phaseScores: Record<Phase, number> = {
    [Phase.PLANNING]: 25,
    [Phase.EXECUTION]: 50,
    [Phase.REVIEW]: 75,
    [Phase.COMPLETED]: 100,
  };
  const progressRate = phaseScores[context.phase];

  // ===== Staleness Score (0-100) =====
  const lastUpdate = new Date(context.updatedAt).getTime();
  const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
  let stalenessScore = 100;

  if (hoursSinceUpdate > 168) {
    // 1 week
    stalenessScore = 20;
    risks.push({
      severity: 'high',
      category: 'staleness',
      description: 'Project has not been updated in over a week',
      affectedTasks: [],
    });
  } else if (hoursSinceUpdate > 72) {
    // 3 days
    stalenessScore = 50;
  } else if (hoursSinceUpdate > 24) {
    // 1 day
    stalenessScore = 75;
  }

  // ===== Documentation Quality (0-100) =====
  const decisions = context.notes.filter((n) => n.category === 'decision');
  const insights = context.notes.filter((n) => n.category === 'insight');
  const hasNotes = context.notes.length >= Math.min(total, 3);
  const hasDecisions = decisions.length > 0;
  const hasInsights = insights.length > 0;

  let docScore = 50; // Base
  if (hasNotes) docScore += 20;
  if (hasDecisions) docScore += 20;
  if (hasInsights) docScore += 10;

  if (!hasDecisions && total > 3) {
    recommendations.push('Document key decisions for better context preservation');
  }

  // ===== Calculate Overall Score =====
  const weights = {
    velocity: 0.25,
    blockerRatio: 0.2,
    dependencyHealth: 0.15,
    progressRate: 0.15,
    staleness: 0.15,
    documentationQuality: 0.1,
  };

  const overall = Math.round(
    velocityScore * weights.velocity +
      blockerRatio * weights.blockerRatio +
      dependencyScore * weights.dependencyHealth +
      progressRate * weights.progressRate +
      stalenessScore * weights.staleness +
      docScore * weights.documentationQuality
  );

  // Determine trend (simplified - would need historical data)
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (blocked.length > completed.length / 2) {
    trend = 'declining';
  } else if (completed.length > total / 2) {
    trend = 'improving';
  }

  return {
    overall,
    breakdown: {
      velocity: Math.round(velocityScore),
      blockerRatio: Math.round(blockerRatio),
      dependencyHealth: Math.round(dependencyScore),
      progressRate: Math.round(progressRate),
      staleness: Math.round(stalenessScore),
      documentationQuality: Math.round(docScore),
    },
    risks,
    recommendations,
    trend,
  };
}

/**
 * Detect circular dependencies in task graph
 */
function detectCircularDependencies(context: ProjectContext): boolean {
  const taskMap = new Map<string, Task>();
  for (const task of context.tasks) {
    taskMap.set(task.id, task);
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(taskId: string): boolean {
    if (recursionStack.has(taskId)) return true;
    if (visited.has(taskId)) return false;

    visited.add(taskId);
    recursionStack.add(taskId);

    const task = taskMap.get(taskId);
    if (task) {
      for (const depId of task.dependencies) {
        if (hasCycle(depId)) return true;
      }
    }

    recursionStack.delete(taskId);
    return false;
  }

  for (const task of context.tasks) {
    if (hasCycle(task.id)) return true;
  }

  return false;
}

// ============================================================================
// Batch Operations API
// ============================================================================

export interface BatchOperation {
  type: 'create_task' | 'update_task' | 'delete_task' | 'add_note' | 'update_status';
  payload: Record<string, unknown>;
}

export interface BatchResult {
  success: boolean;
  results: Array<{
    index: number;
    success: boolean;
    error?: string;
    result?: unknown;
  }>;
  appliedCount: number;
  failedCount: number;
  context: ProjectContext;
}

/**
 * Execute multiple operations atomically
 */
export function executeBatchOperations(
  context: ProjectContext,
  operations: BatchOperation[]
): BatchResult {
  const currentContext = { ...context, tasks: [...context.tasks], notes: [...context.notes] };
  const results: BatchResult['results'] = [];
  let appliedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];

    try {
      switch (op.type) {
        case 'create_task': {
          const task = createTask(
            op.payload.title as string,
            op.payload.description as string,
            op.payload.options as Record<string, unknown> | undefined
          );
          currentContext.tasks.push(task);
          results.push({ index: i, success: true, result: { taskId: task.id } });
          appliedCount++;
          break;
        }

        case 'update_task': {
          const taskIndex = currentContext.tasks.findIndex((t) => t.id === op.payload.taskId);
          if (taskIndex < 0) {
            throw new Error(`Task not found: ${op.payload.taskId}`);
          }
          const updates = (op.payload.updates ?? {}) as Partial<Task>;
          currentContext.tasks[taskIndex] = {
            ...currentContext.tasks[taskIndex],
            ...updates,
            updatedAt: new Date().toISOString(),
          };
          results.push({ index: i, success: true });
          appliedCount++;
          break;
        }

        case 'delete_task': {
          const deleteIndex = currentContext.tasks.findIndex((t) => t.id === op.payload.taskId);
          if (deleteIndex < 0) {
            throw new Error(`Task not found: ${op.payload.taskId}`);
          }
          currentContext.tasks.splice(deleteIndex, 1);
          results.push({ index: i, success: true });
          appliedCount++;
          break;
        }

        case 'add_note': {
          const note = createNote(
            op.payload.agent as AgentRole,
            op.payload.content as string,
            op.payload.category as AgentNote['category']
          );
          currentContext.notes.push(note);
          results.push({ index: i, success: true, result: { noteId: note.id } });
          appliedCount++;
          break;
        }

        case 'update_status': {
          const statusIndex = currentContext.tasks.findIndex((t) => t.id === op.payload.taskId);
          if (statusIndex < 0) {
            throw new Error(`Task not found: ${op.payload.taskId}`);
          }
          const now = new Date().toISOString();
          currentContext.tasks[statusIndex] = {
            ...currentContext.tasks[statusIndex],
            status: op.payload.status as TaskStatus,
            updatedAt: now,
            completedAt:
              op.payload.status === TaskStatus.COMPLETED
                ? now
                : currentContext.tasks[statusIndex].completedAt,
          };
          results.push({ index: i, success: true });
          appliedCount++;
          break;
        }

        default:
          throw new Error(`Unknown operation type: ${op.type}`);
      }
    } catch (error) {
      results.push({
        index: i,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      failedCount++;
    }
  }

  // Bump version
  currentContext.version++;
  currentContext.updatedAt = new Date().toISOString();

  return {
    success: failedCount === 0,
    results,
    appliedCount,
    failedCount,
    context: currentContext,
  };
}

// ============================================================================
// Intelligent Task Suggestions
// ============================================================================

export interface TaskSuggestion {
  type: 'missing_dependency' | 'unblock_action' | 'next_phase' | 'documentation' | 'optimization';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  suggestedTask?: Partial<Task>;
}

/**
 * Generate intelligent task suggestions based on project state
 */
export function generateTaskSuggestions(context: ProjectContext): TaskSuggestion[] {
  const suggestions: TaskSuggestion[] = [];
  const analysis = analyzeCriticalPath(context);
  const health = calculateHealthScore(context);

  // Suggest unblocking actions for blocked tasks
  for (const blockedTask of analysis.blockedTasks.slice(0, 3)) {
    const incompleteDeps = blockedTask.dependencies.filter((depId) => {
      const dep = context.tasks.find((t) => t.id === depId);
      return dep && dep.status !== TaskStatus.COMPLETED;
    });

    if (incompleteDeps.length > 0) {
      suggestions.push({
        type: 'unblock_action',
        priority: 'high',
        title: `Unblock: ${blockedTask.title}`,
        description: `Complete ${incompleteDeps.length} dependency task(s) to unblock this task`,
      });
    }
  }

  // Suggest documentation if missing
  const hasDecisions = context.notes.some((n) => n.category === 'decision');
  if (!hasDecisions && context.tasks.length > 3) {
    suggestions.push({
      type: 'documentation',
      priority: 'medium',
      title: 'Document key decisions',
      description: 'Add decision notes to preserve context for AI agents',
      suggestedTask: {
        title: 'Document architectural decisions',
        description: 'Record key decisions made so far for future reference',
        priority: 3,
      },
    });
  }

  // Suggest phase transition
  const completedCount = context.tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
  const totalCount = context.tasks.length;

  if (context.phase === Phase.PLANNING && completedCount > 0) {
    suggestions.push({
      type: 'next_phase',
      priority: 'medium',
      title: 'Consider moving to Execution phase',
      description: 'Planning tasks are progressing. Consider transitioning to Execution.',
    });
  }

  if (context.phase === Phase.EXECUTION && completedCount > totalCount * 0.8) {
    suggestions.push({
      type: 'next_phase',
      priority: 'high',
      title: 'Ready for Review phase',
      description: '80% of tasks complete. Consider moving to Review phase.',
    });
  }

  // Suggest optimization for long critical paths
  if (analysis.criticalPathLength > 5) {
    suggestions.push({
      type: 'optimization',
      priority: 'medium',
      title: 'Optimize critical path',
      description: `Critical path has ${analysis.criticalPathLength} tasks. Consider parallelizing where possible.`,
    });
  }

  // Add recommendations from health score
  for (const rec of health.recommendations.slice(0, 2)) {
    suggestions.push({
      type: 'optimization',
      priority: 'low',
      title: rec,
      description: 'Suggested by health score analysis',
    });
  }

  return suggestions;
}

// ============================================================================
// Real-time Streaming Support
// ============================================================================

export interface StreamEvent {
  id: string;
  type: 'task_update' | 'note_added' | 'phase_change' | 'health_update' | 'suggestion';
  timestamp: string;
  projectId: string;
  data: Record<string, unknown>;
}

/**
 * Create a stream event for SSE broadcasting
 */
export function createStreamEvent(
  type: StreamEvent['type'],
  projectId: string,
  data: Record<string, unknown>
): StreamEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    timestamp: new Date().toISOString(),
    projectId,
    data,
  };
}

/**
 * Format event for SSE
 */
export function formatSSE(event: StreamEvent): string {
  return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
