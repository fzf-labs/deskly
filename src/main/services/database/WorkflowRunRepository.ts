import type Database from 'better-sqlite3'
import { newUlid } from '../../utils/ids'
import type { CreateWorkflowRunInput, DbWorkflowRun, UpdateWorkflowRunInput } from '../../types/workflow-run'
import type { WorkflowRun } from '../../types/workflow-run'

export class WorkflowRunRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  createRun(input: CreateWorkflowRunInput): WorkflowRun {
    const now = new Date().toISOString()
    const id = newUlid()

    this.db
      .prepare(
        `
          INSERT INTO workflow_runs (
            id,
            task_id,
            workflow_definition_id,
            status,
            definition_snapshot_json,
            current_wave,
            started_at,
            completed_at,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        id,
        input.task_id,
        input.workflow_definition_id ?? null,
        input.status ?? 'waiting',
        JSON.stringify(input.definition_snapshot, null, 2),
        input.current_wave ?? 0,
        input.started_at ?? null,
        input.completed_at ?? null,
        now,
        now
      )

    return this.getRun(id)!
  }

  getRun(id: string): WorkflowRun | null {
    const row = this.db.prepare('SELECT * FROM workflow_runs WHERE id = ?').get(id) as
      | DbWorkflowRun
      | undefined

    return row ? this.mapRow(row) : null
  }

  getRunByTask(taskId: string): WorkflowRun | null {
    const row = this.db.prepare('SELECT * FROM workflow_runs WHERE task_id = ?').get(taskId) as
      | DbWorkflowRun
      | undefined

    return row ? this.mapRow(row) : null
  }

  updateRun(id: string, updates: UpdateWorkflowRunInput): WorkflowRun | null {
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: unknown[] = []

    if (updates.status !== undefined) {
      fields.push('status = ?')
      values.push(updates.status)
    }
    if (updates.current_wave !== undefined) {
      fields.push('current_wave = ?')
      values.push(updates.current_wave)
    }
    if (updates.started_at !== undefined) {
      fields.push('started_at = ?')
      values.push(updates.started_at)
    }
    if (updates.completed_at !== undefined) {
      fields.push('completed_at = ?')
      values.push(updates.completed_at)
    }

    if (fields.length === 0) {
      return this.getRun(id)
    }

    fields.push('updated_at = ?')
    values.push(now, id)
    this.db.prepare(`UPDATE workflow_runs SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.getRun(id)
  }

  private mapRow(row: DbWorkflowRun): WorkflowRun {
    return {
      id: row.id,
      task_id: row.task_id,
      workflow_definition_id: row.workflow_definition_id,
      status: row.status,
      definition_snapshot: JSON.parse(row.definition_snapshot_json),
      current_wave: row.current_wave,
      started_at: row.started_at,
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    }
  }
}
