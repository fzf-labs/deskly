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
      prompt: null,
      cliToolId: input?.cliToolId ?? null,
      agentToolConfigId: input?.agentToolConfigId ?? null,
      requiresApprovalAfterRun: false,
      position: null
    }
  ],
  edges: []
})
