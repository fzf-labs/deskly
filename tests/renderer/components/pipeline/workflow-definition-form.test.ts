import { describe, expect, it } from 'vitest'

import {
  buildWorkflowDefinitionFromForm,
  canEditWorkflowDefinitionInLinearDialog,
  workflowDefinitionToFormValues
} from '../../../../src/renderer/src/components/pipeline/workflow-definition-form'

describe('workflow-definition-form', () => {
  it('builds a linear workflow definition from form values', () => {
    const definition = buildWorkflowDefinitionFromForm({
      name: 'Code review',
      description: 'two-step flow',
      nodes: [
        {
          name: 'Analyze',
          prompt: 'Check the diff',
          cliToolId: 'codex',
          agentToolConfigId: 'cfg-1',
          requiresApproval: false
        },
        {
          name: 'Confirm',
          prompt: 'Ask for approval',
          cliToolId: '',
          agentToolConfigId: '',
          requiresApproval: true
        }
      ]
    })

    expect(definition.version).toBe(1)
    expect(definition.nodes).toHaveLength(2)
    expect(definition.nodes[0]).toEqual(
      expect.objectContaining({
        key: 'linear-node-1',
        type: 'agent',
        name: 'Analyze',
        prompt: 'Check the diff',
        cliToolId: 'codex',
        agentToolConfigId: 'cfg-1',
        requiresApprovalAfterRun: false
      })
    )
    expect(definition.nodes[1]).toEqual(
      expect.objectContaining({
        key: 'linear-node-2',
        type: 'agent',
        name: 'Confirm',
        prompt: 'Ask for approval',
        cliToolId: null,
        agentToolConfigId: null,
        requiresApprovalAfterRun: true
      })
    )
    expect(definition.edges).toEqual([
      {
        from: definition.nodes[0]!.id,
        to: definition.nodes[1]!.id
      }
    ])
  })

  it('round-trips a linear workflow definition back into dialog form values', () => {
    const result = workflowDefinitionToFormValues({
      id: 'definition-1',
      scope: 'project',
      project_id: 'project-1',
      name: 'Linear flow',
      description: 'simple flow',
      created_at: '2026-03-22T00:00:00.000Z',
      updated_at: '2026-03-22T00:00:00.000Z',
      definition: {
        version: 1,
        nodes: [
          {
            id: 'node-a',
            key: 'node-a',
            type: 'agent',
            name: 'Step A',
            prompt: 'Do A',
            cliToolId: 'codex',
            agentToolConfigId: 'cfg-a',
            requiresApprovalAfterRun: false,
            position: null
          },
          {
            id: 'node-b',
            key: 'node-b',
            type: 'agent',
            name: 'Step B',
            prompt: 'Do B',
            cliToolId: null,
            agentToolConfigId: null,
            requiresApprovalAfterRun: true,
            position: null
          }
        ],
        edges: [{ from: 'node-a', to: 'node-b' }]
      }
    })

    expect(result).toEqual({
      name: 'Linear flow',
      description: 'simple flow',
      nodes: [
        {
          name: 'Step A',
          prompt: 'Do A',
          cliToolId: 'codex',
          agentToolConfigId: 'cfg-a',
          requiresApproval: false
        },
        {
          name: 'Step B',
          prompt: 'Do B',
          cliToolId: '',
          agentToolConfigId: '',
          requiresApproval: true
        }
      ]
    })
  })

  it('rejects non-linear definitions for the legacy linear dialog', () => {
    expect(
      canEditWorkflowDefinitionInLinearDialog({
        version: 1,
        nodes: [
          {
            id: 'root',
            key: 'root',
            type: 'agent',
            name: 'Root',
            prompt: 'Start',
            requiresApprovalAfterRun: false,
            position: null
          },
          {
            id: 'branch-a',
            key: 'branch-a',
            type: 'agent',
            name: 'Branch A',
            prompt: 'A',
            requiresApprovalAfterRun: false,
            position: null
          },
          {
            id: 'branch-b',
            key: 'branch-b',
            type: 'agent',
            name: 'Branch B',
            prompt: 'B',
            requiresApprovalAfterRun: false,
            position: null
          }
        ],
        edges: [
          { from: 'root', to: 'branch-a' },
          { from: 'root', to: 'branch-b' }
        ]
      })
    ).toBe(false)
  })
})
