import { newUlid } from '../utils/ids'
import type { WorkflowDefinitionDocument } from '../types/workflow-definition'

export const buildConversationWorkflowDefinition = (input?: {
  name?: string | null
  cliToolId?: string | null
  agentToolConfigId?: string | null
}): WorkflowDefinitionDocument => ({
  version: 1,
  nodes: [
    {
      id: newUlid(),
      key: 'conversation',
      type: 'agent',
      name: input?.name?.trim() || 'Conversation',
      prompt: '',
      cliToolId: input?.cliToolId ?? null,
      agentToolConfigId: input?.agentToolConfigId ?? null,
      requiresApprovalAfterRun: false,
      position: null
    }
  ],
  edges: []
})

export const applyWorkflowDefinitionRuntimeDefaults = (
  definition: WorkflowDefinitionDocument,
  defaults?: {
    cliToolId?: string | null
    agentToolConfigId?: string | null
  }
): WorkflowDefinitionDocument => {
  const fallbackCliToolId = defaults?.cliToolId ?? null
  const fallbackAgentToolConfigId = defaults?.agentToolConfigId ?? null

  if (!fallbackCliToolId && !fallbackAgentToolConfigId) {
    return definition
  }

  return {
    ...definition,
    nodes: definition.nodes.map((node) => {
      const resolvedCliToolId = node.cliToolId ?? fallbackCliToolId
      const resolvedAgentToolConfigId =
        node.agentToolConfigId ??
        (resolvedCliToolId && resolvedCliToolId === fallbackCliToolId
          ? fallbackAgentToolConfigId
          : null)

      return {
        ...node,
        cliToolId: resolvedCliToolId,
        agentToolConfigId: resolvedAgentToolConfigId
      }
    })
  }
}
