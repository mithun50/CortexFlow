/**
 * CortexFlow - Advanced Storage Layer
 *
 * Storage for webhooks, snapshots, templates, and audit logs.
 * Extends the base storage with advanced features.
 */

import { readFile, writeFile, readdir, rm, mkdir } from 'fs/promises';
import { join } from 'path';
import {
  Webhook,
  ProjectSnapshot,
  ProjectTemplate,
  AuditEntry,
  WebhookEvent,
  EventType,
  BUILT_IN_TEMPLATES,
  createWebhookEvent,
} from './models.js';

// ============================================================================
// Storage Paths
// ============================================================================

const DATA_DIR = process.env.CORTEXFLOW_DATA_DIR ?? join(process.cwd(), '.cortexflow');
const WEBHOOKS_FILE = join(DATA_DIR, '.webhooks.json');
const SNAPSHOTS_DIR = join(DATA_DIR, 'snapshots');
const TEMPLATES_FILE = join(DATA_DIR, '.templates.json');
const AUDIT_FILE = join(DATA_DIR, '.audit.json');

// ============================================================================
// Ensure Directories
// ============================================================================

async function ensureDir(path: string): Promise<void> {
  try {
    await mkdir(path, { recursive: true });
  } catch {
    // Directory already exists
  }
}

// ============================================================================
// Webhook Storage
// ============================================================================

export interface WebhookStorage {
  listWebhooks(): Promise<Webhook[]>;
  getWebhook(id: string): Promise<Webhook | null>;
  saveWebhook(webhook: Webhook): Promise<void>;
  deleteWebhook(id: string): Promise<boolean>;
  updateWebhookStats(id: string, success: boolean): Promise<void>;
}

async function loadWebhooks(): Promise<Webhook[]> {
  try {
    const content = await readFile(WEBHOOKS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function saveWebhooks(webhooks: Webhook[]): Promise<void> {
  await ensureDir(DATA_DIR);
  await writeFile(WEBHOOKS_FILE, JSON.stringify(webhooks, null, 2), 'utf-8');
}

export async function createWebhookStorage(): Promise<WebhookStorage> {
  await ensureDir(DATA_DIR);

  return {
    async listWebhooks(): Promise<Webhook[]> {
      return loadWebhooks();
    },

    async getWebhook(id: string): Promise<Webhook | null> {
      const webhooks = await loadWebhooks();
      return webhooks.find((w) => w.id === id) ?? null;
    },

    async saveWebhook(webhook: Webhook): Promise<void> {
      const webhooks = await loadWebhooks();
      const index = webhooks.findIndex((w) => w.id === webhook.id);
      if (index >= 0) {
        webhooks[index] = webhook;
      } else {
        webhooks.push(webhook);
      }
      await saveWebhooks(webhooks);
    },

    async deleteWebhook(id: string): Promise<boolean> {
      const webhooks = await loadWebhooks();
      const index = webhooks.findIndex((w) => w.id === id);
      if (index < 0) return false;
      webhooks.splice(index, 1);
      await saveWebhooks(webhooks);
      return true;
    },

    async updateWebhookStats(id: string, success: boolean): Promise<void> {
      const webhooks = await loadWebhooks();
      const webhook = webhooks.find((w) => w.id === id);
      if (webhook) {
        webhook.lastTriggeredAt = new Date().toISOString();
        if (!success) {
          webhook.failureCount++;
          // Disable after 5 consecutive failures
          if (webhook.failureCount >= 5) {
            webhook.active = false;
          }
        } else {
          webhook.failureCount = 0;
        }
        await saveWebhooks(webhooks);
      }
    },
  };
}

// ============================================================================
// Snapshot Storage
// ============================================================================

export interface SnapshotStorage {
  listSnapshots(projectId?: string): Promise<ProjectSnapshot[]>;
  getSnapshot(id: string): Promise<ProjectSnapshot | null>;
  saveSnapshot(snapshot: ProjectSnapshot): Promise<void>;
  deleteSnapshot(id: string): Promise<boolean>;
  getLatestSnapshot(projectId: string): Promise<ProjectSnapshot | null>;
}

export async function createSnapshotStorage(): Promise<SnapshotStorage> {
  await ensureDir(SNAPSHOTS_DIR);

  return {
    async listSnapshots(projectId?: string): Promise<ProjectSnapshot[]> {
      try {
        const files = await readdir(SNAPSHOTS_DIR);
        const snapshots: ProjectSnapshot[] = [];
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const content = await readFile(join(SNAPSHOTS_DIR, file), 'utf-8');
              const snapshot = JSON.parse(content) as ProjectSnapshot;
              if (!projectId || snapshot.projectId === projectId) {
                snapshots.push(snapshot);
              }
            } catch {
              // Skip invalid files
            }
          }
        }
        // Sort by createdAt descending
        snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return snapshots;
      } catch {
        return [];
      }
    },

    async getSnapshot(id: string): Promise<ProjectSnapshot | null> {
      try {
        const content = await readFile(join(SNAPSHOTS_DIR, `${id}.json`), 'utf-8');
        return JSON.parse(content);
      } catch {
        return null;
      }
    },

    async saveSnapshot(snapshot: ProjectSnapshot): Promise<void> {
      await ensureDir(SNAPSHOTS_DIR);
      await writeFile(
        join(SNAPSHOTS_DIR, `${snapshot.id}.json`),
        JSON.stringify(snapshot, null, 2),
        'utf-8'
      );
    },

    async deleteSnapshot(id: string): Promise<boolean> {
      try {
        await rm(join(SNAPSHOTS_DIR, `${id}.json`));
        return true;
      } catch {
        return false;
      }
    },

    async getLatestSnapshot(projectId: string): Promise<ProjectSnapshot | null> {
      const storage = await createSnapshotStorage();
      const snapshots = await storage.listSnapshots(projectId);
      return snapshots[0] ?? null;
    },
  };
}

