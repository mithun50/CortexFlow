/**
 * CortexFlow - Advanced Storage Layer
 *
 * Storage for webhooks, snapshots, templates, and audit logs.
 * Extends the base storage with advanced features.
 */
import { Webhook, ProjectSnapshot, ProjectTemplate, AuditEntry, WebhookEvent, EventType } from './models.js';
export interface WebhookStorage {
    listWebhooks(): Promise<Webhook[]>;
    getWebhook(id: string): Promise<Webhook | null>;
    saveWebhook(webhook: Webhook): Promise<void>;
    deleteWebhook(id: string): Promise<boolean>;
    updateWebhookStats(id: string, success: boolean): Promise<void>;
}
export declare function createWebhookStorage(): Promise<WebhookStorage>;
export interface SnapshotStorage {
    listSnapshots(projectId?: string): Promise<ProjectSnapshot[]>;
    getSnapshot(id: string): Promise<ProjectSnapshot | null>;
    saveSnapshot(snapshot: ProjectSnapshot): Promise<void>;
    deleteSnapshot(id: string): Promise<boolean>;
    getLatestSnapshot(projectId: string): Promise<ProjectSnapshot | null>;
}
export declare function createSnapshotStorage(): Promise<SnapshotStorage>;
export interface TemplateStorage {
    listTemplates(): Promise<ProjectTemplate[]>;
    getTemplate(id: string): Promise<ProjectTemplate | null>;
    saveTemplate(template: ProjectTemplate): Promise<void>;
    deleteTemplate(id: string): Promise<boolean>;
    incrementUsage(id: string): Promise<void>;
}
export declare function createTemplateStorage(): Promise<TemplateStorage>;
export interface AuditStorage {
    listEntries(options?: {
        projectId?: string;
        limit?: number;
        since?: string;
    }): Promise<AuditEntry[]>;
    addEntry(entry: AuditEntry): Promise<void>;
    clearEntries(projectId?: string): Promise<number>;
}
export declare function createAuditStorage(): Promise<AuditStorage>;
export interface EventDispatcher {
    emit(event: WebhookEvent): Promise<void>;
    emitEvent(type: EventType, projectId: string, data: Record<string, unknown>): Promise<void>;
}
export declare function createEventDispatcher(): Promise<EventDispatcher>;
export interface AdvancedStorage {
    webhooks: WebhookStorage;
    snapshots: SnapshotStorage;
    templates: TemplateStorage;
    audit: AuditStorage;
    events: EventDispatcher;
}
export declare function getAdvancedStorage(): Promise<AdvancedStorage>;
//# sourceMappingURL=advanced-storage.d.ts.map