import type Database from 'better-sqlite3'
import { newUlid } from '../../utils/ids'
import type { CreateWorkflowRunReviewInput, DbWorkflowRunReview } from '../../types/workflow-run'

export class WorkflowRunReviewRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  createReview(input: CreateWorkflowRunReviewInput): DbWorkflowRunReview {
    const now = input.reviewed_at ?? new Date().toISOString()
    const id = newUlid()

    this.db
      .prepare(
        `
          INSERT INTO workflow_run_reviews (
            id,
            workflow_run_id,
            workflow_run_node_id,
            decision,
            comment,
            reviewed_by,
            reviewed_at,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        id,
        input.workflow_run_id,
        input.workflow_run_node_id,
        input.decision ?? 'approved',
        input.comment ?? null,
        input.reviewed_by ?? null,
        now,
        now
      )

    return this.getReview(id)!
  }

  getReview(id: string): DbWorkflowRunReview | null {
    const row = this.db.prepare('SELECT * FROM workflow_run_reviews WHERE id = ?').get(id) as
      | DbWorkflowRunReview
      | undefined

    return row ?? null
  }

  listReviewsByNode(workflowRunNodeId: string): DbWorkflowRunReview[] {
    return this.db
      .prepare(
        `
          SELECT *
          FROM workflow_run_reviews
          WHERE workflow_run_node_id = ?
          ORDER BY reviewed_at DESC
        `
      )
      .all(workflowRunNodeId) as DbWorkflowRunReview[]
  }
}
