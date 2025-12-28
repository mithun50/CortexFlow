/**
 * CortexFlow - Advanced Storage Layer
 *
 * Storage for webhooks, snapshots, templates, and audit logs.
 * Extends the base storage with advanced features.
 */
import { readFile, writeFile, readdir, rm, mkdir } from 'fs/promises';
import { join } from 'path';
import { BUILT_IN_TEMPLATES, createWebhookEvent, } from './models.js';
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
async function ensureDir(path) {
    try {
        await mkdir(path, { recursive: true });
    }
    catch {
        // Directory already exists
    }
}
async function loadWebhooks() {
    try {
        const content = await readFile(WEBHOOKS_FILE, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return [];
    }
}
async function saveWebhooks(webhooks) {
    await ensureDir(DATA_DIR);
    await writeFile(WEBHOOKS_FILE, JSON.stringify(webhooks, null, 2), 'utf-8');
}
export async function createWebhookStorage() {
    await ensureDir(DATA_DIR);
    return {
        async listWebhooks() {
            return loadWebhooks();
        },
        async getWebhook(id) {
            const webhooks = await loadWebhooks();
            return webhooks.find((w) => w.id === id) ?? null;
        },
        async saveWebhook(webhook) {
            const webhooks = await loadWebhooks();
            const index = webhooks.findIndex((w) => w.id === webhook.id);
            if (index >= 0) {
                webhooks[index] = webhook;
            }
            else {
                webhooks.push(webhook);
            }
            await saveWebhooks(webhooks);
        },
        async deleteWebhook(id) {
            const webhooks = await loadWebhooks();
            const index = webhooks.findIndex((w) => w.id === id);
            if (index < 0)
                return false;
            webhooks.splice(index, 1);
            await saveWebhooks(webhooks);
            return true;
        },
        async updateWebhookStats(id, success) {
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
                }
                else {
                    webhook.failureCount = 0;
                }
                await saveWebhooks(webhooks);
            }
        },
    };
}
export async function createSnapshotStorage() {
    await ensureDir(SNAPSHOTS_DIR);
    return {
        async listSnapshots(projectId) {
            try {
                const files = await readdir(SNAPSHOTS_DIR);
                const snapshots = [];
                for (const file of files) {
                    if (file.endsWith('.json')) {
                        try {
                            const content = await readFile(join(SNAPSHOTS_DIR, file), 'utf-8');
                            const snapshot = JSON.parse(content);
                            if (!projectId || snapshot.projectId === projectId) {
                                snapshots.push(snapshot);
                            }
                        }
                        catch {
                            // Skip invalid files
                        }
                    }
                }
                // Sort by createdAt descending
                snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
                return snapshots;
            }
            catch {
                return [];
            }
        },
        async getSnapshot(id) {
            try {
                const content = await readFile(join(SNAPSHOTS_DIR, `${id}.json`), 'utf-8');
                return JSON.parse(content);
            }
            catch {
                return null;
            }
        },
        async saveSnapshot(snapshot) {
            await ensureDir(SNAPSHOTS_DIR);
            await writeFile(join(SNAPSHOTS_DIR, `${snapshot.id}.json`), JSON.stringify(snapshot, null, 2), 'utf-8');
        },
        async deleteSnapshot(id) {
            try {
                await rm(join(SNAPSHOTS_DIR, `${id}.json`));
                return true;
            }
            catch {
                return false;
            }
        },
        async getLatestSnapshot(projectId) {
            const storage = await createSnapshotStorage();
            const snapshots = await storage.listSnapshots(projectId);
            return snapshots[0] ?? null;
        },
    };
}
async function loadCustomTemplates() {
    try {
        const content = await readFile(TEMPLATES_FILE, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return [];
    }
}
async function saveCustomTemplates(templates) {
    await ensureDir(DATA_DIR);
    await writeFile(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8');
}
export async function createTemplateStorage() {
    await ensureDir(DATA_DIR);
    return {
        async listTemplates() {
            const custom = await loadCustomTemplates();
            return [...BUILT_IN_TEMPLATES, ...custom];
        },
        async getTemplate(id) {
            // Check built-in first
            const builtin = BUILT_IN_TEMPLATES.find((t) => t.id === id);
            if (builtin)
                return builtin;
            // Then check custom
            const custom = await loadCustomTemplates();
            return custom.find((t) => t.id === id) ?? null;
        },
        async saveTemplate(template) {
            // Don't allow overwriting built-in templates
            if (BUILT_IN_TEMPLATES.some((t) => t.id === template.id)) {
                throw new Error('Cannot modify built-in templates');
            }
            const templates = await loadCustomTemplates();
            const index = templates.findIndex((t) => t.id === template.id);
            if (index >= 0) {
                templates[index] = template;
            }
            else {
                templates.push(template);
            }
            await saveCustomTemplates(templates);
        },
        async deleteTemplate(id) {
            // Don't allow deleting built-in templates
            if (BUILT_IN_TEMPLATES.some((t) => t.id === id)) {
                throw new Error('Cannot delete built-in templates');
            }
            const templates = await loadCustomTemplates();
            const index = templates.findIndex((t) => t.id === id);
            if (index < 0)
                return false;
            templates.splice(index, 1);
            await saveCustomTemplates(templates);
            return true;
        },
        async incrementUsage(id) {
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
async function loadAuditLog() {
    try {
        const content = await readFile(AUDIT_FILE, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return [];
    }
}
async function saveAuditLog(entries) {
    await ensureDir(DATA_DIR);
    // Keep only last 10000 entries to prevent unbounded growth
    const trimmed = entries.slice(-10000);
    await writeFile(AUDIT_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
}
export async function createAuditStorage() {
    await ensureDir(DATA_DIR);
    return {
        async listEntries(options = {}) {
            let entries = await loadAuditLog();
            if (options.projectId) {
                entries = entries.filter((e) => e.projectId === options.projectId);
            }
            if (options.since) {
                entries = entries.filter((e) => e.timestamp >= options.since);
            }
            // Sort by timestamp descending (newest first)
            entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
            if (options.limit) {
                entries = entries.slice(0, options.limit);
            }
            return entries;
        },
        async addEntry(entry) {
            const entries = await loadAuditLog();
            entries.push(entry);
            await saveAuditLog(entries);
        },
        async clearEntries(projectId) {
            const entries = await loadAuditLog();
            if (projectId) {
                const filtered = entries.filter((e) => e.projectId !== projectId);
                const cleared = entries.length - filtered.length;
                await saveAuditLog(filtered);
                return cleared;
            }
            else {
                await saveAuditLog([]);
                return entries.length;
            }
        },
    };
}
export async function createEventDispatcher() {
    const webhookStorage = await createWebhookStorage();
    async function dispatchToWebhook(webhook, event) {
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
        }
        catch {
            return false;
        }
    }
    return {
        async emit(event) {
            const webhooks = await webhookStorage.listWebhooks();
            for (const webhook of webhooks) {
                if (!webhook.active)
                    continue;
                if (!webhook.events.includes(event.type))
                    continue;
                const success = await dispatchToWebhook(webhook, event);
                await webhookStorage.updateWebhookStats(webhook.id, success);
            }
        },
        async emitEvent(type, projectId, data) {
            const event = createWebhookEvent(type, projectId, data);
            // Dispatch directly without using this
            const webhooks = await webhookStorage.listWebhooks();
            for (const webhook of webhooks) {
                if (!webhook.active)
                    continue;
                if (!webhook.events.includes(event.type))
                    continue;
                const success = await dispatchToWebhook(webhook, event);
                await webhookStorage.updateWebhookStats(webhook.id, success);
            }
        },
    };
}
let advancedStorageInstance = null;
export async function getAdvancedStorage() {
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
//# sourceMappingURL=advanced-storage.js.map