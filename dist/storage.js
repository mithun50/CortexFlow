/**
 * CortexFlow - Persistent Storage Layer
 *
 * Provides JSON file-based storage for project contexts.
 * Supports multi-project management and atomic file operations.
 */
import { readFile, writeFile, mkdir, readdir, unlink } from "fs/promises";
import { join, dirname } from "path";
import { homedir } from "os";
import { serializeContext, deserializeContext, } from "./models.js";
// ============================================================================
// Configuration
// ============================================================================
const DATA_DIR = process.env.CORTEXFLOW_DATA_DIR ?? join(homedir(), ".cortexflow", "data");
// ============================================================================
// File System Utilities
// ============================================================================
async function ensureDir(dir) {
    try {
        await mkdir(dir, { recursive: true });
    }
    catch {
        // Directory already exists
    }
}
function getProjectPath(projectId) {
    return join(DATA_DIR, `${projectId}.json`);
}
export async function createStorage() {
    await ensureDir(DATA_DIR);
    const activeProjectPath = join(DATA_DIR, ".active");
    async function saveProject(context) {
        const path = getProjectPath(context.id);
        await ensureDir(dirname(path));
        await writeFile(path, serializeContext(context), "utf-8");
    }
    async function loadProject(projectId) {
        const path = getProjectPath(projectId);
        try {
            const data = await readFile(path, "utf-8");
            return deserializeContext(data);
        }
        catch {
            return null;
        }
    }
    async function deleteProject(projectId) {
        const path = getProjectPath(projectId);
        try {
            await unlink(path);
            // Clear active project if it was deleted
            const activeId = await getActiveProjectId();
            if (activeId === projectId) {
                await unlink(activeProjectPath).catch(() => { });
            }
            return true;
        }
        catch {
            return false;
        }
    }
    async function listProjects() {
        try {
            const files = await readdir(DATA_DIR);
            const projects = [];
            for (const file of files) {
                if (file.endsWith(".json") && !file.startsWith(".")) {
                    const projectId = file.replace(".json", "");
                    const project = await loadProject(projectId);
                    if (project) {
                        projects.push(project);
                    }
                }
            }
            return projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        }
        catch {
            return [];
        }
    }
    async function setActiveProject(projectId) {
        await writeFile(activeProjectPath, projectId, "utf-8");
    }
    async function getActiveProjectId() {
        try {
            const id = await readFile(activeProjectPath, "utf-8");
            return id.trim() || null;
        }
        catch {
            return null;
        }
    }
    async function getActiveProject() {
        const id = await getActiveProjectId();
        if (!id)
            return null;
        return loadProject(id);
    }
    return {
        saveProject,
        loadProject,
        deleteProject,
        listProjects,
        setActiveProject,
        getActiveProject,
        getActiveProjectId,
    };
}
// ============================================================================
// Singleton instance
// ============================================================================
let storageInstance = null;
export async function getStorage() {
    if (!storageInstance) {
        storageInstance = await createStorage();
    }
    return storageInstance;
}
//# sourceMappingURL=storage.js.map