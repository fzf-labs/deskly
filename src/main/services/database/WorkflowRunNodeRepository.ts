import type Database from 'better-sqlite3'
import { newUlid } from '../../utils/ids'
import type {
  CreateWorkflowRunNodeInput,
  DbWorkflowRunNode,
  UpdateWorkflowRunNodeInput,
  WorkflowRunNodeFailureReason,
  WorkflowRunNodeStatus
} from '../../types/workflow-run'
import type { WorkflowRunNode } from '../../types/workflow-run'

export class WorkflowRunNodeRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  createRunNodes(workflowRunId: string, nodes: CreateWorkflowRunNodeInput[]): WorkflowRunNode[] {
    const now = new Date().toISOString()
    const insert = this.db.prepare(
      `
        INSERT INTO workflow_run_nodes (
          id,
          workflow_run_id,
          definition_node_id,
          node_key,
          name,
          node_type,
          prompt,
          command,
          cli_tool_id,
          agent_tool_config_id,
          requires_approval_after_run,
          status,
          failure_reason,
          session_id,
          resume_session_id,
          result_summary,
          error_message,
          cost,
          duration,
          attempt_count,
          started_at,
          completed_at,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )

    const create = this.db.transaction((items: CreateWorkflowRunNodeInput[]) => {
      items.forEach((node) => {
        insert.run(
          newUlid(),
          workflowRunId,
          node.definition_node_id,
          node.node_key,
          node.name,
          node.node_type,
          node.prompt ?? null,
          node.command ?? null,
          node.cli_tool_id ?? null,
          node.agent_tool_config_id ?? null,
          node.requires_approval_after_run ? 1 : 0,
          node.status ?? 'waiting',
          node.failure_reason ?? null,
          node.session_id ?? null,
          node.resume_session_id ?? null,
          node.result_summary ?? null,
          node.error_message ?? null,
          node.cost ?? null,
          node.duration ?? null,
          node.attempt_count ?? 0,
          node.started_at ?? null,
          node.completed_at ?? null,
          now,
          now
        )
      })
    })

    create(nodes)
    return this.listRunNodes(workflowRunId)
  }

  listRunNodes(workflowRunId: string): WorkflowRunNode[] {
    const rows = this.db
      .prepare(
        `
          SELECT *
          FROM workflow_run_nodes
          WHERE workflow_run_id = ?
          ORDER BY created_at ASC, node_key ASC
        `
      )
      .all(workflowRunId) as DbWorkflowRunNode[]

    return rows.map((row) => this.mapRow(row))
  }

  getRunNode(id: string): WorkflowRunNode | null {
    const row = this.db.prepare('SELECT * FROM workflow_run_nodes WHERE id = ?').get(id) as
      | DbWorkflowRunNode
      | undefined

    return row ? this.mapRow(row) : null
  }

  getTaskIdBySessionId(sessionId: string): string | null {
    const row = this.db
      .prepare(
        `
          SELECT wr.task_id
          FROM workflow_run_nodes wrn
          INNER JOIN workflow_runs wr ON wr.id = wrn.workflow_run_id
          WHERE wrn.session_id = ?
          LIMIT 1
        `
      )
      .get(sessionId) as { task_id?: string } | undefined

    return row?.task_id ?? null
  }

  getRunNodesByStatus(workflowRunId: string, status: WorkflowRunNodeStatus): WorkflowRunNode[] {
    const rows = this.db
      .prepare(
        `
          SELECT *
          FROM workflow_run_nodes
          WHERE workflow_run_id = ? AND status = ?
          ORDER BY created_at ASC, node_key ASC
        `
      )
      .all(workflowRunId, status) as DbWorkflowRunNode[]

    return rows.map((row) => this.mapRow(row))
  }

  getAllNodesByStatus(status: WorkflowRunNodeStatus): WorkflowRunNode[] {
    const rows = this.db
      .prepare(
        `
          SELECT *
          FROM workflow_run_nodes
          WHERE status = ?
          ORDER BY updated_at ASC
        `
      )
      .all(status) as DbWorkflowRunNode[]

    return rows.map((row) => this.mapRow(row))
  }

  updateRunNode(id: string, updates: UpdateWorkflowRunNodeInput): WorkflowRunNode | null {
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: unknown[] = []

    if (updates.status !== undefined) {
      fields.push('status = ?')
      values.push(updates.status)
    }
    if (updates.failure_reason !== undefined) {
      fields.push('failure_reason = ?')
      values.push(updates.failure_reason)
    }
    if (updates.session_id !== undefined) {
      fields.push('session_id = ?')
      values.push(updates.session_id)
    }
    if (updates.resume_session_id !== undefined) {
      fields.push('resume_session_id = ?')
      values.push(updates.resume_session_id)
    }
    if (updates.cli_tool_id !== undefined) {
      fields.push('cli_tool_id = ?')
      values.push(updates.cli_tool_id)
    }
    if (updates.agent_tool_config_id !== undefined) {
      fields.push('agent_tool_config_id = ?')
      values.push(updates.agent_tool_config_id)
    }
    if (updates.result_summary !== undefined) {
      fields.push('result_summary = ?')
      values.push(updates.result_summary)
    }
    if (updates.error_message !== undefined) {
      fields.push('error_message = ?')
      values.push(updates.error_message)
    }
    if (updates.cost !== undefined) {
      fields.push('cost = ?')
      values.push(updates.cost)
    }
    if (updates.duration !== undefined) {
      fields.push('duration = ?')
      values.push(updates.duration)
    }
    if (updates.attempt_count !== undefined) {
      fields.push('attempt_count = ?')
      values.push(updates.attempt_count)
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
      return this.getRunNode(id)
    }

    fields.push('updated_at = ?')
    values.push(now, id)
    this.db.prepare(`UPDATE workflow_run_nodes SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.getRunNode(id)
  }

