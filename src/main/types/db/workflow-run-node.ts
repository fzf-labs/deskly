import type { WorkflowNodeType } from './workflow-definition'

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
