/**
 * Tests for CortexFlow Data Models
 */

import {
  Phase,
  TaskStatus,
  AgentRole,
  createTask,
  createNote,
  createProject,
  bumpVersion,
  addTask,
  addNote,
  updateTaskStatus,
  updateTaskNote,
  setPhase,
  getTask,
  getPendingTasks,
  getProjectSummary,
  serializeContext,
  deserializeContext,
} from '../src/models.js';

describe('Enums', () => {
  describe('Phase', () => {
    it('should have all expected phases', () => {
      expect(Phase.PLANNING).toBe('planning');
      expect(Phase.EXECUTION).toBe('execution');
      expect(Phase.REVIEW).toBe('review');
      expect(Phase.COMPLETED).toBe('completed');
    });
  });

  describe('TaskStatus', () => {
    it('should have all expected statuses', () => {
      expect(TaskStatus.PENDING).toBe('pending');
      expect(TaskStatus.IN_PROGRESS).toBe('in_progress');
      expect(TaskStatus.BLOCKED).toBe('blocked');
      expect(TaskStatus.COMPLETED).toBe('completed');
      expect(TaskStatus.CANCELLED).toBe('cancelled');
    });
  });

  describe('AgentRole', () => {
    it('should have all expected roles', () => {
      expect(AgentRole.PLANNER).toBe('planner');
      expect(AgentRole.EXECUTOR).toBe('executor');
      expect(AgentRole.REVIEWER).toBe('reviewer');
    });
  });
});

describe('Factory Functions', () => {
  describe('createTask', () => {
    it('should create a task with required fields', () => {
      const task = createTask('Test Task', 'Test Description');

      expect(task.id).toBeDefined();
      expect(task.id.length).toBe(8);
      expect(task.title).toBe('Test Task');
      expect(task.description).toBe('Test Description');
      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.priority).toBe(1);
      expect(task.assignedTo).toBeNull();
      expect(task.createdAt).toBeDefined();
      expect(task.updatedAt).toBeDefined();
      expect(task.completedAt).toBeNull();
      expect(task.notes).toEqual([]);
      expect(task.dependencies).toEqual([]);
    });

    it('should create a task with custom options', () => {
      const task = createTask('Custom Task', 'Custom Description', {
        status: TaskStatus.IN_PROGRESS,
        priority: 3,
        assignedTo: AgentRole.EXECUTOR,
        notes: ['Note 1'],
        dependencies: ['dep-1', 'dep-2'],
      });

      expect(task.status).toBe(TaskStatus.IN_PROGRESS);
      expect(task.priority).toBe(3);
      expect(task.assignedTo).toBe(AgentRole.EXECUTOR);
      expect(task.notes).toEqual(['Note 1']);
      expect(task.dependencies).toEqual(['dep-1', 'dep-2']);
    });

    it('should generate unique IDs for different tasks', () => {
      const task1 = createTask('Task 1', 'Desc 1');
      const task2 = createTask('Task 2', 'Desc 2');

      expect(task1.id).not.toBe(task2.id);
    });
  });

  describe('createNote', () => {
    it('should create a note with required fields', () => {
      const note = createNote(AgentRole.PLANNER, 'Test note content');

      expect(note.id).toBeDefined();
      expect(note.id.length).toBe(8);
      expect(note.agent).toBe(AgentRole.PLANNER);
      expect(note.content).toBe('Test note content');
      expect(note.timestamp).toBeDefined();
      expect(note.category).toBe('general');
    });

    it('should create a note with custom category', () => {
      const note = createNote(AgentRole.EXECUTOR, 'Decision made', 'decision');

      expect(note.category).toBe('decision');
    });

    it('should support all note categories', () => {
      const categories: Array<'general' | 'decision' | 'blocker' | 'insight'> = [
        'general',
        'decision',
        'blocker',
        'insight',
      ];

      categories.forEach((category) => {
        const note = createNote(AgentRole.REVIEWER, 'Content', category);
        expect(note.category).toBe(category);
      });
    });
  });

  describe('createProject', () => {
    it('should create a project with required fields', () => {
      const project = createProject('Test Project', 'Project Description');

      expect(project.id).toBeDefined();
      expect(project.id.length).toBe(8);
      expect(project.name).toBe('Test Project');
      expect(project.description).toBe('Project Description');
      expect(project.phase).toBe(Phase.PLANNING);
      expect(project.version).toBe(1);
      expect(project.createdAt).toBeDefined();
      expect(project.updatedAt).toBeDefined();
      expect(project.tasks).toEqual([]);
      expect(project.notes).toEqual([]);
      expect(project.tags).toEqual([]);
      expect(project.config).toEqual({});
    });

    it('should create a project with custom options', () => {
      const project = createProject('Custom Project', 'Custom Description', {
        phase: Phase.EXECUTION,
        tags: ['tag1', 'tag2'],
        config: { key: 'value' },
      });

      expect(project.phase).toBe(Phase.EXECUTION);
      expect(project.tags).toEqual(['tag1', 'tag2']);
      expect(project.config).toEqual({ key: 'value' });
    });

    it('should create a project with initial tasks and notes', () => {
      const task = createTask('Initial Task', 'Task Desc');
      const note = createNote(AgentRole.PLANNER, 'Initial note');

      const project = createProject('Project', 'Desc', {
        tasks: [task],
        notes: [note],
      });

      expect(project.tasks).toHaveLength(1);
      expect(project.notes).toHaveLength(1);
    });
  });
});