  updateRunNodeRuntime(
    workflowRunId: string,
    workflowRunNodeId: string | null,
    updates: {
      session_id?: string | null
      resume_session_id?: string | null
      cli_tool_id?: string | null
      agent_tool_config_id?: string | null
    }
  ): WorkflowRunNode | null {
    const node =
      (workflowRunNodeId ? this.getRunNode(workflowRunNodeId) : null) ??
      this.getRunNodesByStatus(workflowRunId, 'running')[0] ??
      this.getRunNodesByStatus(workflowRunId, 'review')[0] ??
      this.getRunNodesByStatus(workflowRunId, 'waiting')[0] ??
      this.listRunNodes(workflowRunId)[0]

    if (!node) return null

    const fields: string[] = []
    const values: unknown[] = []

    if (updates.session_id !== undefined) {
      fields.push('session_id = ?')
      values.push(updates.session_id)
    }
    if (updates.resume_session_id !== undefined) {
      fields.push('resume_session_id = ?')
      values.push(updates.resume_session_id)
    }
    if (updates.cli_tool_id !== undefined) {
      fields.push('cli_tool_id = ?')
      values.push(updates.cli_tool_id)
    }
    if (updates.agent_tool_config_id !== undefined) {
      fields.push('agent_tool_config_id = ?')
      values.push(updates.agent_tool_config_id)
    }

    if (fields.length === 0) {
      return node
    }

    const now = new Date().toISOString()
    fields.push('updated_at = ?')
    values.push(now, node.id)

    this.db
      .prepare(`UPDATE workflow_run_nodes SET ${fields.join(', ')} WHERE id = ?`)
      .run(...values)

    return this.getRunNode(node.id)
  }

  setNodeSessionId(nodeId: string, sessionId: string | null): WorkflowRunNode | null {
    return this.updateRunNode(nodeId, { session_id: sessionId })
  }

