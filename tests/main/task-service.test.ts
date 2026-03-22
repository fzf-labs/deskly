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
  const createWorkflowDefinition = vi.fn((input) => ({
    id: 'definition-1',
    ...input,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z'
  }))
  const createWorkflowRunForTask = vi.fn((input) => ({
    id: 'run-1',
    task_id: input.taskId,
    workflow_definition_id: input.workflowDefinitionId,
    definition_snapshot: { version: 1, nodes: [], edges: [] },
    status: 'waiting',
    current_wave: 0,
    started_at: null,
    completed_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z'
  }))

  const db = {
    getDefaultAgentToolConfig: vi.fn(() => ({ id: 'cfg-default' })),
    createTask,
    updateCurrentTaskNodeRuntime: vi.fn(),
    createTaskNodesFromTemplate: vi.fn(),
    getTask,
    getWorkflowTemplate: vi.fn(() => ({
      id: 'tpl-1',
      name: 'Workflow template',
      description: 'legacy template',
      scope: 'project',
      project_id: 'project-1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      nodes: [
        {
          id: 'node-a',
          template_id: 'tpl-1',
          node_order: 1,
          name: 'Analyze',
          prompt: 'Analyze task',
          cli_tool_id: 'codex',
          agent_tool_config_id: 'cfg-template',
          requires_approval: false,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z'
        }
      ]
    })),
    listWorkflowDefinitions: vi.fn(() => []),
    createWorkflowDefinition,
    createWorkflowRunForTask
  }

  const git = {
    addWorktree: vi.fn()
  }

  return { db, git, createWorkflowDefinition, createWorkflowRunForTask }
}

describe('TaskService workflow runtime fallback', () => {
  it('bridges legacy workflow templates into workflow definitions when creating workflow tasks', async () => {
    const { db, git, createWorkflowDefinition, createWorkflowRunForTask } = createTaskServiceDeps()
    const service = new TaskService(db as any, git as any)

    await service.createTask({
      title: 'Workflow task',
      prompt: 'Task prompt',
      taskMode: 'workflow',
      workflowTemplateId: 'tpl-1',
      cliToolId: 'codex'
    })

    expect(db.createTask).toHaveBeenCalledTimes(1)
    expect(createWorkflowDefinition).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'project',
        project_id: 'project-1',
        name: 'Workflow template',
        definition: expect.objectContaining({
          version: 1,
          nodes: [
            expect.objectContaining({
              id: 'node-a',
              name: 'Analyze',
              prompt: 'Analyze task',
              cliToolId: 'codex',
              agentToolConfigId: 'cfg-template'
            })
          ]
        })
      })
    )
    expect(createWorkflowRunForTask).toHaveBeenCalledWith({
      taskId: expect.any(String),
      workflowDefinitionId: 'definition-1'
    })
    expect(db.createTaskNodesFromTemplate).not.toHaveBeenCalled()
  })

  it('reuses an existing matching workflow definition instead of creating a duplicate', async () => {
    const { db, git, createWorkflowDefinition, createWorkflowRunForTask } = createTaskServiceDeps()
    db.listWorkflowDefinitions.mockReturnValue([
      {
        id: 'definition-existing',
        name: 'Workflow template',
        scope: 'project',
        project_id: 'project-1',
        description: 'legacy template',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        definition: {
          version: 1,
          nodes: [
            {
              id: 'node-a',
              key: 'legacy-template-node-1',
              type: 'agent',
              name: 'Analyze',
              prompt: 'Analyze task',
              cliToolId: 'codex',
              agentToolConfigId: 'cfg-template',
              requiresApprovalAfterRun: false,
              position: null
            }
          ],
          edges: []
        }
      }
    ])
    const service = new TaskService(db as any, git as any)

    await service.createTask({
      title: 'Workflow task',
      prompt: 'Task prompt',
      taskMode: 'workflow',
      workflowTemplateId: 'tpl-1',
      cliToolId: 'codex'
    })

    expect(createWorkflowDefinition).not.toHaveBeenCalled()
    expect(createWorkflowRunForTask).toHaveBeenCalledWith({
      taskId: expect.any(String),
      workflowDefinitionId: 'definition-existing'
    })
  })

  it('rejects unsupported task status updates', () => {
    const { db, git } = createTaskServiceDeps()
    const service = new TaskService(db as any, git as any)

    expect(() => service.updateTaskStatus('task-1', 'cancelled' as any)).toThrow(
      'Unsupported task status: cancelled'
    )
  })
})
