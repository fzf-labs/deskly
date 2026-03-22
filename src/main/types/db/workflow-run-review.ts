export interface DbWorkflowRunReview {
  id: string
  workflow_run_id: string
  workflow_run_node_id: string
  decision: 'approved'
  comment: string | null
  reviewed_by: string | null
  reviewed_at: string
  created_at: string
}

export interface CreateWorkflowRunReviewInput {
  workflow_run_id: string
  workflow_run_node_id: string
  decision?: 'approved'
  comment?: string | null
  reviewed_by?: string | null
  reviewed_at?: string
}
