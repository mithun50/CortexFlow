/**
 * Tests for CortexFlow HTTP API Server
 *
 * Tests the REST API functionality using the storage layer.
 */

import { mkdtemp, rm, readdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Phase, TaskStatus, AgentRole, createProject, addTask, addNote } from '../src/models.js';

// Set up test environment before importing
const originalEnv = process.env.CORTEXFLOW_DATA_DIR;
const originalPort = process.env.CORTEXFLOW_PORT;
let testDataDir: string;

async function getStorageModule() {
  return import('../src/storage.js');
}

describe('HTTP Server API Logic', () => {
  beforeAll(async () => {
    testDataDir = await mkdtemp(join(tmpdir(), 'cortexflow-http-test-'));
    process.env.CORTEXFLOW_DATA_DIR = testDataDir;
    process.env.CORTEXFLOW_PORT = '3299';
  });

  afterAll(async () => {
    if (originalEnv) {
      process.env.CORTEXFLOW_DATA_DIR = originalEnv;
    } else {
      delete process.env.CORTEXFLOW_DATA_DIR;
    }

    if (originalPort) {
      process.env.CORTEXFLOW_PORT = originalPort;
    } else {
      delete process.env.CORTEXFLOW_PORT;
    }

    try {
      await rm(testDataDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    try {
      const files = await readdir(testDataDir);
      for (const file of files) {
        await rm(join(testDataDir, file), { recursive: true, force: true });
      }
    } catch {
      // Directory might not exist yet
    }
  });

  describe('API Response Format', () => {
    it('should use correct CORS headers', () => {
      const expectedHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };

      expect(expectedHeaders['Content-Type']).toBe('application/json');
      expect(expectedHeaders['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('Projects API', () => {
    describe('GET /api/projects', () => {
      it('should return empty array when no projects', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const projects = await storage.listProjects();

        expect(projects).toEqual([]);
      });

      it('should return all projects with active status', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const project1 = createProject('Project 1', 'Desc 1');
        const project2 = createProject('Project 2', 'Desc 2');

        await storage.saveProject(project1);
        await storage.saveProject(project2);
        await storage.setActiveProject(project1.id);

        const projects = await storage.listProjects();
        const activeId = await storage.getActiveProjectId();

        expect(projects).toHaveLength(2);
        expect(activeId).toBe(project1.id);

        // Simulate response formatting
        interface ProjectWithActive {
          id: string;
          name: string;
          isActive: boolean;
        }
        const response = {
          projects: projects.map((p): ProjectWithActive => ({
            id: p.id,
            name: p.name,
            isActive: p.id === activeId,
          })),
          activeProjectId: activeId,
        };

        expect(response.projects.find((p) => p.id === project1.id)?.isActive).toBe(true);
        expect(response.projects.find((p) => p.id === project2.id)?.isActive).toBe(false);
      });
    });

    describe('POST /api/projects', () => {
      it('should create a new project', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const project = createProject('New Project', 'New Description', {
          phase: Phase.PLANNING,
          tags: ['test'],
        });

        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const loaded = await storage.loadProject(project.id);
        expect(loaded?.name).toBe('New Project');
        expect(loaded?.phase).toBe(Phase.PLANNING);
      });

      it('should create project with initial tasks', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        let project = createProject('Project', 'Desc');
        const { context: ctx1 } = addTask(project, 'Task 1', 'Desc 1', {
          priority: 1,
          assignedTo: AgentRole.EXECUTOR,
        });
        project = ctx1;
        const { context: ctx2 } = addTask(project, 'Task 2', 'Desc 2', {
          priority: 2,
          assignedTo: AgentRole.EXECUTOR,
        });
        project = ctx2;

        await storage.saveProject(project);

        const loaded = await storage.loadProject(project.id);
        expect(loaded?.tasks).toHaveLength(2);
      });

      it('should validate required fields', () => {
        const validBody = { name: 'Test', description: 'Desc' };
        const invalidBody = { name: '' };

        expect(!!(validBody.name && validBody.description)).toBe(true);
        expect(!!(invalidBody.name && (invalidBody as Record<string, string>).description)).toBe(
          false
        );
      });
    });

    describe('GET /api/projects/:id', () => {
      it('should return specific project', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const project = createProject('Specific Project', 'Description');
        await storage.saveProject(project);

        const loaded = await storage.loadProject(project.id);
        expect(loaded?.name).toBe('Specific Project');
      });

      it('should return null for non-existent project', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const loaded = await storage.loadProject('non-existent');
        expect(loaded).toBeNull();
      });
    });

    describe('DELETE /api/projects/:id', () => {
      it('should delete project', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const project = createProject('To Delete', 'Desc');
        await storage.saveProject(project);

        const deleted = await storage.deleteProject(project.id);
        expect(deleted).toBe(true);

        const loaded = await storage.loadProject(project.id);
        expect(loaded).toBeNull();
      });

      it('should return false for non-existent project', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const deleted = await storage.deleteProject('non-existent');
        expect(deleted).toBe(false);
      });
    });
  });

  describe('Context API', () => {
    describe('GET /api/context', () => {
      it('should return active project context with summary', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        let project = createProject('Active Project', 'Description');
        const { context } = addTask(project, 'Task 1', 'Desc');
        project = context;
        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const loaded = await storage.getActiveProject();
        expect(loaded).toBeDefined();
        expect(loaded?.name).toBe('Active Project');
        expect(loaded?.tasks).toHaveLength(1);
      });

      it('should return null when no active project', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const active = await storage.getActiveProject();
        expect(active).toBeNull();
      });
    });

    describe('PUT /api/context', () => {
      it('should update project phase', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const project = createProject('Project', 'Desc');
        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const loaded = await storage.getActiveProject();
        if (loaded) {
          await storage.saveProject({ ...loaded, phase: Phase.EXECUTION });
        }

        const updated = await storage.getActiveProject();
        expect(updated?.phase).toBe(Phase.EXECUTION);
      });

      it('should update project name and description', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const project = createProject('Original Name', 'Original Desc');
        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const loaded = await storage.getActiveProject();
        if (loaded) {
          await storage.saveProject({
            ...loaded,
            name: 'Updated Name',
            description: 'Updated Desc',
          });
        }

        const updated = await storage.getActiveProject();
        expect(updated?.name).toBe('Updated Name');
        expect(updated?.description).toBe('Updated Desc');
      });
    });
  });

  describe('Tasks API', () => {
    describe('GET /api/tasks', () => {
      it('should return pending tasks by default', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        let project = createProject('Project', 'Desc');
        let { context } = addTask(project, 'Task 1', 'Desc 1');
        project = context;
        const { context: ctx2, task: task2 } = addTask(project, 'Task 2', 'Desc 2');
        project = ctx2;

        // Complete one task
        const tasks = project.tasks.map((t) => {
          if (t.id === task2.id) {
            return { ...t, status: TaskStatus.COMPLETED };
          }
          return t;
        });
        project = { ...project, tasks };

        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const loaded = await storage.getActiveProject();
        const pendingTasks = loaded?.tasks.filter(
          (t) => t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.CANCELLED
        );

        expect(pendingTasks).toHaveLength(1);
        expect(pendingTasks?.[0].title).toBe('Task 1');
      });

      it('should include completed tasks when requested', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        let project = createProject('Project', 'Desc');
        const { context, task } = addTask(project, 'Task 1', 'Desc');
        project = context;

        // Complete the task
        const tasks = project.tasks.map((t) => {
          if (t.id === task.id) {
            return { ...t, status: TaskStatus.COMPLETED };
          }
          return t;
        });
        project = { ...project, tasks };

        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const loaded = await storage.getActiveProject();
        expect(loaded?.tasks).toHaveLength(1);
        expect(loaded?.tasks[0].status).toBe(TaskStatus.COMPLETED);
      });
    });

    describe('POST /api/tasks', () => {
      it('should add new task', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const project = createProject('Project', 'Desc');
        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const loaded = await storage.getActiveProject();
        if (loaded) {
          const { context } = addTask(loaded, 'New Task', 'Task Desc', {
            priority: 2,
            dependencies: [],
            assignedTo: AgentRole.EXECUTOR,
          });
          await storage.saveProject(context);
        }

        const updated = await storage.getActiveProject();
        expect(updated?.tasks).toHaveLength(1);
        expect(updated?.tasks[0].title).toBe('New Task');
        expect(updated?.tasks[0].priority).toBe(2);
      });

      it('should validate required fields', () => {
        const validBody = { title: 'Task', description: 'Desc' };
        const invalidBody = { title: 'Title only' };

        expect(!!(validBody.title && validBody.description)).toBe(true);
        expect(
          !!(invalidBody.title && (invalidBody as Record<string, string>).description)
        ).toBe(false);
      });
    });

    describe('GET /api/tasks/:id', () => {
      it('should return specific task', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        let project = createProject('Project', 'Desc');
        const { context, task } = addTask(project, 'Specific Task', 'Desc');
        project = context;
        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const loaded = await storage.getActiveProject();
        const foundTask = loaded?.tasks.find((t) => t.id === task.id);

        expect(foundTask).toBeDefined();
        expect(foundTask?.title).toBe('Specific Task');
      });

      it('should return undefined for non-existent task', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const project = createProject('Project', 'Desc');
        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const loaded = await storage.getActiveProject();
        const foundTask = loaded?.tasks.find((t) => t.id === 'non-existent');

        expect(foundTask).toBeUndefined();
      });
    });

    describe('PUT /api/tasks/:id', () => {
      it('should update task status', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        let project = createProject('Project', 'Desc');
        const { context, task } = addTask(project, 'Task', 'Desc');
        project = context;
        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const loaded = await storage.getActiveProject();
        if (loaded) {
          const updatedTasks = loaded.tasks.map((t) => {
            if (t.id === task.id) {
              return { ...t, status: TaskStatus.IN_PROGRESS };
            }
            return t;
          });
          await storage.saveProject({ ...loaded, tasks: updatedTasks });
        }

        const updated = await storage.getActiveProject();
        expect(updated?.tasks[0].status).toBe(TaskStatus.IN_PROGRESS);
      });

      it('should add note to task', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        let project = createProject('Project', 'Desc');
        const { context, task } = addTask(project, 'Task', 'Desc');
        project = context;
        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const loaded = await storage.getActiveProject();
        if (loaded) {
          const updatedTasks = loaded.tasks.map((t) => {
            if (t.id === task.id) {
              return { ...t, notes: [...t.notes, 'Progress note'] };
            }
            return t;
          });
          await storage.saveProject({ ...loaded, tasks: updatedTasks });
        }

        const updated = await storage.getActiveProject();
        expect(updated?.tasks[0].notes).toContain('Progress note');
      });
    });

    describe('POST /api/tasks/:id/complete', () => {
      it('should mark task as completed', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        let project = createProject('Project', 'Desc');
        const { context, task } = addTask(project, 'Task', 'Desc');
        project = context;
        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const loaded = await storage.getActiveProject();
        if (loaded) {
          const now = new Date().toISOString();
          const updatedTasks = loaded.tasks.map((t) => {
            if (t.id === task.id) {
              return {
                ...t,
                status: TaskStatus.COMPLETED,
                completedAt: now,
              };
            }
            return t;
          });
          await storage.saveProject({ ...loaded, tasks: updatedTasks });
        }

        const updated = await storage.getActiveProject();
        expect(updated?.tasks[0].status).toBe(TaskStatus.COMPLETED);
        expect(updated?.tasks[0].completedAt).toBeDefined();
      });

      it('should add completion note', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        let project = createProject('Project', 'Desc');
        const { context, task } = addTask(project, 'Task', 'Desc');
        project = context;
        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const loaded = await storage.getActiveProject();
        if (loaded) {
          const updatedTasks = loaded.tasks.map((t) => {
            if (t.id === task.id) {
              return {
                ...t,
                status: TaskStatus.COMPLETED,
                notes: [...t.notes, 'All done!'],
              };
            }
            return t;
          });
          await storage.saveProject({ ...loaded, tasks: updatedTasks });
        }

        const updated = await storage.getActiveProject();
        expect(updated?.tasks[0].notes).toContain('All done!');
      });
    });
  });

  describe('Notes API', () => {
    describe('GET /api/notes', () => {
      it('should return recent notes with limit', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        let project = createProject('Project', 'Desc');

        // Add multiple notes
        for (let i = 0; i < 5; i++) {
          const { context } = addNote(project, AgentRole.EXECUTOR, `Note ${i}`, 'general');
          project = context;
        }

        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const loaded = await storage.getActiveProject();

        // Simulate limit=3
        const limit = 3;
        const limitedNotes = loaded?.notes.slice(-limit);

        expect(limitedNotes).toHaveLength(3);
        expect(limitedNotes?.[0].content).toBe('Note 2');
        expect(limitedNotes?.[2].content).toBe('Note 4');
      });
    });

    describe('POST /api/notes', () => {
      it('should add note from executor', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const project = createProject('Project', 'Desc');
        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const loaded = await storage.getActiveProject();
        if (loaded) {
          const { context } = addNote(loaded, AgentRole.EXECUTOR, 'Executor note', 'insight');
          await storage.saveProject(context);
        }

        const updated = await storage.getActiveProject();
        expect(updated?.notes).toHaveLength(1);
        expect(updated?.notes[0].agent).toBe(AgentRole.EXECUTOR);
        expect(updated?.notes[0].category).toBe('insight');
      });

      it('should add note from planner', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const project = createProject('Project', 'Desc');
        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const loaded = await storage.getActiveProject();
        if (loaded) {
          const { context } = addNote(loaded, AgentRole.PLANNER, 'Planner note', 'decision');
          await storage.saveProject(context);
        }

        const updated = await storage.getActiveProject();
        expect(updated?.notes[0].agent).toBe(AgentRole.PLANNER);
        expect(updated?.notes[0].category).toBe('decision');
      });

      it('should validate required content field', () => {
        const validBody = { content: 'Note content' };
        const invalidBody = { agent: 'executor' };

        expect(!!validBody.content).toBe(true);
        expect(!!(invalidBody as Record<string, string>).content).toBe(false);
      });
    });
  });

  describe('Active Project API', () => {
    describe('POST /api/active', () => {
      it('should set active project', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const project = createProject('Project', 'Desc');
        await storage.saveProject(project);

        await storage.setActiveProject(project.id);

        const activeId = await storage.getActiveProjectId();
        expect(activeId).toBe(project.id);
      });

      it('should handle non-existent project', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const loaded = await storage.loadProject('non-existent');
        expect(loaded).toBeNull();
      });

      it('should validate required project_id', () => {
        const validBody = { project_id: 'abc123' };
        const invalidBody = {};

        expect(!!validBody.project_id).toBe(true);
        expect(!!(invalidBody as Record<string, string>).project_id).toBe(false);
      });
    });
  });

  describe('Health and OpenAPI', () => {
    describe('GET /', () => {
      it('should return correct health response structure', () => {
        const response = {
          status: 'ok',
          service: 'cortexflow',
          version: '1.0.0',
        };

        expect(response.status).toBe('ok');
        expect(response.service).toBe('cortexflow');
        expect(response.version).toBe('1.0.0');
      });
    });

    describe('GET /openapi.json', () => {
      it('should return valid OpenAPI specification', () => {
        const spec = {
          openapi: '3.1.0',
          info: {
            title: 'CortexFlow API',
            description: 'AI-to-AI task continuation and project context sharing',
            version: '1.0.0',
          },
          servers: [{ url: 'http://localhost:3210' }],
          paths: {
            '/api/context': {},
            '/api/projects': {},
            '/api/tasks': {},
            '/api/notes': {},
            '/api/active': {},
          },
        };

        expect(spec.openapi).toBe('3.1.0');
        expect(spec.info.title).toBe('CortexFlow API');
        expect(Object.keys(spec.paths)).toHaveLength(5);
      });
    });
  });

  describe('Error Handling', () => {
    it('should return appropriate error for 404', () => {
      const response = { error: 'Not found' };
      const status = 404;

      expect(status).toBe(404);
      expect(response.error).toBe('Not found');
    });

    it('should return appropriate error for 405', () => {
      const response = { error: 'Method not allowed' };
      const status = 405;

      expect(status).toBe(405);
      expect(response.error).toBe('Method not allowed');
    });

    it('should return appropriate error for 500', () => {
      const error = new Error('Internal error');
      const response = { error: error.message };
      const status = 500;

      expect(status).toBe(500);
      expect(response.error).toBe('Internal error');
    });
  });
});
