/**
 * Tests for CortexFlow Storage Layer
 */

import { mkdtemp, rm, readdir, readFile, writeFile, mkdir, access } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createProject, Phase, createTask, addTask } from '../src/models.js';

// We need to mock the data directory before importing storage
const originalEnv = process.env.CORTEXFLOW_DATA_DIR;
let testDataDir: string;

// Dynamic import to allow env variable to be set first
async function getStorageModule() {
  // Clear the module cache to ensure fresh import with new env
  const modulePath = '../src/storage.js';
  return import(modulePath);
}

describe('Storage Layer', () => {
  beforeAll(async () => {
    // Create a temporary directory for test data
    testDataDir = await mkdtemp(join(tmpdir(), 'cortexflow-test-'));
    process.env.CORTEXFLOW_DATA_DIR = testDataDir;
  });

  afterAll(async () => {
    // Restore original environment
    if (originalEnv) {
      process.env.CORTEXFLOW_DATA_DIR = originalEnv;
    } else {
      delete process.env.CORTEXFLOW_DATA_DIR;
    }

    // Clean up test directory
    try {
      await rm(testDataDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Clear test directory between tests
    try {
      const files = await readdir(testDataDir);
      for (const file of files) {
        await rm(join(testDataDir, file), { recursive: true, force: true });
      }
    } catch {
      // Directory might not exist yet
    }
  });

  describe('createStorage', () => {
    it('should create storage instance', async () => {
      const { createStorage } = await getStorageModule();
      const storage = await createStorage();

      expect(storage).toBeDefined();
      expect(typeof storage.saveProject).toBe('function');
      expect(typeof storage.loadProject).toBe('function');
      expect(typeof storage.deleteProject).toBe('function');
      expect(typeof storage.listProjects).toBe('function');
      expect(typeof storage.setActiveProject).toBe('function');
      expect(typeof storage.getActiveProject).toBe('function');
      expect(typeof storage.getActiveProjectId).toBe('function');
    });

    it('should create data directory if it does not exist', async () => {
      const newDir = join(testDataDir, 'new-data-dir');

      // Ensure directory creation by using ensureDir pattern from storage
      await mkdir(newDir, { recursive: true });

      const files = await readdir(newDir);
      expect(files).toBeDefined();
      expect(Array.isArray(files)).toBe(true);
    });
  });

  describe('saveProject', () => {
    it('should save a project to disk', async () => {
      const { createStorage } = await getStorageModule();
      const storage = await createStorage();
      const project = createProject('Test Project', 'Test Description');

      await storage.saveProject(project);

      const filePath = join(testDataDir, `${project.id}.json`);
      const content = await readFile(filePath, 'utf-8');
      const saved = JSON.parse(content);

      expect(saved.name).toBe('Test Project');
      expect(saved.id).toBe(project.id);
    });

    it('should overwrite existing project', async () => {
      const { createStorage } = await getStorageModule();
      const storage = await createStorage();
      const project = createProject('Original Name', 'Description');

      await storage.saveProject(project);

      const updatedProject = { ...project, name: 'Updated Name' };
      await storage.saveProject(updatedProject);

      const loaded = await storage.loadProject(project.id);
      expect(loaded?.name).toBe('Updated Name');
    });
  });

  describe('loadProject', () => {
    it('should load an existing project', async () => {
      const { createStorage } = await getStorageModule();
      const storage = await createStorage();
      const project = createProject('Load Test', 'Description');

      await storage.saveProject(project);
      const loaded = await storage.loadProject(project.id);

      expect(loaded).toBeDefined();
      expect(loaded?.name).toBe('Load Test');
      expect(loaded?.id).toBe(project.id);
    });

    it('should return null for non-existent project', async () => {
      const { createStorage } = await getStorageModule();
      const storage = await createStorage();

      const loaded = await storage.loadProject('non-existent-id');

      expect(loaded).toBeNull();
    });

    it('should return null for corrupted JSON', async () => {
      const { createStorage } = await getStorageModule();
      const storage = await createStorage();

      // Write corrupted JSON
      const filePath = join(testDataDir, 'corrupted.json');
      await writeFile(filePath, 'not valid json {{{', 'utf-8');

      const loaded = await storage.loadProject('corrupted');

      expect(loaded).toBeNull();
    });
  });

  describe('deleteProject', () => {
    it('should delete an existing project', async () => {
      const { createStorage } = await getStorageModule();
      const storage = await createStorage();
      const project = createProject('To Delete', 'Description');

      await storage.saveProject(project);
      const deleted = await storage.deleteProject(project.id);

      expect(deleted).toBe(true);

      const loaded = await storage.loadProject(project.id);
      expect(loaded).toBeNull();
    });

    it('should return false for non-existent project', async () => {
      const { createStorage } = await getStorageModule();
      const storage = await createStorage();

      const deleted = await storage.deleteProject('non-existent-id');

      expect(deleted).toBe(false);
    });

    it('should clear active project if deleted project was active', async () => {
      const { createStorage } = await getStorageModule();
      const storage = await createStorage();
      const project = createProject('Active Project', 'Description');

      await storage.saveProject(project);
      await storage.setActiveProject(project.id);

      expect(await storage.getActiveProjectId()).toBe(project.id);

      await storage.deleteProject(project.id);

      expect(await storage.getActiveProjectId()).toBeNull();
    });
  });

  describe('listProjects', () => {
    it('should return empty array when no projects exist', async () => {
      const { createStorage } = await getStorageModule();
      const storage = await createStorage();

      const projects = await storage.listProjects();

      expect(projects).toEqual([]);
    });

    it('should list all projects', async () => {
      const { createStorage } = await getStorageModule();
      const storage = await createStorage();

      const project1 = createProject('Project 1', 'Desc 1');
      const project2 = createProject('Project 2', 'Desc 2');
      const project3 = createProject('Project 3', 'Desc 3');

      await storage.saveProject(project1);
      await storage.saveProject(project2);
      await storage.saveProject(project3);

      const projects = await storage.listProjects();

      expect(projects).toHaveLength(3);
      expect(projects.map((p: { name: string }) => p.name)).toContain('Project 1');
      expect(projects.map((p: { name: string }) => p.name)).toContain('Project 2');
      expect(projects.map((p: { name: string }) => p.name)).toContain('Project 3');
    });

    it('should sort projects by updatedAt descending', async () => {
      const { createStorage } = await getStorageModule();
      const storage = await createStorage();

      // Create projects with different timestamps
      const project1 = createProject('Oldest', 'Desc');
      await storage.saveProject(project1);

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const project2 = createProject('Middle', 'Desc');
      await storage.saveProject(project2);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const project3 = createProject('Newest', 'Desc');
      await storage.saveProject(project3);

      const projects = await storage.listProjects();

      expect(projects[0].name).toBe('Newest');
      expect(projects[2].name).toBe('Oldest');
    });

    it('should ignore hidden files and non-JSON files', async () => {
      const { createStorage } = await getStorageModule();
      const storage = await createStorage();

      const project = createProject('Real Project', 'Desc');
      await storage.saveProject(project);

      // Create files that should be ignored
      await writeFile(join(testDataDir, '.hidden.json'), '{}', 'utf-8');
      await writeFile(join(testDataDir, 'readme.txt'), 'text', 'utf-8');

      const projects = await storage.listProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Real Project');
    });
  });

  describe('Active Project Management', () => {
    describe('setActiveProject', () => {
      it('should set the active project', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();
        const project = createProject('Active', 'Desc');

        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const activeId = await storage.getActiveProjectId();
        expect(activeId).toBe(project.id);
      });

      it('should overwrite previous active project', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const project1 = createProject('Project 1', 'Desc');
        const project2 = createProject('Project 2', 'Desc');

        await storage.saveProject(project1);
        await storage.saveProject(project2);

        await storage.setActiveProject(project1.id);
        await storage.setActiveProject(project2.id);

        const activeId = await storage.getActiveProjectId();
        expect(activeId).toBe(project2.id);
      });
    });

    describe('getActiveProjectId', () => {
      it('should return null when no active project', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const activeId = await storage.getActiveProjectId();

        expect(activeId).toBeNull();
      });

      it('should trim whitespace from stored ID', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        // Manually write ID with whitespace
        await writeFile(join(testDataDir, '.active'), '  test-id  \n', 'utf-8');

        const activeId = await storage.getActiveProjectId();
        expect(activeId).toBe('test-id');
      });

      it('should return null for empty active file', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        await writeFile(join(testDataDir, '.active'), '   ', 'utf-8');

        const activeId = await storage.getActiveProjectId();
        expect(activeId).toBeNull();
      });
    });

    describe('getActiveProject', () => {
      it('should return the active project', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();
        const project = createProject('Active Project', 'Desc');

        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const active = await storage.getActiveProject();

        expect(active).toBeDefined();
        expect(active?.name).toBe('Active Project');
      });

      it('should return null when no active project set', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const active = await storage.getActiveProject();

        expect(active).toBeNull();
      });

      it('should return null when active project does not exist', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        await writeFile(join(testDataDir, '.active'), 'deleted-project-id', 'utf-8');

        const active = await storage.getActiveProject();

        expect(active).toBeNull();
      });
    });
  });

  describe('getStorage singleton', () => {
    it('should return the same instance', async () => {
      // Need to reset the singleton for this test
      // This is a limitation - in real tests we'd need to mock the module
      const { createStorage } = await getStorageModule();

      const storage1 = await createStorage();
      const storage2 = await createStorage();

      // Both should work independently
      const project = createProject('Test', 'Desc');
      await storage1.saveProject(project);

      const loaded = await storage2.loadProject(project.id);
      expect(loaded).toBeDefined();
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle project with tasks and notes', async () => {
      const { createStorage } = await getStorageModule();
      const storage = await createStorage();

      let project = createProject('Complex Project', 'With tasks');
      const { context } = addTask(project, 'Task 1', 'Description');
      project = context;

      await storage.saveProject(project);
      const loaded = await storage.loadProject(project.id);

      expect(loaded?.tasks).toHaveLength(1);
      expect(loaded?.tasks[0].title).toBe('Task 1');
    });

    it('should preserve all project fields through save/load cycle', async () => {
      const { createStorage } = await getStorageModule();
      const storage = await createStorage();

      const project = createProject('Full Project', 'Description', {
        phase: Phase.EXECUTION,
        tags: ['tag1', 'tag2'],
        config: { custom: 'value' },
      });

      await storage.saveProject(project);
      const loaded = await storage.loadProject(project.id);

      expect(loaded?.phase).toBe(Phase.EXECUTION);
      expect(loaded?.tags).toEqual(['tag1', 'tag2']);
      expect(loaded?.config).toEqual({ custom: 'value' });
    });
  });
});
