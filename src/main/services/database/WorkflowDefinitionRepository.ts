import type Database from 'better-sqlite3'
import { newUlid } from '../../utils/ids'
import type {
  CreateWorkflowDefinitionInput,
  DbWorkflowDefinition,
  UpdateWorkflowDefinitionInput
} from '../../types/workflow-definition'
import type { WorkflowDefinition } from '../../types/workflow-definition'

type WorkflowDefinitionFilter = {
  scope?: 'global' | 'project'
  projectId?: string | null
}

export class WorkflowDefinitionRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  listDefinitions(filter: WorkflowDefinitionFilter = {}): WorkflowDefinition[] {
    const where: string[] = []
    const params: unknown[] = []

    if (filter.scope) {
      where.push('scope = ?')
      params.push(filter.scope)
    }

    if (filter.projectId !== undefined) {
      where.push('project_id IS ?')
      params.push(filter.projectId ?? null)
    }

    const sql = `
      SELECT *
      FROM workflow_definitions
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY updated_at DESC
    `

    const rows = this.db.prepare(sql).all(...params) as DbWorkflowDefinition[]
    return rows.map((row) => this.mapRow(row))
  }

  getDefinition(id: string): WorkflowDefinition | null {
    const row = this.db
      .prepare('SELECT * FROM workflow_definitions WHERE id = ?')
      .get(id) as DbWorkflowDefinition | undefined

    return row ? this.mapRow(row) : null
  }

  createDefinition(input: CreateWorkflowDefinitionInput): WorkflowDefinition {
    const now = new Date().toISOString()
    const id = newUlid()
    try {
      this.db
        .prepare(
          `
            INSERT INTO workflow_definitions (
              id,
              scope,
              project_id,
              name,
              description,
              definition_json,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          id,
          input.scope,
          input.scope === 'project' ? (input.project_id ?? null) : null,
          input.name,
          input.description ?? null,
          JSON.stringify(input.definition, null, 2),
          now,
          now
        )
    } catch (error) {
      this.rethrowFriendlyConstraintError(error)
    }

    return this.getDefinition(id)!
  }

  updateDefinition(input: UpdateWorkflowDefinitionInput): WorkflowDefinition {
    const now = new Date().toISOString()
    try {
      this.db
        .prepare(
          `
            UPDATE workflow_definitions
            SET
              scope = ?,
              project_id = ?,
              name = ?,
              description = ?,
              definition_json = ?,
              updated_at = ?
            WHERE id = ?
          `
        )
        .run(
          input.scope,
          input.scope === 'project' ? (input.project_id ?? null) : null,
          input.name,
          input.description ?? null,
          JSON.stringify(input.definition, null, 2),
          now,
          input.id
        )
    } catch (error) {
      this.rethrowFriendlyConstraintError(error)
    }

    return this.getDefinition(input.id)!
  }

  deleteDefinition(id: string): boolean {
    const result = this.db.prepare('DELETE FROM workflow_definitions WHERE id = ?').run(id)
    return result.changes > 0
  }

  deleteDefinitionsByProject(projectId: string): number {
    const result = this.db
      .prepare("DELETE FROM workflow_definitions WHERE scope = 'project' AND project_id = ?")
      .run(projectId)
    return result.changes
  }

  private mapRow(row: DbWorkflowDefinition): WorkflowDefinition {
    return {
      id: row.id,
      scope: row.scope,
      project_id: row.project_id,
      name: row.name,
      description: row.description,
      definition: JSON.parse(row.definition_json),
      created_at: row.created_at,
      updated_at: row.updated_at
    }
  }

  private rethrowFriendlyConstraintError(error: unknown): never {
    if (
      error instanceof Error &&
      error.message.includes('UNIQUE constraint failed') &&
      error.message.includes('workflow_definitions')
    ) {
      throw new Error('WORKFLOW_DEFINITION_NAME_CONFLICT')
    }

    throw error
  }
}
