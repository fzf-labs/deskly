import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { describe, expect, it } from 'vitest'
import { DatabaseConnection } from '../../src/main/services/database/DatabaseConnection'

describe('workflow runtime schema', () => {
  it('migrates to latest schema without legacy task/template tables', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'deskly-task-nodes-'))
    const dbPath = join(tempDir, 'test.db')

    const connection = new DatabaseConnection(dbPath)
    let db
    try {
      db = connection.open()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('NODE_MODULE_VERSION')) {
        // CI/runtime node ABI mismatch for native better-sqlite3; skip schema assertion in this environment.
        rmSync(tempDir, { recursive: true, force: true })
        return
      }
      throw error
    }

    connection.initTables()

    const userVersion = Number(db.pragma('user_version', { simple: true }) ?? 0)
    expect(userVersion).toBe(12)

    const taskNodesTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='task_nodes'")
      .get() as { name?: string } | undefined
    expect(taskNodesTable?.name).toBeUndefined()

    const workflowTemplatesTable = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='workflow_templates'"
      )
      .get() as { name?: string } | undefined
    expect(workflowTemplatesTable?.name).toBeUndefined()

    const workflowTemplateNodesTable = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='workflow_template_nodes'"
      )
      .get() as { name?: string } | undefined
    expect(workflowTemplateNodesTable?.name).toBeUndefined()

    const workflowRunsColumns = db
      .prepare("PRAGMA table_info(workflow_runs)")
      .all() as Array<{ name?: string; notnull?: number }>
    expect(
      workflowRunsColumns.find((column) => column.name === 'workflow_definition_id')?.notnull
    ).toBe(0)

    const workflowRunNodeColumns = db
      .prepare("PRAGMA table_info(workflow_run_nodes)")
      .all() as Array<{ name?: string }>
    expect(workflowRunNodeColumns.some((column) => column.name === 'command')).toBe(false)

    const automationTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='automations'")
      .get() as { name?: string } | undefined
    expect(automationTable?.name).toBe('automations')

    const automationRunTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='automation_runs'")
      .get() as { name?: string } | undefined
    expect(automationRunTable?.name).toBe('automation_runs')

    const automationIdx = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_automations_enabled_next_run'")
      .get() as { name?: string } | undefined
    expect(automationIdx?.name).toBe('idx_automations_enabled_next_run')

    const runsIdx = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_runs_automation_created'")
      .get() as { name?: string } | undefined
    expect(runsIdx?.name).toBe('idx_runs_automation_created')

    const workflowRunNodeIndex = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='uniq_workflow_run_nodes_single_running'"
      )
      .get() as { name?: string } | undefined
    expect(workflowRunNodeIndex?.name).toBeUndefined()

    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO tasks (id, title, prompt, status, task_mode, created_at, updated_at)
       VALUES (?, ?, ?, 'todo', 'conversation', ?, ?)`
    ).run('task-1', 'Task 1', 'prompt', now, now)

    db.prepare(
      `INSERT INTO workflow_runs (
         id, task_id, workflow_definition_id, status, definition_snapshot_json, current_wave, created_at, updated_at
       ) VALUES (?, ?, NULL, 'waiting', ?, 0, ?, ?)`
    ).run(
      'run-1',
      'task-1',
      JSON.stringify({
        version: 1,
        nodes: [{ id: 'def-node-1', key: 'conversation', type: 'agent', name: 'Conversation', prompt: null, cliToolId: null, agentToolConfigId: null, requiresApprovalAfterRun: false, position: null }],
        edges: []
      }),
      now,
      now
    )

    db.prepare(
      `INSERT INTO automations (
         id, name, enabled, trigger_type, trigger_json, timezone, source_task_id, template_json,
         next_run_at, last_run_at, last_status, created_at, updated_at
       ) VALUES (?, ?, 1, 'interval', ?, 'Asia/Shanghai', NULL, ?, ?, NULL, NULL, ?, ?)`
    ).run(
      'automation-1',
      'Automation 1',
      JSON.stringify({ interval_seconds: 60 }),
      JSON.stringify({ title: 'Task 1', prompt: 'prompt', taskMode: 'conversation' }),
      now,
      now,
      now
    )

    db.prepare(
      `INSERT INTO workflow_run_nodes (
         id, workflow_run_id, definition_node_id, node_key, name, node_type, prompt,
         cli_tool_id, agent_tool_config_id, requires_approval_after_run, status, failure_reason,
         session_id, resume_session_id, result_summary, error_message, cost, duration, attempt_count,
         started_at, completed_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, ?, NULL, ?, ?)`
    ).run(
      'node-1',
      'run-1',
      'def-node-1',
      'conversation',
      'Conversation',
      'agent',
      'prompt',
      null,
      null,
      0,
      now,
      now,
      now
    )

    db.prepare(
      `INSERT INTO workflow_run_nodes (
         id, workflow_run_id, definition_node_id, node_key, name, node_type, prompt,
         cli_tool_id, agent_tool_config_id, requires_approval_after_run, status, failure_reason,
         session_id, resume_session_id, result_summary, error_message, cost, duration, attempt_count,
         started_at, completed_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, ?, NULL, ?, ?)`
    ).run(
      'node-2',
      'run-1',
      'def-node-2',
      'validation',
      'Validation',
      'agent',
      'Summarize the validation result',
      null,
      null,
      0,
      now,
      now,
      now
    )

    db.prepare(
      `INSERT INTO automation_runs (
         id, automation_id, scheduled_at, triggered_at, status, task_id, task_node_id, session_id,
         error_message, finished_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, 'running', ?, ?, NULL, NULL, NULL, ?, ?)`
    ).run('automation-run-1', 'automation-1', now, now, 'task-1', 'node-1', now, now)

    connection.close()
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('drops the legacy single-running workflow node index during migration', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'deskly-task-nodes-migrate-'))
    const dbPath = join(tempDir, 'test.db')

    const seedConnection = new DatabaseConnection(dbPath)
    let seedDb
    try {
      seedDb = seedConnection.open()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('NODE_MODULE_VERSION')) {
        rmSync(tempDir, { recursive: true, force: true })
        return
      }
      throw error
    }

    seedConnection.initTables()
    seedDb.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_workflow_run_nodes_single_running
        ON workflow_run_nodes(workflow_run_id)
        WHERE status = 'running';
    `)
    seedDb.pragma('user_version = 11')
    seedConnection.close()

    const migratedConnection = new DatabaseConnection(dbPath)
    const migratedDb = migratedConnection.open()
    migratedConnection.initTables()

    const userVersion = Number(migratedDb.pragma('user_version', { simple: true }) ?? 0)
    expect(userVersion).toBe(12)

    const workflowRunNodeIndex = migratedDb
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='uniq_workflow_run_nodes_single_running'"
      )
      .get() as { name?: string } | undefined
    expect(workflowRunNodeIndex?.name).toBeUndefined()

    migratedConnection.close()
    rmSync(tempDir, { recursive: true, force: true })
  })
})
