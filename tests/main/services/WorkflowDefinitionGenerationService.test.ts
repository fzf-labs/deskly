import { describe, expect, it } from 'vitest'

import { WorkflowDefinitionGenerationService } from '../../../src/main/services/WorkflowDefinitionGenerationService'

describe('WorkflowDefinitionGenerationService', () => {
  it('generates linear agent steps when the prompt contains multiple bullet points', async () => {
    const service = new WorkflowDefinitionGenerationService()

    const result = await service.generateDefinition({
      name: 'Ship feature',
      mode: 'rules',
      prompt: `
        1. Analyze the current implementation
        2. Implement the feature
        3. Verify the result
      `
    })

    expect(result.name).toBe('Ship feature')
    expect(result.definition.nodes).toHaveLength(3)
    expect(result.definition.nodes[0]).toEqual(
      expect.objectContaining({
        name: 'Analyze the current implementation',
        type: 'agent'
      })
    )
    expect(result.definition.nodes[2]).toEqual(
      expect.objectContaining({
        name: 'Verify the result',
        requiresApprovalAfterRun: true
      })
    )
  })

  it('detects command nodes from command-like prompts', async () => {
    const service = new WorkflowDefinitionGenerationService()

    const result = await service.generateDefinition({
      mode: 'rules',
      prompt: 'Analyze the repo then run `npm test` then summarize the failures'
    })

    expect(result.definition.nodes).toHaveLength(3)
    expect(result.definition.nodes[1]).toEqual(
      expect.objectContaining({
        type: 'command',
        command: 'npm test'
      })
    )
  })
})