// ============================================================================
// Template Storage
// ============================================================================

export interface TemplateStorage {
  listTemplates(): Promise<ProjectTemplate[]>;
  getTemplate(id: string): Promise<ProjectTemplate | null>;
  saveTemplate(template: ProjectTemplate): Promise<void>;
  deleteTemplate(id: string): Promise<boolean>;
  incrementUsage(id: string): Promise<void>;
}

async function loadCustomTemplates(): Promise<ProjectTemplate[]> {
  try {
    const content = await readFile(TEMPLATES_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function saveCustomTemplates(templates: ProjectTemplate[]): Promise<void> {
  await ensureDir(DATA_DIR);
  await writeFile(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8');
}

export async function createTemplateStorage(): Promise<TemplateStorage> {
  await ensureDir(DATA_DIR);

  return {
    async listTemplates(): Promise<ProjectTemplate[]> {
      const custom = await loadCustomTemplates();
      return [...BUILT_IN_TEMPLATES, ...custom];
    },

    async getTemplate(id: string): Promise<ProjectTemplate | null> {
      // Check built-in first
      const builtin = BUILT_IN_TEMPLATES.find((t) => t.id === id);
      if (builtin) return builtin;

      // Then check custom
      const custom = await loadCustomTemplates();
      return custom.find((t) => t.id === id) ?? null;
    },

    async saveTemplate(template: ProjectTemplate): Promise<void> {
      // Don't allow overwriting built-in templates
      if (BUILT_IN_TEMPLATES.some((t) => t.id === template.id)) {
        throw new Error('Cannot modify built-in templates');
      }

      const templates = await loadCustomTemplates();
      const index = templates.findIndex((t) => t.id === template.id);
      if (index >= 0) {
        templates[index] = template;
      } else {
        templates.push(template);
      }
      await saveCustomTemplates(templates);
    },

    async deleteTemplate(id: string): Promise<boolean> {
      // Don't allow deleting built-in templates
      if (BUILT_IN_TEMPLATES.some((t) => t.id === id)) {
        throw new Error('Cannot delete built-in templates');
      }

      const templates = await loadCustomTemplates();
      const index = templates.findIndex((t) => t.id === id);
      if (index < 0) return false;
      templates.splice(index, 1);
      await saveCustomTemplates(templates);
      return true;
    },

    async incrementUsage(id: string): Promise<void> {
      // Only track usage for custom templates
      const templates = await loadCustomTemplates();
      const template = templates.find((t) => t.id === id);
      if (template) {
        template.usageCount++;
        await saveCustomTemplates(templates);
      }
    },
  };
}

// ============================================================================
// Audit Storage
// ============================================================================

export interface AuditStorage {
  listEntries(options?: {
    projectId?: string;
    limit?: number;
    since?: string;
  }): Promise<AuditEntry[]>;
  addEntry(entry: AuditEntry): Promise<void>;
  clearEntries(projectId?: string): Promise<number>;
}

async function loadAuditLog(): Promise<AuditEntry[]> {
  try {
    const content = await readFile(AUDIT_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function saveAuditLog(entries: AuditEntry[]): Promise<void> {
  await ensureDir(DATA_DIR);
  // Keep only last 10000 entries to prevent unbounded growth
  const trimmed = entries.slice(-10000);
  await writeFile(AUDIT_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
}

export async function createAuditStorage(): Promise<AuditStorage> {
  await ensureDir(DATA_DIR);

  return {
    async listEntries(options = {}): Promise<AuditEntry[]> {
      let entries = await loadAuditLog();

      if (options.projectId) {
        entries = entries.filter((e) => e.projectId === options.projectId);
      }
      if (options.since) {
        entries = entries.filter((e) => e.timestamp >= options.since!);
      }

      // Sort by timestamp descending (newest first)
      entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      if (options.limit) {
        entries = entries.slice(0, options.limit);
      }

      return entries;
    },

    async addEntry(entry: AuditEntry): Promise<void> {
      const entries = await loadAuditLog();
      entries.push(entry);
      await saveAuditLog(entries);
    },

    async clearEntries(projectId?: string): Promise<number> {
      const entries = await loadAuditLog();
      if (projectId) {
        const filtered = entries.filter((e) => e.projectId !== projectId);
        const cleared = entries.length - filtered.length;
        await saveAuditLog(filtered);
        return cleared;
      } else {
        await saveAuditLog([]);
        return entries.length;
      }
    },
  };
}

// ============================================================================
// Event Dispatcher
// ============================================================================

export interface EventDispatcher {
  emit(event: WebhookEvent): Promise<void>;
  emitEvent(type: EventType, projectId: string, data: Record<string, unknown>): Promise<void>;
}

export async function createEventDispatcher(): Promise<EventDispatcher> {
  const webhookStorage = await createWebhookStorage();

  async function dispatchToWebhook(webhook: Webhook, event: WebhookEvent): Promise<boolean> {
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CortexFlow-Event': event.type,
          'X-CortexFlow-Signature': webhook.secret ? `sha256=${webhook.secret}` : '',
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  return {
    async emit(event: WebhookEvent): Promise<void> {
      const webhooks = await webhookStorage.listWebhooks();

      for (const webhook of webhooks) {
        if (!webhook.active) continue;
        if (!webhook.events.includes(event.type)) continue;

        const success = await dispatchToWebhook(webhook, event);
        await webhookStorage.updateWebhookStats(webhook.id, success);
      }
    },

    async emitEvent(
      type: EventType,
      projectId: string,
      data: Record<string, unknown>
    ): Promise<void> {
      const event = createWebhookEvent(type, projectId, data);
      // Dispatch directly without using this
      const webhooks = await webhookStorage.listWebhooks();
      for (const webhook of webhooks) {
        if (!webhook.active) continue;
        if (!webhook.events.includes(event.type)) continue;
        const success = await dispatchToWebhook(webhook, event);
        await webhookStorage.updateWebhookStats(webhook.id, success);
      }
    },
  };
}

// ============================================================================
// Unified Advanced Storage
// ============================================================================

export interface AdvancedStorage {
  webhooks: WebhookStorage;
  snapshots: SnapshotStorage;
  templates: TemplateStorage;
  audit: AuditStorage;
  events: EventDispatcher;
}

let advancedStorageInstance: AdvancedStorage | null = null;

export async function getAdvancedStorage(): Promise<AdvancedStorage> {
  if (!advancedStorageInstance) {
    advancedStorageInstance = {
      webhooks: await createWebhookStorage(),
      snapshots: await createSnapshotStorage(),
      templates: await createTemplateStorage(),
      audit: await createAuditStorage(),
      events: await createEventDispatcher(),
    };
  }
  return advancedStorageInstance;
}
