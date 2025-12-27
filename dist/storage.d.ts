/**
 * CortexFlow - Persistent Storage Layer
 *
 * Provides JSON file-based storage for project contexts.
 * Supports multi-project management and atomic file operations.
 */
import { ProjectContext } from './models.js';
export interface Storage {
    saveProject(context: ProjectContext): Promise<void>;
    loadProject(projectId: string): Promise<ProjectContext | null>;
    deleteProject(projectId: string): Promise<boolean>;
    listProjects(): Promise<ProjectContext[]>;
    setActiveProject(projectId: string): Promise<void>;
    getActiveProject(): Promise<ProjectContext | null>;
    getActiveProjectId(): Promise<string | null>;
}
export declare function createStorage(): Promise<Storage>;
export declare function getStorage(): Promise<Storage>;
//# sourceMappingURL=storage.d.ts.map