describe('Context Utilities', () => {
  let baseProject: ReturnType<typeof createProject>;

  beforeEach(() => {
    baseProject = createProject('Test Project', 'Test Description');
  });

  describe('bumpVersion', () => {
    it('should increment version and update timestamp', async () => {
      const originalUpdatedAt = baseProject.updatedAt;
      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));
      const bumped = bumpVersion(baseProject);

      expect(bumped.version).toBe(2);
      expect(bumped.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('should not mutate original context', () => {
      const original = { ...baseProject };
      bumpVersion(baseProject);

      expect(baseProject.version).toBe(original.version);
    });
  });

  describe('addTask', () => {
    it('should add a task to the project', () => {
      const { context, task } = addTask(baseProject, 'New Task', 'Task Description');

      expect(context.tasks).toHaveLength(1);
      expect(context.tasks[0].title).toBe('New Task');
      expect(task.title).toBe('New Task');
      expect(context.version).toBe(2);
    });

    it('should add a task with options', () => {
      const { context, task } = addTask(baseProject, 'Priority Task', 'Desc', {
        priority: 5,
        assignedTo: AgentRole.EXECUTOR,
      });

      expect(task.priority).toBe(5);
      expect(task.assignedTo).toBe(AgentRole.EXECUTOR);
    });

    it('should preserve existing tasks', () => {
      let { context } = addTask(baseProject, 'Task 1', 'Desc 1');
      const result = addTask(context, 'Task 2', 'Desc 2');

      expect(result.context.tasks).toHaveLength(2);
    });
  });

  describe('addNote', () => {
    it('should add a note to the project', () => {
      const { context, note } = addNote(baseProject, AgentRole.PLANNER, 'Test note');

      expect(context.notes).toHaveLength(1);
      expect(context.notes[0].content).toBe('Test note');
      expect(note.agent).toBe(AgentRole.PLANNER);
      expect(context.version).toBe(2);
    });

    it('should add a note with category', () => {
      const { note } = addNote(baseProject, AgentRole.EXECUTOR, 'Blocker found', 'blocker');

      expect(note.category).toBe('blocker');
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status', () => {
      const { context } = addTask(baseProject, 'Task', 'Desc');
      const taskId = context.tasks[0].id;

      const updated = updateTaskStatus(context, taskId, TaskStatus.IN_PROGRESS);

      expect(updated.tasks[0].status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should set completedAt when status is COMPLETED', () => {
      const { context } = addTask(baseProject, 'Task', 'Desc');
      const taskId = context.tasks[0].id;

      const updated = updateTaskStatus(context, taskId, TaskStatus.COMPLETED);

      expect(updated.tasks[0].completedAt).toBeDefined();
      expect(updated.tasks[0].completedAt).not.toBeNull();
    });

    it('should not change completedAt for non-completed status', () => {
      const { context } = addTask(baseProject, 'Task', 'Desc');
      const taskId = context.tasks[0].id;

      const updated = updateTaskStatus(context, taskId, TaskStatus.IN_PROGRESS);

      expect(updated.tasks[0].completedAt).toBeNull();
    });

    it('should not modify other tasks', () => {
      let { context } = addTask(baseProject, 'Task 1', 'Desc 1');
      const result = addTask(context, 'Task 2', 'Desc 2');
      context = result.context;

      const taskId1 = context.tasks[0].id;
      const updated = updateTaskStatus(context, taskId1, TaskStatus.COMPLETED);

      expect(updated.tasks[0].status).toBe(TaskStatus.COMPLETED);
      expect(updated.tasks[1].status).toBe(TaskStatus.PENDING);
    });
  });

  describe('updateTaskNote', () => {
    it('should add a note to a task', () => {
      const { context } = addTask(baseProject, 'Task', 'Desc');
      const taskId = context.tasks[0].id;

      const updated = updateTaskNote(context, taskId, 'Implementation note');

      expect(updated.tasks[0].notes).toContain('Implementation note');
    });

    it('should preserve existing notes', () => {
      const { context } = addTask(baseProject, 'Task', 'Desc', { notes: ['Note 1'] });
      const taskId = context.tasks[0].id;

      const updated = updateTaskNote(context, taskId, 'Note 2');

      expect(updated.tasks[0].notes).toEqual(['Note 1', 'Note 2']);
    });
  });

  describe('setPhase', () => {
    it('should update project phase', () => {
      const updated = setPhase(baseProject, Phase.EXECUTION);

      expect(updated.phase).toBe(Phase.EXECUTION);
      expect(updated.version).toBe(2);
    });
  });

  describe('getTask', () => {
    it('should find a task by ID', () => {
      const { context, task } = addTask(baseProject, 'Task', 'Desc');

      const found = getTask(context, task.id);

      expect(found).toBeDefined();
      expect(found?.title).toBe('Task');
    });

    it('should return undefined for non-existent task', () => {
      const found = getTask(baseProject, 'non-existent-id');

      expect(found).toBeUndefined();
    });
  });

  describe('getPendingTasks', () => {
    it('should return only pending tasks', () => {
      let { context } = addTask(baseProject, 'Task 1', 'Desc 1');
      const result2 = addTask(context, 'Task 2', 'Desc 2');
      context = result2.context;
      const result3 = addTask(context, 'Task 3', 'Desc 3');
      context = result3.context;

      // Complete one task, cancel another
      context = updateTaskStatus(context, context.tasks[0].id, TaskStatus.COMPLETED);
      context = updateTaskStatus(context, context.tasks[1].id, TaskStatus.CANCELLED);

      const pending = getPendingTasks(context);

      expect(pending).toHaveLength(1);
      expect(pending[0].title).toBe('Task 3');
    });

    it('should include in_progress and blocked tasks', () => {
      let { context } = addTask(baseProject, 'Task 1', 'Desc 1');
      const result2 = addTask(context, 'Task 2', 'Desc 2');
      context = result2.context;
      const result3 = addTask(context, 'Task 3', 'Desc 3');
      context = result3.context;

      context = updateTaskStatus(context, context.tasks[0].id, TaskStatus.IN_PROGRESS);
      context = updateTaskStatus(context, context.tasks[1].id, TaskStatus.BLOCKED);

      const pending = getPendingTasks(context);

      expect(pending).toHaveLength(3);
    });

    it('should return empty array when all tasks are completed', () => {
      let { context } = addTask(baseProject, 'Task 1', 'Desc 1');
      context = updateTaskStatus(context, context.tasks[0].id, TaskStatus.COMPLETED);

      const pending = getPendingTasks(context);

      expect(pending).toHaveLength(0);
    });
  });

  describe('getProjectSummary', () => {
    it('should generate a project summary', () => {
      let { context } = addTask(baseProject, 'Task 1', 'Desc 1');
      const result2 = addTask(context, 'Task 2', 'Desc 2');
      context = result2.context;

      context = updateTaskStatus(context, context.tasks[0].id, TaskStatus.COMPLETED);

      const summary = getProjectSummary(context);

      expect(summary).toContain('Test Project');
      expect(summary).toContain('planning');
      expect(summary).toContain('1/2 completed');
      expect(summary).toContain('1 pending');
    });

    it('should handle empty project', () => {
      const summary = getProjectSummary(baseProject);

      expect(summary).toContain('Test Project');
      expect(summary).toContain('0/0 completed');
      expect(summary).toContain('0 pending');
    });
  });
});

describe('Serialization', () => {
  it('should serialize and deserialize context', () => {
    const project = createProject('Test Project', 'Description', {
      phase: Phase.EXECUTION,
      tags: ['tag1'],
    });

    const serialized = serializeContext(project);
    const deserialized = deserializeContext(serialized);

    expect(deserialized.name).toBe(project.name);
    expect(deserialized.description).toBe(project.description);
    expect(deserialized.phase).toBe(project.phase);
    expect(deserialized.tags).toEqual(project.tags);
  });

  it('should serialize with proper formatting', () => {
    const project = createProject('Test', 'Desc');
    const serialized = serializeContext(project);

    // Should be pretty-printed with 2-space indentation
    expect(serialized).toContain('\n');
    expect(serialized).toContain('  ');
  });

  it('should preserve all data through serialization cycle', () => {
    let project = createProject('Project', 'Desc');
    const { context } = addTask(project, 'Task 1', 'Task Desc');
    project = context;
    const noteResult = addNote(project, AgentRole.EXECUTOR, 'Note content', 'decision');
    project = noteResult.context;

    const serialized = serializeContext(project);
    const deserialized = deserializeContext(serialized);

    expect(deserialized.tasks).toHaveLength(1);
    expect(deserialized.notes).toHaveLength(1);
    expect(deserialized.tasks[0].title).toBe('Task 1');
    expect(deserialized.notes[0].category).toBe('decision');
  });
});
