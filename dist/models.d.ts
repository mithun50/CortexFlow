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
    REVIEWER = "reviewer",// Either AI - validation
    TESTER = "tester",// Testing agent
    DOCUMENTER = "documenter",// Documentation agent
    SECURITY = "security"
}
export declare enum EventType {
    PROJECT_CREATED = "project.created",
    PROJECT_UPDATED = "project.updated",
    PROJECT_DELETED = "project.deleted",
    PHASE_CHANGED = "phase.changed",
    TASK_CREATED = "task.created",
    TASK_UPDATED = "task.updated",
    TASK_COMPLETED = "task.completed",
    TASK_BLOCKED = "task.blocked",
    NOTE_ADDED = "note.added",
    BLOCKER_ADDED = "blocker.added",
    SNAPSHOT_CREATED = "snapshot.created"
}
export declare enum AuditAction {
    CREATE = "create",
    UPDATE = "update",
    DELETE = "delete",
    RESTORE = "restore"
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
    category: 'general' | 'decision' | 'blocker' | 'insight';
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
export interface Webhook {
    id: string;
    url: string;
    events: EventType[];
    secret?: string;
    active: boolean;
    createdAt: string;
    lastTriggeredAt: string | null;
    failureCount: number;
}
export interface ProjectTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    tasks: Array<{
        title: string;
        description: string;
        priority: number;
        dependencies: string[];
    }>;
    defaultPhase: Phase;
    tags: string[];
    createdAt: string;
    usageCount: number;
}
export interface ProjectSnapshot {
    id: string;
    projectId: string;
    version: number;
    name: string;
    description: string;
    data: ProjectContext;
    createdAt: string;
    createdBy: AgentRole | 'system';
}
export interface AuditEntry {
    id: string;
    projectId: string;
    action: AuditAction;
    entityType: 'project' | 'task' | 'note' | 'phase' | 'snapshot' | 'webhook';
    entityId: string;
    agent: AgentRole | 'system' | 'http';
    timestamp: string;
    changes: {
        field: string;
        oldValue: unknown;
        newValue: unknown;
    }[];
    metadata?: Record<string, unknown>;
}
export interface WebhookEvent {
    id: string;
    type: EventType;
    projectId: string;
    timestamp: string;
    data: Record<string, unknown>;
}
export declare function createTask(title: string, description: string, options?: Partial<Omit<Task, 'id' | 'title' | 'description' | 'createdAt' | 'updatedAt'>>): Task;
export declare function createNote(agent: AgentRole, content: string, category?: AgentNote['category']): AgentNote;
export declare function createProject(name: string, description: string, options?: Partial<Omit<ProjectContext, 'id' | 'name' | 'description' | 'createdAt' | 'updatedAt'>>): ProjectContext;
export declare function createWebhook(url: string, events: EventType[], options?: Partial<Omit<Webhook, 'id' | 'url' | 'events' | 'createdAt'>>): Webhook;
export declare function createTemplate(name: string, description: string, tasks: ProjectTemplate['tasks'], options?: Partial<Omit<ProjectTemplate, 'id' | 'name' | 'description' | 'tasks' | 'createdAt'>>): ProjectTemplate;
export declare function createSnapshot(project: ProjectContext, name: string, description: string, createdBy?: AgentRole | 'system'): ProjectSnapshot;
export declare function createAuditEntry(projectId: string, action: AuditAction, entityType: AuditEntry['entityType'], entityId: string, agent: AuditEntry['agent'], changes: AuditEntry['changes'], metadata?: Record<string, unknown>): AuditEntry;
export declare function createWebhookEvent(type: EventType, projectId: string, data: Record<string, unknown>): WebhookEvent;
export declare const BUILT_IN_TEMPLATES: ProjectTemplate[];
export declare function bumpVersion(context: ProjectContext): ProjectContext;
export declare function addTask(context: ProjectContext, title: string, description: string, options?: Partial<Omit<Task, 'id' | 'title' | 'description' | 'createdAt' | 'updatedAt'>>): {
    context: ProjectContext;
    task: Task;
};
export declare function addNote(context: ProjectContext, agent: AgentRole, content: string, category?: AgentNote['category']): {
    context: ProjectContext;
    note: AgentNote;
};
export declare function updateTaskStatus(context: ProjectContext, taskId: string, status: TaskStatus): ProjectContext;
export declare function updateTaskNote(context: ProjectContext, taskId: string, note: string): ProjectContext;
export declare function setPhase(context: ProjectContext, phase: Phase): ProjectContext;
export declare function getTask(context: ProjectContext, taskId: string): Task | undefined;
export declare function getPendingTasks(context: ProjectContext): Task[];
export declare function getProjectSummary(context: ProjectContext): string;
export interface AgentStats {
    agent: AgentRole;
    tasksCompleted: number;
    tasksInProgress: number;
    notesAdded: number;
    avgCompletionTime: number | null;
}
export interface ProjectAnalytics {
    projectId: string;
    projectName: string;
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    blockedTasks: number;
    completionRate: number;
    agentStats: AgentStats[];
    phaseHistory: {
        phase: Phase;
        timestamp: string;
    }[];
    avgTaskDuration: number | null;
    blockerCount: number;
    decisionCount: number;
}
export declare function getProjectAnalytics(context: ProjectContext): ProjectAnalytics;
export declare function exportToMarkdown(context: ProjectContext): string;
export declare function cloneProject(context: ProjectContext, newName: string, options?: {
    resetTasks?: boolean;
    resetNotes?: boolean;
}): ProjectContext;
export declare function serializeContext(context: ProjectContext): string;
export declare function deserializeContext(json: string): ProjectContext;
export declare function createProjectFromTemplate(template: ProjectTemplate, projectName: string, projectDescription?: string): ProjectContext;
export declare function getTemplateById(templateId: string): ProjectTemplate | undefined;
export declare function getTemplatesByCategory(category: string): ProjectTemplate[];
export declare function restoreFromSnapshot(snapshot: ProjectSnapshot): ProjectContext;
export declare function compareSnapshots(older: ProjectSnapshot, newer: ProjectSnapshot): {
    tasksAdded: Task[];
    tasksRemoved: Task[];
    tasksModified: Array<{
        taskId: string;
        changes: string[];
    }>;
    notesAdded: number;
    phaseChanged: boolean;
};
export declare function filterAuditLog(entries: AuditEntry[], options: {
    projectId?: string;
    action?: AuditAction;
    entityType?: AuditEntry['entityType'];
    agent?: AuditEntry['agent'];
    since?: string;
    until?: string;
    limit?: number;
}): AuditEntry[];
export type RAGSourceType = 'project_context' | 'task' | 'note' | 'custom_document';
export type EmbeddingProvider = 'local' | 'openai' | 'voyage' | 'cohere' | 'custom';
export type ChunkingStrategy = 'fixed' | 'sentence' | 'paragraph' | 'semantic';
export type RAGSearchType = 'vector' | 'keyword' | 'hybrid';
export interface RAGDocument {
    id: string;
    projectId: string | null;
    sourceType: RAGSourceType;
    sourceId: string | null;
    title: string;
    content: string;
    metadata: Record<string, unknown>;
    chunkCount: number;
    createdAt: string;
    updatedAt: string;
}
export interface RAGChunk {
    id: string;
    documentId: string;
    content: string;
    embedding: number[] | null;
    chunkIndex: number;
    startOffset: number;
    endOffset: number;
    metadata: Record<string, unknown>;
    createdAt: string;
}
export interface RAGSearchResult {
    chunk: RAGChunk;
    document: RAGDocument;
    score: number;
    highlights: string[];
}
export interface RAGQueryResult {
    query: string;
    results: RAGSearchResult[];
    totalFound: number;
    searchTimeMs: number;
    embeddingProvider: string;
}
export interface EmbeddingConfig {
    provider: EmbeddingProvider;
    model: string;
    dimensions: number;
    apiKey?: string;
    apiEndpoint?: string;
    batchSize: number;
}
export interface ChunkingConfig {
    strategy: ChunkingStrategy;
    chunkSize: number;
    chunkOverlap: number;
    minChunkSize: number;
    maxChunkSize: number;
}
export interface RAGSearchConfig {
    topK: number;
    minScore: number;
    rerank: boolean;
    hybridVectorWeight: number;
}
export interface RAGIndexingConfig {
    autoIndex: boolean;
    indexOnCreate: boolean;
    batchSize: number;
}
export interface RAGConfig {
    embedding: EmbeddingConfig;
    chunking: ChunkingConfig;
    search: RAGSearchConfig;
    indexing: RAGIndexingConfig;
}
export interface RAGStats {
    totalDocuments: number;
    totalChunks: number;
    indexedChunks: number;
    projectBreakdown: Record<string, number>;
    embeddingProvider: string;
    embeddingDimensions: number;
}
/**
 * Deep partial type for RAG configuration updates.
 * Allows partial updates to nested configuration objects.
 */
export interface RAGConfigUpdate {
    embedding?: Partial<EmbeddingConfig>;
    chunking?: Partial<ChunkingConfig>;
    search?: Partial<RAGSearchConfig>;
    indexing?: Partial<RAGIndexingConfig>;
}
export declare function createRAGDocument(title: string, content: string, options?: Partial<Omit<RAGDocument, 'id' | 'title' | 'content' | 'createdAt' | 'updatedAt'>>): RAGDocument;
export declare function createRAGChunk(documentId: string, content: string, chunkIndex: number, options?: Partial<Omit<RAGChunk, 'id' | 'documentId' | 'content' | 'chunkIndex' | 'createdAt'>>): RAGChunk;
export declare function getDefaultRAGConfig(): RAGConfig;
//# sourceMappingURL=models.d.ts.map