import { describe, expect, it, vi } from 'vitest'

import { TaskService } from '../../../src/main/services/TaskService'

describe('TaskService workflow runtime', () => {
  it('creates a single-node workflow run for conversation tasks', async () => {
    const createdRuns: Array<{
      taskId: string
      workflowDefinitionId?: string | null
      definition?: {
        version: 1
        nodes: Array<{
          key: string
          type: 'agent'
          name: string
          prompt?: string | null
          cliToolId?: string | null
          agentToolConfigId?: string | null
          requiresApprovalAfterRun: boolean
        }>
        edges: Array<{ from: string; to: string }>
      }
    }> = []

    const db = {
      getWorkflowDefinition: vi.fn(() => ({
        id: 'definition-1',
        scope: 'project',
        project_id: 'project-1',
        name: 'Workflow',
        description: null,
        created_at: '2026-03-22T00:00:00.000Z',
        updated_at: '2026-03-22T00:00:00.000Z',
        definition: {
          version: 1,
          nodes: [
            {
              id: 'node-1',
              key: 'analyze',
              type: 'agent',
              name: 'Analyze',
              prompt: 'Inspect the task',
              requiresApprovalAfterRun: false,
              position: { x: 0, y: 0 }
            }
          ],
          edges: []
        }
      })),
      getDefaultAgentToolConfig: vi.fn(() => null),
      createTask: vi.fn((input) => ({
        ...input,
        status: 'todo',
        cost: null,
        duration: null,
        created_at: '2026-03-22T00:00:00.000Z',
        updated_at: '2026-03-22T00:00:00.000Z'
      })),
      getTask: vi.fn((taskId: string) => ({
        id: taskId,
        title: 'Workflow task',
        prompt: 'Solve the issue',
        status: 'todo',
        task_mode: 'workflow',
        project_id: 'project-1',
        worktree_path: null,
        branch_name: null,
        base_branch: null,
        workspace_path: '/tmp/project',
        started_at: null,
        completed_at: null,
        cost: null,
        duration: null,
        created_at: '2026-03-22T00:00:00.000Z',
        updated_at: '2026-03-22T00:00:00.000Z'
      })),
      createWorkflowRunForTask: vi.fn((input) => {
        createdRuns.push(input)
        return {
          id: 'run-1',
          task_id: input.taskId,
          workflow_definition_id: input.workflowDefinitionId ?? null,
          definition_snapshot: input.definition ?? { version: 1, nodes: [], edges: [] },
          status: 'waiting',
          current_wave: 0,
          started_at: null,
          completed_at: null,
          created_at: '2026-03-22T00:00:00.000Z',
          updated_at: '2026-03-22T00:00:00.000Z'
        }
      })
    }

    const git = {
      addWorktree: vi.fn()
    }

    const settings = {
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

    const service = new TaskService(db as never, git as never, settings as never)

    await service.createTask({
      title: 'Conversation task',
      prompt: 'Solve the issue',
      taskMode: 'conversation',
      projectId: 'project-1',
      projectPath: '/tmp/project',
      cliToolId: 'codex',
      agentToolConfigId: 'cfg-a'
    })

    expect(createdRuns).toHaveLength(1)
    expect(createdRuns[0]).toEqual({
      taskId: expect.any(String),
      definition: {
        version: 1,
        nodes: [
          expect.objectContaining({
            key: 'conversation',
            type: 'agent',
            name: 'Conversation',
            prompt: '',
            cliToolId: 'codex',
            agentToolConfigId: 'cfg-a',
            requiresApprovalAfterRun: false
          })
        ],
        edges: []
      }
    })
  })

  it('applies task-level CLI defaults to workflow run snapshots', async () => {
    const createdRuns: Array<{
      taskId: string
      workflowDefinitionId?: string | null
      definition?: {
        version: 1
        nodes: Array<{
          id: string
          key: string
          type: 'agent'
          name: string
          prompt?: string | null
          cliToolId?: string | null
          agentToolConfigId?: string | null
          requiresApprovalAfterRun: boolean
          position?: { x: number; y: number }
        }>
        edges: Array<{ from: string; to: string }>
      }
    }> = []
    const db = {
      getWorkflowDefinition: vi.fn(() => ({
        id: 'definition-1',
        scope: 'project',
        project_id: 'project-1',
        name: 'Workflow',
        description: null,
        created_at: '2026-03-22T00:00:00.000Z',
        updated_at: '2026-03-22T00:00:00.000Z',
        definition: {
          version: 1,
          nodes: [
            {
              id: 'node-1',
              key: 'analyze',
              type: 'agent',
              name: 'Analyze',
              prompt: 'Inspect the task',
              requiresApprovalAfterRun: false,
              position: { x: 0, y: 0 }
            }
          ],
          edges: []
        }
      })),
      getDefaultAgentToolConfig: vi.fn(() => null),
      createTask: vi.fn((input) => ({
        ...input,
        status: 'todo',
        cost: null,
        duration: null,
        created_at: '2026-03-22T00:00:00.000Z',
        updated_at: '2026-03-22T00:00:00.000Z'
      })),
      getTask: vi.fn((taskId: string) => ({
        id: taskId,
        title: 'Workflow task',
        prompt: 'Solve the issue',
        status: 'todo',
        task_mode: 'workflow',
        project_id: 'project-1',
        worktree_path: null,
        branch_name: null,
        base_branch: null,
        workspace_path: '/tmp/project',
        started_at: null,
        completed_at: null,
        cost: null,
        duration: null,
        created_at: '2026-03-22T00:00:00.000Z',
        updated_at: '2026-03-22T00:00:00.000Z'
      })),
      createWorkflowRunForTask: vi.fn((input) => {
        createdRuns.push(input)
        return {
          id: 'run-1',
          task_id: input.taskId,
          workflow_definition_id: input.workflowDefinitionId ?? null,
          definition_snapshot: { version: 1, nodes: [], edges: [] },
          status: 'waiting',
          current_wave: 0,
          started_at: null,
          completed_at: null,
          created_at: '2026-03-22T00:00:00.000Z',
          updated_at: '2026-03-22T00:00:00.000Z'
        }
      })
    }

    const git = { addWorktree: vi.fn() }
    const settings = {
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
    const service = new TaskService(db as never, git as never, settings as never)

    await service.createTask({
      title: 'Workflow task',
      prompt: 'Solve the issue',
      taskMode: 'workflow',
      projectId: 'project-1',
      projectPath: '/tmp/project',
      workflowDefinitionId: 'definition-1',
      cliToolId: 'codex'
    })

    expect(createdRuns).toEqual([
      {
        taskId: expect.any(String),
        workflowDefinitionId: 'definition-1',
        definition: {
          version: 1,
          nodes: [
            expect.objectContaining({
              id: 'node-1',
              key: 'analyze',
              cliToolId: 'codex'
            })
          ],
          edges: []
        }
      }
    ])
  })

  it('creates inline workflow tasks without persisting a workflow definition id', async () => {
    const createdRuns: Array<{
      taskId: string
      workflowDefinitionId?: string | null
      definition?: {
        version: 1
        nodes: Array<{
          id: string
          key: string
          type: 'agent'
          name: string
          prompt?: string | null
          cliToolId?: string | null
          agentToolConfigId?: string | null
          requiresApprovalAfterRun: boolean
        }>
        edges: Array<{ from: string; to: string }>
      }
    }> = []

    const db = {
      getWorkflowDefinition: vi.fn(),
      getDefaultAgentToolConfig: vi.fn(() => ({ id: 'cfg-default' })),
      createTask: vi.fn((input) => ({
        ...input,
        status: 'todo',
        cost: null,
        duration: null,
        created_at: '2026-03-22T00:00:00.000Z',
        updated_at: '2026-03-22T00:00:00.000Z'
      })),
      getTask: vi.fn((taskId: string) => ({
        id: taskId,
        title: 'Workflow task',
        prompt: 'Solve the issue',
        status: 'todo',
        task_mode: 'workflow',
        project_id: 'project-1',
        worktree_path: null,
        branch_name: null,
        base_branch: null,
        workspace_path: '/tmp/project',
        started_at: null,
        completed_at: null,
        cost: null,
        duration: null,
        created_at: '2026-03-22T00:00:00.000Z',
        updated_at: '2026-03-22T00:00:00.000Z'
      })),
      createWorkflowRunForTask: vi.fn((input) => {
        createdRuns.push(input)
        return {
          id: 'run-1',
          task_id: input.taskId,
          workflow_definition_id: input.workflowDefinitionId ?? null,
          definition_snapshot: input.definition ?? { version: 1, nodes: [], edges: [] },
          status: 'waiting',
          current_wave: 0,
          started_at: null,
          completed_at: null,
          created_at: '2026-03-22T00:00:00.000Z',
          updated_at: '2026-03-22T00:00:00.000Z'
        }
      })
    }

    const git = { addWorktree: vi.fn() }
    const settings = {
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
    const service = new TaskService(db as never, git as never, settings as never)

    await service.createTask({
      title: 'Workflow task',
      prompt: 'Solve the issue',
      taskMode: 'workflow',
      projectId: 'project-1',
      projectPath: '/tmp/project',
      cliToolId: 'codex',
      workflowDefinition: {
        version: 1,
        nodes: [
          {
            id: 'inline-node-1',
            key: 'analyze',
            type: 'agent',
            name: 'Analyze',
            prompt: 'Inspect the task',
            requiresApprovalAfterRun: false
          }
        ],
        edges: []
      }
    })

    expect(db.getWorkflowDefinition).not.toHaveBeenCalled()
    expect(createdRuns).toEqual([
      {
        taskId: expect.any(String),
        definition: {
          version: 1,
          nodes: [
            expect.objectContaining({
              id: 'inline-node-1',
              key: 'analyze',
              cliToolId: 'codex',
              agentToolConfigId: 'cfg-default'
            })
          ],
          edges: []
        }
      }
    ])
    expect(createdRuns[0]?.workflowDefinitionId).toBeUndefined()
  })

  it('rejects invalid or legacy workflow definitions before creating the task record', async () => {
    const db = {
      getWorkflowDefinition: vi.fn(() => null),
      getDefaultAgentToolConfig: vi.fn(() => null),
      createTask: vi.fn(),
      getTask: vi.fn(),
      createWorkflowRunForTask: vi.fn()
    }

    const git = { addWorktree: vi.fn() }
    const settings = {
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
    const service = new TaskService(db as never, git as never, settings as never)

    await expect(
      service.createTask({
        title: 'Workflow task',
        prompt: 'Solve the issue',
        taskMode: 'workflow',
        projectId: 'project-1',
        projectPath: '/tmp/project',
        workflowDefinitionId: 'legacy-definition'
      })
    ).rejects.toThrow('Workflow definition not found: legacy-definition')

    expect(db.createTask).not.toHaveBeenCalled()
    expect(db.createWorkflowRunForTask).not.toHaveBeenCalled()
  })

  it('rejects workflow tasks when neither a stored nor inline definition is provided', async () => {
    const db = {
      getWorkflowDefinition: vi.fn(),
      getDefaultAgentToolConfig: vi.fn(() => null),
      createTask: vi.fn(),
      getTask: vi.fn(),
      createWorkflowRunForTask: vi.fn()
    }

    const git = { addWorktree: vi.fn() }
    const settings = {
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
    const service = new TaskService(db as never, git as never, settings as never)

    await expect(
      service.createTask({
        title: 'Workflow task',
        prompt: 'Solve the issue',
        taskMode: 'workflow',
        projectId: 'project-1',
        projectPath: '/tmp/project'
      })
    ).rejects.toThrow('Workflow definition is required for workflow tasks')

    expect(db.createTask).not.toHaveBeenCalled()
    expect(db.createWorkflowRunForTask).not.toHaveBeenCalled()
  })

  it('rejects workflow tasks when both stored and inline definitions are provided', async () => {
    const db = {
      getWorkflowDefinition: vi.fn(() => ({
        id: 'definition-1',
        scope: 'project',
        project_id: 'project-1',
        name: 'Workflow',
        description: null,
        created_at: '2026-03-22T00:00:00.000Z',
        updated_at: '2026-03-22T00:00:00.000Z',
        definition: {
          version: 1,
          nodes: [
            {
              id: 'node-1',
              key: 'analyze',
              type: 'agent',
              name: 'Analyze',
              prompt: 'Inspect the task',
              requiresApprovalAfterRun: false,
              position: { x: 0, y: 0 }
            }
          ],
          edges: []
        }
      })),
      getDefaultAgentToolConfig: vi.fn(() => null),
      createTask: vi.fn(),
      getTask: vi.fn(),
      createWorkflowRunForTask: vi.fn()
    }

    const git = { addWorktree: vi.fn() }
    const settings = {
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
    const service = new TaskService(db as never, git as never, settings as never)

    await expect(
      service.createTask({
        title: 'Workflow task',
        prompt: 'Solve the issue',
        taskMode: 'workflow',
        projectId: 'project-1',
        projectPath: '/tmp/project',
        workflowDefinitionId: 'definition-1',
        workflowDefinition: {
          version: 1,
          nodes: [
            {
              id: 'inline-node-1',
              key: 'analyze',
              type: 'agent',
              name: 'Analyze',
              prompt: 'Inspect the task',
              requiresApprovalAfterRun: false
            }
          ],
          edges: []
        }
      })
    ).rejects.toThrow(
      'Workflow tasks require exactly one of workflowDefinitionId or workflowDefinition'
    )

    expect(db.createTask).not.toHaveBeenCalled()
    expect(db.createWorkflowRunForTask).not.toHaveBeenCalled()
  })

  it('rejects workflow task defaults that point to a disabled CLI tool', async () => {
    const db = {
      getWorkflowDefinition: vi.fn(() => ({
        id: 'definition-1',
        scope: 'project',
        project_id: 'project-1',
        name: 'Workflow',
        description: null,
        created_at: '2026-03-22T00:00:00.000Z',
        updated_at: '2026-03-22T00:00:00.000Z',
        definition: {
          version: 1,
          nodes: [
            {
              id: 'node-1',
              key: 'analyze',
              type: 'agent',
              name: 'Analyze',
              prompt: 'Inspect the task',
              requiresApprovalAfterRun: false,
              position: { x: 0, y: 0 }
            }
          ],
          edges: []
        }
      })),
      getDefaultAgentToolConfig: vi.fn(() => null),
      createTask: vi.fn(),
      getTask: vi.fn(),
      createWorkflowRunForTask: vi.fn()
    }

    const git = { addWorktree: vi.fn() }
    const settings = {
      getSettings: vi.fn(() => ({
        enabledCliTools: {
          'claude-code': true,
          codex: false,
          'cursor-agent': true,
          'gemini-cli': true,
          opencode: true
        }
      }))
    }
    const service = new TaskService(db as never, git as never, settings as never)

    await expect(
      service.createTask({
        title: 'Workflow task',
        prompt: 'Solve the issue',
        taskMode: 'workflow',
        projectId: 'project-1',
        projectPath: '/tmp/project',
        workflowDefinitionId: 'definition-1',
        cliToolId: 'codex'
      })
    ).rejects.toThrow('CLI tool is disabled in Settings -> Agent CLI')

    expect(db.createTask).not.toHaveBeenCalled()
    expect(db.createWorkflowRunForTask).not.toHaveBeenCalled()
  })
})
