export type WorkflowDefinitionScope = 'global' | 'project'

export type WorkflowNodeType = 'agent' | 'command'

export interface WorkflowDefinitionNodePosition {
  x: number
  y: number
}

export interface WorkflowDefinitionNode {
  id: string
  key: string
  type: WorkflowNodeType
  name: string
  prompt?: string | null
  command?: string | null
  cliToolId?: string | null
  agentToolConfigId?: string | null
  requiresApprovalAfterRun: boolean
  position?: WorkflowDefinitionNodePosition | null
}

export interface WorkflowDefinitionEdge {
  from: string
  to: string
}

export interface WorkflowDefinitionDocument {
  version: 1
  nodes: WorkflowDefinitionNode[]
  edges: WorkflowDefinitionEdge[]
}

export interface DbWorkflowDefinition {
  id: string
  scope: WorkflowDefinitionScope
  project_id: string | null
  name: string
  description: string | null
  definition_json: string
  created_at: string
  updated_at: string
}

export interface CreateWorkflowDefinitionInput {
  scope: WorkflowDefinitionScope
  project_id?: string | null
  name: string
  description?: string | null
  definition: WorkflowDefinitionDocument
}

export interface UpdateWorkflowDefinitionInput extends CreateWorkflowDefinitionInput {
  id: string
}

export interface GenerateWorkflowDefinitionInput {
  prompt: string
  name?: string | null
}

export interface GeneratedWorkflowDefinitionResult {
  name: string
  description: string | null
  definition: WorkflowDefinitionDocument
}
