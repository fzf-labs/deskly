import { describe, expect, it, vi } from 'vitest'
import { TaskService } from '../../src/main/services/TaskService'

type MockDbTaskInput = {
  id: string
  title: string
  prompt: string
  task_mode: 'conversation' | 'workflow'
  project_id?: string
  worktree_path?: string
  branch_name?: string
  base_branch?: string
  workspace_path?: string
}

const makeDbTask = (input: MockDbTaskInput) => ({
  id: input.id,
  title: input.title,
  prompt: input.prompt,
  status: 'todo',
  task_mode: input.task_mode,
  project_id: input.project_id ?? null,
  worktree_path: input.worktree_path ?? null,
  branch_name: input.branch_name ?? null,
  base_branch: input.base_branch ?? null,
  workspace_path: input.workspace_path ?? null,
  started_at: null,
  completed_at: null,
  cost: null,
  duration: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z'
})

const createTaskServiceDeps = () => {
  const createTask = vi.fn((input: MockDbTaskInput) => makeDbTask(input))
  const getTask = vi.fn((taskId: string) =>
    makeDbTask({
      id: taskId,
      title: 'Task',
      prompt: 'Prompt',
      task_mode: 'workflow'
    })
  )
  const getWorkflowDefinition = vi.fn(() => ({
    id: 'definition-1',
    scope: 'project',
    project_id: 'project-1',
    name: 'Workflow',
    description: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    definition: {
      version: 1,
      nodes: [
        {
          id: 'node-1',
          key: 'analyze',
          type: 'agent' as const,
          name: 'Analyze',
          prompt: 'Inspect the task',
          requiresApprovalAfterRun: false
        }
      ],
      edges: []
    }
  }))
  const createWorkflowRunForTask = vi.fn((input) => ({
    id: 'run-1',
    task_id: input.taskId,
    workflow_definition_id: input.workflowDefinitionId ?? null,
    definition_snapshot: input.definition ?? { version: 1, nodes: [], edges: [] },
    status: 'waiting',
    current_wave: 0,
    started_at: null,
    completed_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z'
  }))

  const db = {
    getWorkflowDefinition,
    getDefaultAgentToolConfig: vi.fn(() => ({ id: 'cfg-default' })),
    createTask,
    getTask,
    createWorkflowRunForTask
  }

  const git = {
    addWorktree: vi.fn()
  }

  const settingsService = {
    getSettings: vi.fn(() => ({
      enabledCliTools: {
        'claude-code': true,
        codex: true,
        'cursor-agent': true,
        'gemini-cli': true,
        opencode: true
      }
    }))
  }

  return { db, git, createWorkflowRunForTask, settingsService }
}

describe('TaskService workflow runtime fallback', () => {
  it('creates workflow tasks directly from workflow definitions', async () => {
    const { db, git, createWorkflowRunForTask, settingsService } = createTaskServiceDeps()
    const service = new TaskService(db as any, git as any, settingsService as any)

    await service.createTask({
      title: 'Workflow task',
      prompt: 'Task prompt',
      taskMode: 'workflow',
      workflowDefinitionId: 'definition-1',
      cliToolId: 'codex'
    })

    expect(db.createTask).toHaveBeenCalledTimes(1)
    expect(createWorkflowRunForTask).toHaveBeenCalledWith({
      taskId: expect.any(String),
      workflowDefinitionId: 'definition-1',
      definition: expect.objectContaining({
        version: 1,
        nodes: [
          expect.objectContaining({
            key: 'analyze',
            cliToolId: 'codex',
            agentToolConfigId: 'cfg-default'
          })
        ]
      })
    })
  })

  it('creates single-node workflow runs for conversation tasks', async () => {
    const { db, git, createWorkflowRunForTask, settingsService } = createTaskServiceDeps()
    const service = new TaskService(db as any, git as any, settingsService as any)

    await service.createTask({
      title: 'Conversation task',
      prompt: 'Task prompt',
      taskMode: 'conversation',
      cliToolId: 'codex'
    })

    expect(createWorkflowRunForTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: expect.any(String),
        definition: expect.objectContaining({
          version: 1,
          nodes: [
            expect.objectContaining({
              key: 'conversation',
              type: 'agent',
              cliToolId: 'codex',
              agentToolConfigId: 'cfg-default'
            })
          ],
          edges: []
        })
      })
    )
  })

  it('rejects unsupported task status updates', () => {
    const { db, git, settingsService } = createTaskServiceDeps()
    const service = new TaskService(db as any, git as any, settingsService as any)

    expect(() => service.updateTaskStatus('task-1', 'cancelled' as any)).toThrow(
      'Unsupported task status: cancelled'
    )
  })
})
