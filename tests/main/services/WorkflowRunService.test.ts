import { describe, expect, it, vi } from 'vitest'

import { WorkflowRunService } from '../../../src/main/services/WorkflowRunService'

describe('WorkflowRunService', () => {
  it('composes task prompt into run node prompts when creating a run', () => {
    const createRunNodes = vi.fn(() => [])

    const service = new WorkflowRunService(
      {
        getTask: vi.fn(() => ({
          id: 'task-1',
          prompt: 'Task level prompt'
        }))
      } as never,
      {
        getDefinition: vi.fn(() => ({
          id: 'definition-1',
          name: 'Workflow',
          scope: 'project',
          project_id: 'project-1',
          description: null,
          created_at: '2026-03-22T00:00:00.000Z',
          updated_at: '2026-03-22T00:00:00.000Z',
          definition: {
            version: 1,
            nodes: [
              {
                id: 'node-a',
                key: 'node-a',
                type: 'agent',
                name: 'Stage A',
                prompt: 'Node prompt',
                requiresApprovalAfterRun: false
              },
              {
                id: 'node-b',
                key: 'node-b',
                type: 'command',
                name: 'Stage B',
                command: 'echo ok',
                prompt: null,
                requiresApprovalAfterRun: false
              }
            ],
            edges: [{ from: 'node-a', to: 'node-b' }]
          }
        }))
      } as never,
      {
        getRunByTask: vi.fn(() => null),
        createRun: vi.fn((input) => ({
          id: 'run-1',
          ...input,
          created_at: '2026-03-22T00:00:00.000Z',
          updated_at: '2026-03-22T00:00:00.000Z'
        }))
      } as never,
      {
        createRunNodes
      } as never,
      {} as never
    )

    service.createRunForTask({
      taskId: 'task-1',
      workflowDefinitionId: 'definition-1'
    })

    expect(createRunNodes).toHaveBeenCalledWith(
      'run-1',
      expect.arrayContaining([
        expect.objectContaining({
          definition_node_id: 'node-a',
          prompt: 'Task level prompt\n\nNode prompt'
        }),
        expect.objectContaining({
          definition_node_id: 'node-b',
          prompt: 'Task level prompt'
        })
      ])
    )
  })
})
