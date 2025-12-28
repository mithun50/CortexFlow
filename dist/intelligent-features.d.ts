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
import { ProjectContext, Task } from './models.js';
export interface TaskNode {
    task: Task;
    dependents: string[];
    depth: number;
    criticalPath: boolean;
    earliestStart: number;
    slack: number;
    score: number;
}
export interface CriticalPathAnalysis {
    criticalPath: Task[];
    criticalPathLength: number;
    parallelizableGroups: Task[][];
    blockedTasks: Task[];
    readyTasks: Task[];
    estimatedCompletion: number;
}
/**
 * Analyze the project's task dependency graph and find critical path
 */
export declare function analyzeCriticalPath(context: ProjectContext): CriticalPathAnalysis;
/**
 * Get next recommended tasks based on smart priority queue
 */
export declare function getSmartPriorityQueue(context: ProjectContext, limit?: number): Task[];
export interface CompressedContext {
    id: string;
    n: string;
    d: string;
    p: string;
    v: number;
    t: Array<{
        i: string;
        t: string;
        s: string;
        p: number;
        d: string[];
    }>;
    nt: Array<{
        a: string;
        c: string;
        cat: string;
    }>;
    tc: number;
    cc: number;
    ts: string;
}
/**
 * Compress project context for efficient token usage
 * Typically reduces tokens by 40-60%
 */
export declare function compressContext(context: ProjectContext, options?: {
    maxNoteLength?: number;
    includeCompletedTasks?: boolean;
    maxNotes?: number;
}): CompressedContext;
/**
 * Decompress context back to full format
 */
export declare function decompressContext(compressed: CompressedContext): Partial<ProjectContext>;
/**
 * Calculate compression ratio
 */
export declare function getCompressionStats(original: ProjectContext, compressed: CompressedContext): {
    originalSize: number;
    compressedSize: number;
    ratio: number;
    savedTokens: number;
};
export interface HealthScore {
    overall: number;
    breakdown: {
        velocity: number;
        blockerRatio: number;
        dependencyHealth: number;
        progressRate: number;
        staleness: number;
        documentationQuality: number;
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
export declare function calculateHealthScore(context: ProjectContext): HealthScore;
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
export declare function executeBatchOperations(context: ProjectContext, operations: BatchOperation[]): BatchResult;
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
export declare function generateTaskSuggestions(context: ProjectContext): TaskSuggestion[];
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
export declare function createStreamEvent(type: StreamEvent['type'], projectId: string, data: Record<string, unknown>): StreamEvent;
/**
 * Format event for SSE
 */
export declare function formatSSE(event: StreamEvent): string;
//# sourceMappingURL=intelligent-features.d.ts.map