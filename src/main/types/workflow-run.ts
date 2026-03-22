export type { WorkflowRunStatus, DbWorkflowRun, CreateWorkflowRunInput, UpdateWorkflowRunInput } from './db/workflow-run'
export type {
  WorkflowRunNodeStatus,
  WorkflowRunNodeFailureReason,
  DbWorkflowRunNode,
  CreateWorkflowRunNodeInput,
  UpdateWorkflowRunNodeInput
} from './db/workflow-run-node'
export type { DbWorkflowRunReview, CreateWorkflowRunReviewInput } from './db/workflow-run-review'

import type { WorkflowDefinitionDocument } from './db/workflow-definition'
import type { DbWorkflowRun } from './db/workflow-run'
import type { DbWorkflowRunNode } from './db/workflow-run-node'

export interface WorkflowRun extends Omit<DbWorkflowRun, 'definition_snapshot_json'> {
  definition_snapshot: WorkflowDefinitionDocument
}

export interface WorkflowRunNode extends Omit<DbWorkflowRunNode, 'requires_approval_after_run'> {
  requires_approval_after_run: boolean
}
