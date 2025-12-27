/**
 * CortexFlow - Persistent Storage Layer
 *
 * Provides JSON file-based storage for project contexts.
 * Supports multi-project management and atomic file operations.
 */

import { readFile, writeFile, mkdir, readdir, unlink, access } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { ProjectContext, serializeContext, deserializeContext } from './models.js';

// ============================================================================
// Configuration
// ============================================================================

const DATA_DIR = process.env.CORTEXFLOW_DATA_DIR ?? join(homedir(), '.cortexflow', 'data');

// ============================================================================
// File System Utilities
// ============================================================================

async function ensureDir(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    // Directory already exists
  }
}

async function _fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function getProjectPath(projectId: string): string {
  return join(DATA_DIR, `${projectId}.json`);
}

// ============================================================================
// Storage Operations
// ============================================================================

export interface Storage {
  // Project CRUD
  saveProject(context: ProjectContext): Promise<void>;
  loadProject(projectId: string): Promise<ProjectContext | null>;
  deleteProject(projectId: string): Promise<boolean>;
  listProjects(): Promise<ProjectContext[]>;

  // Active project tracking
  setActiveProject(projectId: string): Promise<void>;
  getActiveProject(): Promise<ProjectContext | null>;
  getActiveProjectId(): Promise<string | null>;
}

export async function createStorage(): Promise<Storage> {
  await ensureDir(DATA_DIR);

  const activeProjectPath = join(DATA_DIR, '.active');

  async function saveProject(context: ProjectContext): Promise<void> {
    const path = getProjectPath(context.id);
    await ensureDir(dirname(path));
    await writeFile(path, serializeContext(context), 'utf-8');
  }

  async function loadProject(projectId: string): Promise<ProjectContext | null> {
    const path = getProjectPath(projectId);
    try {
      const data = await readFile(path, 'utf-8');
      return deserializeContext(data);
    } catch {
      return null;
    }
  }

  async function deleteProject(projectId: string): Promise<boolean> {
    const path = getProjectPath(projectId);
    try {
      await unlink(path);
      // Clear active project if it was deleted
      const activeId = await getActiveProjectId();
      if (activeId === projectId) {
        await unlink(activeProjectPath).catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }

  async function listProjects(): Promise<ProjectContext[]> {
    try {
      const files = await readdir(DATA_DIR);
      const projects: ProjectContext[] = [];

      for (const file of files) {
        if (file.endsWith('.json') && !file.startsWith('.')) {
          const projectId = file.replace('.json', '');
          const project = await loadProject(projectId);
          if (project) {
            projects.push(project);
          }
        }
      }

      return projects.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch {
      return [];
    }
  }

  async function setActiveProject(projectId: string): Promise<void> {
    await writeFile(activeProjectPath, projectId, 'utf-8');
  }

  async function getActiveProjectId(): Promise<string | null> {
    try {
      const id = await readFile(activeProjectPath, 'utf-8');
      return id.trim() || null;
    } catch {
      return null;
    }
  }

  async function getActiveProject(): Promise<ProjectContext | null> {
    const id = await getActiveProjectId();
    if (!id) return null;
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

let storageInstance: Storage | null = null;

export async function getStorage(): Promise<Storage> {
  if (!storageInstance) {
    storageInstance = await createStorage();
  }
  return storageInstance;
}
