import { describe, expect, it, vi } from 'vitest'

import { TaskService } from '../../../src/main/services/TaskService'

describe('TaskService workflow template bridge', () => {
  it('creates a workflow run from a legacy workflow template instead of legacy task nodes', async () => {
    const createdRuns: Array<{ taskId: string; workflowDefinitionId: string }> = []
    const createdDefinitions: Array<{
      scope: 'global' | 'project'
      project_id?: string | null
      name: string
      description?: string | null
      definition: {
        version: 1
        nodes: Array<{
          id: string
          key: string
          type: 'agent' | 'command'
          name: string
          prompt?: string | null
          cliToolId?: string | null
          agentToolConfigId?: string | null
          requiresApprovalAfterRun: boolean
          position?: { x: number; y: number } | null
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
      updateCurrentTaskNodeRuntime: vi.fn(),
      getWorkflowTemplate: vi.fn(() => ({
        id: 'template-1',
        name: 'Legacy workflow',
        description: 'linear flow',
        scope: 'project',
        project_id: 'project-1',
        created_at: '2026-03-22T00:00:00.000Z',
        updated_at: '2026-03-22T00:00:00.000Z',
        nodes: [
          {
            id: 'node-a',
            template_id: 'template-1',
            node_order: 1,
            name: 'Stage A',
            prompt: 'Do A',
            cli_tool_id: 'codex',
            agent_tool_config_id: 'cfg-a',
            requires_approval: false,
            created_at: '2026-03-22T00:00:00.000Z',
            updated_at: '2026-03-22T00:00:00.000Z'
          },
          {
            id: 'node-b',
            template_id: 'template-1',
            node_order: 2,
            name: 'Stage B',
            prompt: 'Do B',
            cli_tool_id: null,
            agent_tool_config_id: null,
            requires_approval: true,
            created_at: '2026-03-22T00:00:00.000Z',
            updated_at: '2026-03-22T00:00:00.000Z'
          }
        ]
      })),
      listWorkflowDefinitions: vi.fn(() => []),
      createWorkflowDefinition: vi.fn((input) => {
        createdDefinitions.push(input)
        return {
          id: 'definition-1',
          ...input,
          created_at: '2026-03-22T00:00:00.000Z',
          updated_at: '2026-03-22T00:00:00.000Z'
        }
      }),
      createWorkflowRunForTask: vi.fn((input) => {
        createdRuns.push(input)
        return {
          id: 'run-1',
          task_id: input.taskId,
          workflow_definition_id: input.workflowDefinitionId,
          definition_snapshot: { version: 1, nodes: [], edges: [] },
          status: 'waiting',
          current_wave: 0,
          started_at: null,
          completed_at: null,
          created_at: '2026-03-22T00:00:00.000Z',
          updated_at: '2026-03-22T00:00:00.000Z'
        }
      }),
      createTaskNodesFromTemplate: vi.fn()
    }

    const git = {
      addWorktree: vi.fn()
    }

    const service = new TaskService(db as never, git as never)

    await service.createTask({
      title: 'Workflow task',
      prompt: 'Solve the issue',
      taskMode: 'workflow',
      projectId: 'project-1',
      projectPath: '/tmp/project',
      workflowTemplateId: 'template-1'
    })

    expect(createdDefinitions).toHaveLength(1)
    expect(createdDefinitions[0]?.definition.nodes).toEqual([
      expect.objectContaining({
        id: 'node-a',
        type: 'agent',
        name: 'Stage A',
        prompt: 'Do A',
        cliToolId: 'codex',
        agentToolConfigId: 'cfg-a',
        requiresApprovalAfterRun: false
      }),
      expect.objectContaining({
        id: 'node-b',
        type: 'agent',
        name: 'Stage B',
        prompt: 'Do B',
        requiresApprovalAfterRun: true
      })
    ])
    expect(createdDefinitions[0]?.definition.edges).toEqual([{ from: 'node-a', to: 'node-b' }])
    expect(createdRuns).toEqual([{ taskId: expect.any(String), workflowDefinitionId: 'definition-1' }])
    expect(db.createTaskNodesFromTemplate).not.toHaveBeenCalled()
  })
})
