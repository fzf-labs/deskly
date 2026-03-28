import { describe, expect, it } from 'vitest'

import {
  buildTaskCreatePayload,
  deriveTaskTitle,
  isProjectWorkflowTaskCreateMode,
  resolvePersistedTaskMode,
  resolveWorkflowGenerationToolId
} from '../../src/renderer/src/features/tasks/model/task-create'

const workflowDefinition = {
  version: 1 as const,
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

describe('task-create-utils', () => {
  it('detects project-scoped workflow creation modes', () => {
    expect(isProjectWorkflowTaskCreateMode('conversation')).toBe(false)
    expect(isProjectWorkflowTaskCreateMode('workflow')).toBe(true)
    expect(isProjectWorkflowTaskCreateMode('generated-workflow')).toBe(true)
  })

  it('maps UI creation modes to persisted task modes', () => {
    expect(resolvePersistedTaskMode('conversation')).toBe('conversation')
    expect(resolvePersistedTaskMode('workflow')).toBe('workflow')
    expect(resolvePersistedTaskMode('generated-workflow')).toBe('workflow')
  })

  it('only forwards supported workflow generation tools', () => {
    expect(resolveWorkflowGenerationToolId('codex')).toBe('codex')
    expect(resolveWorkflowGenerationToolId('claude-code')).toBe('claude-code')
    expect(resolveWorkflowGenerationToolId('cursor-agent')).toBeUndefined()
    expect(resolveWorkflowGenerationToolId(undefined)).toBeUndefined()
  })

  it('derives a task title from the first non-empty prompt line', () => {
    expect(deriveTaskTitle('\n  Ship the feature\nThen verify it')).toBe('Ship the feature')
  })

  it('builds a stored-workflow task payload', () => {
    expect(
      buildTaskCreatePayload({
        createMode: 'workflow',
        title: 'Workflow task',
        prompt: 'Prompt',
        projectId: 'project-1',
        workflowDefinitionId: 'definition-1'
      })
    ).toEqual({
      title: 'Workflow task',
      prompt: 'Prompt',
      taskMode: 'workflow',
      projectId: 'project-1',
      workflowDefinitionId: 'definition-1',
      workflowDefinition: undefined
    })
  })

  it('builds a generated-workflow task payload with an inline definition', () => {
    expect(
      buildTaskCreatePayload({
        createMode: 'generated-workflow',
        title: 'Generated task',
        prompt: 'Prompt',
        cliToolId: 'codex',
        agentToolConfigId: 'cfg-default',
        workflowDefinition
      })
    ).toEqual({
      title: 'Generated task',
      prompt: 'Prompt',
      taskMode: 'workflow',
      cliToolId: 'codex',
      agentToolConfigId: 'cfg-default',
      workflowDefinitionId: undefined,
      workflowDefinition
    })
  })

  it('omits workflow fields for conversation payloads', () => {
    expect(
      buildTaskCreatePayload({
        createMode: 'conversation',
        title: 'Conversation task',
        prompt: 'Prompt',
        workflowDefinitionId: 'definition-1',
        workflowDefinition
      })
    ).toEqual({
      title: 'Conversation task',
      prompt: 'Prompt',
      taskMode: 'conversation',
      workflowDefinitionId: undefined,
      workflowDefinition: undefined
    })
  })
})