  setNodeResumeSessionId(nodeId: string, resumeSessionId: string | null): WorkflowRunNode | null {
    return this.updateRunNode(nodeId, { resume_session_id: resumeSessionId })
  }

  markRunning(id: string, sessionId?: string | null): WorkflowRunNode | null {
    const node = this.getRunNode(id)
    if (!node) return null

    return this.updateRunNode(id, {
      status: 'running',
      session_id: sessionId ?? node.session_id,
      started_at: node.started_at ?? new Date().toISOString(),
      error_message: null,
      result_summary: null,
      failure_reason: null
    })
  }

  markReview(id: string, result: {
    result_summary?: string | null
    error_message?: string | null
    cost?: number | null
    duration?: number | null
    session_id?: string | null
  } = {}): WorkflowRunNode | null {
    return this.updateRunNode(id, {
      status: 'review',
      result_summary: result.result_summary ?? null,
      error_message: result.error_message ?? null,
      cost: result.cost ?? null,
      duration: result.duration ?? null,
      session_id: result.session_id,
      completed_at: new Date().toISOString(),
      failure_reason: null
    })
  }

  markDone(id: string, result: {
    result_summary?: string | null
    cost?: number | null
    duration?: number | null
    session_id?: string | null
  } = {}): WorkflowRunNode | null {
    return this.updateRunNode(id, {
      status: 'done',
      result_summary: result.result_summary ?? null,
      error_message: null,
      cost: result.cost ?? null,
      duration: result.duration ?? null,
      session_id: result.session_id,
      completed_at: new Date().toISOString(),
      failure_reason: null
    })
  }

  markFailed(
    id: string,
    failureReason: WorkflowRunNodeFailureReason,
    errorMessage?: string | null
  ): WorkflowRunNode | null {
    return this.updateRunNode(id, {
      status: 'failed',
      failure_reason: failureReason,
      error_message: errorMessage ?? null,
      completed_at: new Date().toISOString()
    })
  }

  resetForRetry(id: string): WorkflowRunNode | null {
    const node = this.getRunNode(id)
    if (!node) return null

    return this.updateRunNode(id, {
      status: 'waiting',
      failure_reason: null,
      session_id: null,
      resume_session_id: null,
      result_summary: null,
      error_message: null,
      cost: null,
      duration: null,
      started_at: null,
      completed_at: null,
      attempt_count: node.attempt_count + 1
    })
  }

  failActiveNodes(workflowRunId: string, reason: WorkflowRunNodeFailureReason): number {
    const now = new Date().toISOString()
    const result = this.db
      .prepare(
        `
          UPDATE workflow_run_nodes
          SET
            status = 'failed',
            failure_reason = ?,
            error_message = CASE
              WHEN error_message IS NULL OR error_message = ''
                THEN 'Run stopped'
              ELSE error_message
            END,
            completed_at = COALESCE(completed_at, ?),
            updated_at = ?
          WHERE workflow_run_id = ? AND status IN ('waiting', 'running', 'review')
        `
      )
      .run(reason, now, now, workflowRunId)

    return result.changes
  }

  private mapRow(row: DbWorkflowRunNode): WorkflowRunNode {
    return {
      id: row.id,
      workflow_run_id: row.workflow_run_id,
      definition_node_id: row.definition_node_id,
      node_key: row.node_key,
      name: row.name,
      node_type: row.node_type,
      prompt: row.prompt,
      command: row.command,
      cli_tool_id: row.cli_tool_id,
      agent_tool_config_id: row.agent_tool_config_id,
      requires_approval_after_run: Boolean(row.requires_approval_after_run),
      status: row.status,
      failure_reason: row.failure_reason,
      session_id: row.session_id,
      resume_session_id: row.resume_session_id,
      result_summary: row.result_summary,
      error_message: row.error_message,
      cost: row.cost,
      duration: row.duration,
      attempt_count: row.attempt_count,
      started_at: row.started_at,
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    }
  }
}
