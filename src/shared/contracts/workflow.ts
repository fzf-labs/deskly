export type WorkflowDefinitionScope = 'global' | 'project'
export type WorkflowDefinitionNodeType = 'agent'
export type WorkflowNodeType = WorkflowDefinitionNodeType

export interface WorkflowDefinitionNodePosition {
  x: number
  y: number
}

export interface WorkflowDefinitionNode {
  id: string
  key: string
  type: WorkflowDefinitionNodeType
  name: string
  prompt?: string | null
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

export interface WorkflowDefinition extends Omit<DbWorkflowDefinition, 'definition_json'> {
  definition: WorkflowDefinitionDocument
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

export interface WorkflowDefinitionFilter {
  scope?: WorkflowDefinitionScope
  projectId?: string | null
}

export interface GenerateWorkflowDefinitionInput {
  prompt: string
  name?: string | null
  mode?: 'ai' | 'rules'
  toolId?: string | null
  agentToolConfigId?: string | null
}

export interface GeneratedWorkflowDefinitionResult {
  name: string
  description: string | null
  definition: WorkflowDefinitionDocument
}

export type WorkflowRunStatus = 'waiting' | 'running' | 'review' | 'done' | 'failed'

export interface DbWorkflowRun {
  id: string
  task_id: string
  workflow_definition_id: string | null
  status: WorkflowRunStatus
  definition_snapshot_json: string
  current_wave: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface WorkflowRun extends Omit<DbWorkflowRun, 'definition_snapshot_json'> {
  definition_snapshot: WorkflowDefinitionDocument
}

export interface CreateWorkflowRunInput {
  task_id: string
  workflow_definition_id?: string | null
  status?: WorkflowRunStatus
  definition_snapshot: WorkflowDefinitionDocument
  current_wave?: number
  started_at?: string | null
  completed_at?: string | null
}

export interface UpdateWorkflowRunInput {
  status?: WorkflowRunStatus
  current_wave?: number
  started_at?: string | null
  completed_at?: string | null
}

export type WorkflowRunNodeStatus = 'waiting' | 'running' | 'review' | 'done' | 'failed'
export type WorkflowRunNodeFailureReason = 'execution_error' | 'cancelled'

export interface DbWorkflowRunNode {
  id: string
  workflow_run_id: string
  definition_node_id: string
  node_key: string
  name: string
  node_type: WorkflowNodeType
  prompt: string | null
  cli_tool_id: string | null
  agent_tool_config_id: string | null
  requires_approval_after_run: number
  status: WorkflowRunNodeStatus
  failure_reason: WorkflowRunNodeFailureReason | null
  session_id: string | null
  resume_session_id: string | null
  result_summary: string | null
  error_message: string | null
  cost: number | null
  duration: number | null
  attempt_count: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface WorkflowRunNode extends Omit<DbWorkflowRunNode, 'requires_approval_after_run'> {
  requires_approval_after_run: boolean
}

export interface CreateWorkflowRunNodeInput {
  workflow_run_id: string
  definition_node_id: string
  node_key: string
  name: string
  node_type: WorkflowNodeType
  prompt?: string | null
  cli_tool_id?: string | null
  agent_tool_config_id?: string | null
  requires_approval_after_run?: boolean
  status?: WorkflowRunNodeStatus
  failure_reason?: WorkflowRunNodeFailureReason | null
  session_id?: string | null
  resume_session_id?: string | null
  result_summary?: string | null
  error_message?: string | null
  cost?: number | null
  duration?: number | null
  attempt_count?: number
  started_at?: string | null
  completed_at?: string | null
}

export interface UpdateWorkflowRunNodeInput {
  status?: WorkflowRunNodeStatus
  failure_reason?: WorkflowRunNodeFailureReason | null
  session_id?: string | null
  resume_session_id?: string | null
  cli_tool_id?: string | null
  agent_tool_config_id?: string | null
  result_summary?: string | null
  error_message?: string | null
  cost?: number | null
  duration?: number | null
  attempt_count?: number
  started_at?: string | null
  completed_at?: string | null
}

export interface CreateWorkflowRunForTaskInput {
  taskId: string
  workflowDefinitionId?: string | null
  definition?: WorkflowDefinitionDocument
}

export interface ApproveWorkflowRunNodeInput {
  comment?: string | null
  reviewed_by?: string | null
  reviewed_at?: string
}
