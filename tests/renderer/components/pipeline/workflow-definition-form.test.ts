import { describe, expect, it } from 'vitest'

import {
  buildWorkflowDefinitionFromForm,
  workflowDefinitionToFormValues
} from '../../../../src/renderer/src/components/pipeline/workflow-definition-form'

describe('workflow-definition-form', () => {
  it('builds an agent-only DAG workflow definition from form values', () => {
    const definition = buildWorkflowDefinitionFromForm({
      name: 'Code review',
      description: 'branching flow',
      nodes: [
        {
          id: 'node-a',
          key: 'analyze',
          type: 'agent',
          name: 'Analyze',
          prompt: 'Check the diff',
          cliToolId: 'codex',
          agentToolConfigId: 'cfg-1',
          requiresApproval: false,
          dependsOnIds: [],
          position: { x: 0, y: 0 }
        },
        {
          id: 'node-b',
          key: 'test',
          type: 'agent',
          name: 'Run tests',
          prompt: 'Run the project tests and collect failures.',
          cliToolId: '',
          agentToolConfigId: '',
          requiresApproval: false,
          dependsOnIds: ['node-a'],
          position: { x: 280, y: 0 }
        },
        {
          id: 'node-c',
          key: 'review',
          type: 'agent',
          name: 'Review result',
          prompt: 'Summarize the outcome',
          cliToolId: '',
          agentToolConfigId: '',
          requiresApproval: true,
          dependsOnIds: ['node-a', 'node-b'],
          position: { x: 560, y: 0 }
        }
      ]
    })

    expect(definition.version).toBe(1)
    expect(definition.nodes).toHaveLength(3)
    expect(definition.nodes[1]).toEqual(
      expect.objectContaining({
        id: 'node-b',
        key: 'test',
        type: 'agent',
        name: 'Run tests',
        prompt: 'Run the project tests and collect failures.',
        cliToolId: null,
        agentToolConfigId: null
      })
    )
    expect(definition.edges).toEqual([
      { from: 'node-a', to: 'node-b' },
      { from: 'node-a', to: 'node-c' },
      { from: 'node-b', to: 'node-c' }
    ])
  })

  it('round-trips an agent-only DAG workflow definition back into dialog form values', () => {
    const result = workflowDefinitionToFormValues({
      id: 'definition-1',
      scope: 'project',
      project_id: 'project-1',
      name: 'DAG flow',
      description: 'branching flow',
      created_at: '2026-03-22T00:00:00.000Z',
      updated_at: '2026-03-22T00:00:00.000Z',
      definition: {
        version: 1,
        nodes: [
          {
            id: 'node-a',
            key: 'analyze',
            type: 'agent',
            name: 'Analyze',
            prompt: 'Inspect task',
            requiresApprovalAfterRun: false,
            position: null
          },
          {
            id: 'node-b',
            key: 'test',
            type: 'agent',
            name: 'Run tests',
            prompt: 'Run the test suite',
            requiresApprovalAfterRun: false,
            position: null
          },
          {
            id: 'node-c',
            key: 'review',
            type: 'agent',
            name: 'Review',
            prompt: 'Review outcome',
            requiresApprovalAfterRun: true,
            position: null
          }
        ],
        edges: [
          { from: 'node-a', to: 'node-b' },
          { from: 'node-a', to: 'node-c' },
          { from: 'node-b', to: 'node-c' }
        ]
      }
    })

    expect(result).toEqual({
      name: 'DAG flow',
      description: 'branching flow',
      nodes: [
        {
          id: 'node-a',
          key: 'analyze',
          type: 'agent',
          name: 'Analyze',
          prompt: 'Inspect task',
          cliToolId: '',
          agentToolConfigId: '',
          requiresApproval: false,
          dependsOnIds: [],
          position: {
            x: 0,
            y: 0
          }
        },
        {
          id: 'node-b',
          key: 'test',
          type: 'agent',
          name: 'Run tests',
          prompt: 'Run the test suite',
          cliToolId: '',
          agentToolConfigId: '',
          requiresApproval: false,
          dependsOnIds: ['node-a'],
          position: {
            x: 280,
            y: 0
          }
        },
        {
          id: 'node-c',
          key: 'review',
          type: 'agent',
          name: 'Review',
          prompt: 'Review outcome',
          cliToolId: '',
          agentToolConfigId: '',
          requiresApproval: true,
          dependsOnIds: ['node-a', 'node-b'],
          position: {
            x: 560,
            y: 0
          }
        }
      ]
    })
  })
})
