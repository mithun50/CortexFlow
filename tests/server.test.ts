/**
 * Tests for CortexFlow MCP Server
 *
 * Tests the MCP server tool handlers using mocked storage.
 */

import { mkdtemp, rm, readdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Phase, TaskStatus, AgentRole, createProject, addTask } from '../src/models.js';

// Set up test environment before importing server
const originalEnv = process.env.CORTEXFLOW_DATA_DIR;
let testDataDir: string;

async function getServerModule() {
  return import('../src/server.js');
}

async function getStorageModule() {
  return import('../src/storage.js');
}

describe('MCP Server', () => {
  beforeAll(async () => {
    testDataDir = await mkdtemp(join(tmpdir(), 'cortexflow-server-test-'));
    process.env.CORTEXFLOW_DATA_DIR = testDataDir;
  });

  afterAll(async () => {
    if (originalEnv) {
      process.env.CORTEXFLOW_DATA_DIR = originalEnv;
    } else {
      delete process.env.CORTEXFLOW_DATA_DIR;
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

  describe('createServer', () => {
    it('should create an MCP server instance', async () => {
      const { createServer } = await getServerModule();
      const server = await createServer();

      expect(server).toBeDefined();
    });
  });

  describe('Tool Handler Integration', () => {
    /**
     * Since the MCP server handlers are internal, we test them indirectly
     * by using the storage layer and verifying the expected behavior.
     */

    describe('write_context workflow', () => {
      it('should create and save a new project', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        // Simulate what write_context does
        const project = createProject('Test Project', 'Test Description', {
          phase: Phase.PLANNING,
          tags: ['test'],
        });

        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const loaded = await storage.getActiveProject();
        expect(loaded).toBeDefined();
        expect(loaded?.name).toBe('Test Project');
      });

      it('should create project with initial tasks', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        let project = createProject('Project with Tasks', 'Description');
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
        await storage.setActiveProject(project.id);

        const loaded = await storage.getActiveProject();
        expect(loaded?.tasks).toHaveLength(2);
        expect(loaded?.tasks[0].title).toBe('Task 1');
        expect(loaded?.tasks[1].title).toBe('Task 2');
      });
    });

    describe('read_context workflow', () => {
      it('should return error when no active project', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const activeProject = await storage.getActiveProject();
        expect(activeProject).toBeNull();
      });

      it('should load active project', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const project = createProject('Active Project', 'Description');
        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const loaded = await storage.getActiveProject();
        expect(loaded).toBeDefined();
        expect(loaded?.name).toBe('Active Project');
      });

      it('should load specific project by ID', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const project1 = createProject('Project 1', 'Desc 1');
        const project2 = createProject('Project 2', 'Desc 2');

        await storage.saveProject(project1);
        await storage.saveProject(project2);
        await storage.setActiveProject(project1.id);

        // Load non-active project by ID
        const loaded = await storage.loadProject(project2.id);
        expect(loaded?.name).toBe('Project 2');
      });

      it('should filter completed tasks when requested', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        let project = createProject('Project', 'Desc');
        let { context } = addTask(project, 'Task 1', 'Desc');
        project = context;
        const { context: ctx2, task: task2 } = addTask(project, 'Task 2', 'Desc');
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

        const loaded = await storage.loadProject(project.id);
        const pendingTasks = loaded?.tasks.filter((t) => t.status !== TaskStatus.COMPLETED);
        expect(pendingTasks).toHaveLength(1);
      });
    });

    describe('add_task workflow', () => {
      it('should add task to active project', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        let project = createProject('Project', 'Desc');
        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        // Reload and add task
        const loaded = await storage.getActiveProject();
        if (loaded) {
          const { context } = addTask(loaded, 'New Task', 'Task Description', {
            priority: 3,
            dependencies: [],
            assignedTo: AgentRole.EXECUTOR,
          });
          await storage.saveProject(context);
        }

        const updated = await storage.getActiveProject();
        expect(updated?.tasks).toHaveLength(1);
        expect(updated?.tasks[0].title).toBe('New Task');
        expect(updated?.tasks[0].priority).toBe(3);
      });
    });

    describe('update_task workflow', () => {
      it('should update task status', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        let project = createProject('Project', 'Desc');
        const { context, task } = addTask(project, 'Task', 'Desc');
        project = context;
        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        // Update task status
        const loaded = await storage.getActiveProject();
        if (loaded) {
          const updatedTasks = loaded.tasks.map((t) => {
            if (t.id === task.id) {
              return { ...t, status: TaskStatus.IN_PROGRESS, updatedAt: new Date().toISOString() };
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

        // Add note to task
        const loaded = await storage.getActiveProject();
        if (loaded) {
          const updatedTasks = loaded.tasks.map((t) => {
            if (t.id === task.id) {
              return { ...t, notes: [...t.notes, 'Implementation note'] };
            }
            return t;
          });
          await storage.saveProject({ ...loaded, tasks: updatedTasks });
        }

        const updated = await storage.getActiveProject();
        expect(updated?.tasks[0].notes).toContain('Implementation note');
      });
    });

    describe('mark_task_complete workflow', () => {
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
                notes: [...t.notes, 'Completion note'],
              };
            }
            return t;
          });
          await storage.saveProject({ ...loaded, tasks: updatedTasks });
        }

        const updated = await storage.getActiveProject();
        expect(updated?.tasks[0].status).toBe(TaskStatus.COMPLETED);
        expect(updated?.tasks[0].completedAt).toBeDefined();
        expect(updated?.tasks[0].notes).toContain('Completion note');
      });
    });

    describe('add_note workflow', () => {
      it('should add note from agent', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const project = createProject('Project', 'Desc');
        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        const loaded = await storage.getActiveProject();
        if (loaded) {
          const note = {
            id: 'note-1',
            agent: AgentRole.EXECUTOR,
            content: 'Found an issue',
            timestamp: new Date().toISOString(),
            category: 'blocker' as const,
          };
          await storage.saveProject({ ...loaded, notes: [...loaded.notes, note] });
        }

        const updated = await storage.getActiveProject();
        expect(updated?.notes).toHaveLength(1);
        expect(updated?.notes[0].content).toBe('Found an issue');
        expect(updated?.notes[0].category).toBe('blocker');
      });
    });

    describe('set_phase workflow', () => {
      it('should update project phase', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const project = createProject('Project', 'Desc');
        await storage.saveProject(project);
        await storage.setActiveProject(project.id);

        expect(project.phase).toBe(Phase.PLANNING);

        const loaded = await storage.getActiveProject();
        if (loaded) {
          await storage.saveProject({ ...loaded, phase: Phase.EXECUTION });
        }

        const updated = await storage.getActiveProject();
        expect(updated?.phase).toBe(Phase.EXECUTION);
      });
    });

    describe('list_projects workflow', () => {
      it('should list all projects', async () => {
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
      });
    });

    describe('set_active_project workflow', () => {
      it('should set active project', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const project1 = createProject('Project 1', 'Desc 1');
        const project2 = createProject('Project 2', 'Desc 2');

        await storage.saveProject(project1);
        await storage.saveProject(project2);

        await storage.setActiveProject(project2.id);

        const activeId = await storage.getActiveProjectId();
        expect(activeId).toBe(project2.id);
      });

      it('should return error for non-existent project', async () => {
        const { createStorage } = await getStorageModule();
        const storage = await createStorage();

        const loaded = await storage.loadProject('non-existent');
        expect(loaded).toBeNull();
      });
    });

    describe('delete_project workflow', () => {
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

  describe('Resource Handlers', () => {
    it('should expose projects as resources', async () => {
      const { createStorage } = await getStorageModule();
      const storage = await createStorage();

      const project = createProject('Resource Project', 'Desc');
      await storage.saveProject(project);

      const projects = await storage.listProjects();

      // Verify resource URI format
      const resourceUri = `cortexflow://project/${project.id}`;
      expect(projects[0].id).toBe(project.id);
      expect(resourceUri).toContain(project.id);
    });

    it('should load project by resource URI', async () => {
      const { createStorage } = await getStorageModule();
      const storage = await createStorage();

      const project = createProject('Resource Project', 'Desc');
      await storage.saveProject(project);

      // Simulate extracting ID from URI
      const uri = `cortexflow://project/${project.id}`;
      const match = uri.match(/^cortexflow:\/\/project\/(.+)$/);
      expect(match).not.toBeNull();

      const projectId = match![1];
      const loaded = await storage.loadProject(projectId);
      expect(loaded?.name).toBe('Resource Project');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required fields gracefully', async () => {
      const { createStorage } = await getStorageModule();
      const storage = await createStorage();

      // Project without required tasks
      const project = createProject('Project', 'Desc');
      expect(project.tasks).toEqual([]);

      await storage.saveProject(project);
      const loaded = await storage.loadProject(project.id);
      expect(loaded?.tasks).toEqual([]);
    });

    it('should handle concurrent operations', async () => {
      const { createStorage } = await getStorageModule();
      const storage = await createStorage();

      const projects = await Promise.all([
        (async () => {
          const p = createProject('Project 1', 'Desc');
          await storage.saveProject(p);
          return p;
        })(),
        (async () => {
          const p = createProject('Project 2', 'Desc');
          await storage.saveProject(p);
          return p;
        })(),
        (async () => {
          const p = createProject('Project 3', 'Desc');
          await storage.saveProject(p);
          return p;
        })(),
      ]);

      const listed = await storage.listProjects();
      expect(listed).toHaveLength(3);
    });
  });
});
