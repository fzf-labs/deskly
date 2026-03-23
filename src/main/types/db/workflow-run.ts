import type { WorkflowDefinitionDocument } from './workflow-definition'

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
