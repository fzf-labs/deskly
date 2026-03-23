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
          type: 'agent' | 'command'
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
            prompt: null,
            cliToolId: 'codex',
            agentToolConfigId: 'cfg-a',
            requiresApprovalAfterRun: false
          })
        ],
        edges: []
      }
    })
  })

  it('creates workflow runs from workflow definitions without legacy template bridging', async () => {
    const createdRuns: Array<{ taskId: string; workflowDefinitionId?: string | null }> = []
    const db = {
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
      workflowDefinitionId: 'definition-1'
    })

    expect(createdRuns).toEqual([{ taskId: expect.any(String), workflowDefinitionId: 'definition-1' }])
  })
})
