import Database from 'better-sqlite3'
import { normalizeCliToolConfig } from '../../../shared/agent-cli-config-spec'

const TARGET_SCHEMA_VERSION = 12

export class DatabaseConnection {
  private dbPath: string
  private db?: Database.Database

  constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  open(): Database.Database {
    if (!this.db) {
      this.db = new Database(this.dbPath)
      this.db.pragma('journal_mode = WAL')
      this.db.pragma('foreign_keys = ON')
    }
    return this.db
  }

  initTables(): void {
    const db = this.assertDb()
    console.log('[DatabaseService] Initializing tables...')

    this.createBaseTables(db)
    this.createBaseIndexes(db)

    let userVersion = Number(db.pragma('user_version', { simple: true }) ?? 0)
    if (userVersion < 3) {
      console.log(
        `[DatabaseService] Rebuilding runtime schema: v${userVersion} -> v3`
      )
      const rebuildRuntimeSchema = db.transaction(() => {
        db.exec(`
          DROP TABLE IF EXISTS task_node_runs;
          DROP TABLE IF EXISTS agent_executions;
          DROP TABLE IF EXISTS work_nodes;
          DROP TABLE IF EXISTS workflows;
          DROP TABLE IF EXISTS project_settings;
          DROP TABLE IF EXISTS task_nodes;
          DROP TABLE IF EXISTS tasks;
        `)

        this.createRuntimeTables(db)
        db.pragma('user_version = 3')
      })

      rebuildRuntimeSchema()
      userVersion = 3
    } else {
      this.createRuntimeTables(db)
    }

    // Run migrations before creating runtime indexes; older DBs may have tables that exist but
    // don't match the latest shape, which can cause index creation to fail.
    this.migrateSchema(db, userVersion)
    this.createRuntimeIndexes(db)

    console.log('[DatabaseService] Tables initialized successfully')
  }

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = undefined
    }
  }

  getDb(): Database.Database {
    return this.assertDb()
  }

  private assertDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database not opened')
    }
    return this.db
  }

  private createBaseTables(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_tool_configs (
        id TEXT PRIMARY KEY,
        tool_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        config_json TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        description TEXT,
        project_type TEXT NOT NULL DEFAULT 'normal'
          CHECK (project_type IN ('normal', 'git')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS automations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        trigger_type TEXT NOT NULL CHECK (trigger_type IN ('interval', 'daily', 'weekly')),
        trigger_json TEXT NOT NULL,
        timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
        source_task_id TEXT,
        template_json TEXT NOT NULL,
        next_run_at TEXT NOT NULL,
        last_run_at TEXT,
        last_status TEXT CHECK (last_status IS NULL OR last_status IN ('running', 'success', 'failed', 'skipped')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS automation_runs (
        id TEXT PRIMARY KEY,
        automation_id TEXT NOT NULL,
        scheduled_at TEXT NOT NULL,
        triggered_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'skipped')),
        task_id TEXT,
        task_node_id TEXT,
        session_id TEXT,
        error_message TEXT,
        finished_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
        FOREIGN KEY (task_node_id) REFERENCES workflow_run_nodes(id) ON DELETE SET NULL,
        UNIQUE (automation_id, scheduled_at)
      );
    `)
  }

  private createRuntimeTables(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,

        status TEXT NOT NULL DEFAULT 'todo'
          CHECK (status IN ('todo', 'in_progress', 'in_review', 'done', 'failed')),
        task_mode TEXT NOT NULL DEFAULT 'conversation'
          CHECK (task_mode IN ('conversation', 'workflow')),

        project_id TEXT,
        worktree_path TEXT,
        branch_name TEXT,
        base_branch TEXT,
        workspace_path TEXT,

        started_at TEXT,
        completed_at TEXT,
        cost REAL,
        duration REAL,

        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,

        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,

        CHECK (
          (worktree_path IS NULL AND branch_name IS NULL AND base_branch IS NULL)
          OR
          (worktree_path IS NOT NULL AND branch_name IS NOT NULL AND base_branch IS NOT NULL)
        )
      );

      CREATE TABLE IF NOT EXISTS workflow_definitions (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL CHECK (scope IN ('global', 'project')),
        project_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        definition_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workflow_runs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL UNIQUE,
        workflow_definition_id TEXT,
        status TEXT NOT NULL
          CHECK (status IN ('waiting', 'running', 'review', 'done', 'failed')),
        definition_snapshot_json TEXT NOT NULL,
        current_wave INTEGER NOT NULL DEFAULT 0,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (workflow_definition_id) REFERENCES workflow_definitions(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS workflow_run_nodes (
        id TEXT PRIMARY KEY,
        workflow_run_id TEXT NOT NULL,
        definition_node_id TEXT NOT NULL,
        node_key TEXT NOT NULL,
        name TEXT NOT NULL,
        node_type TEXT NOT NULL CHECK (node_type IN ('agent')),
        prompt TEXT,
        cli_tool_id TEXT
          CHECK (cli_tool_id IS NULL OR cli_tool_id IN (
            'claude-code', 'cursor-agent', 'gemini-cli', 'codex', 'codex-cli', 'opencode'
          )),
        agent_tool_config_id TEXT,
        requires_approval_after_run INTEGER NOT NULL DEFAULT 0
          CHECK (requires_approval_after_run IN (0, 1)),
        status TEXT NOT NULL
          CHECK (status IN ('waiting', 'running', 'review', 'done', 'failed')),
        failure_reason TEXT
          CHECK (failure_reason IN ('execution_error', 'cancelled') OR failure_reason IS NULL),
        session_id TEXT,
        resume_session_id TEXT,
        result_summary TEXT,
        error_message TEXT,
        cost REAL,
        duration REAL,
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_tool_config_id) REFERENCES agent_tool_configs(id) ON DELETE SET NULL,
        UNIQUE (workflow_run_id, definition_node_id),
        UNIQUE (workflow_run_id, node_key)
      );

      CREATE TABLE IF NOT EXISTS workflow_run_reviews (
        id TEXT PRIMARY KEY,
        workflow_run_id TEXT NOT NULL,
        workflow_run_node_id TEXT NOT NULL,
        decision TEXT NOT NULL CHECK (decision IN ('approved')),
        comment TEXT,
        reviewed_by TEXT,
        reviewed_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE,
        FOREIGN KEY (workflow_run_node_id) REFERENCES workflow_run_nodes(id) ON DELETE CASCADE
      );
    `)
  }

  private createBaseIndexes(db: Database.Database): void {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);

      CREATE INDEX IF NOT EXISTS idx_agent_tool_configs_tool_id ON agent_tool_configs(tool_id);

      DROP INDEX IF EXISTS uniq_agent_tool_config;
      DROP INDEX IF EXISTS uniq_agent_tool_default;
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_agent_tool_config
        ON agent_tool_configs(tool_id, name);
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_agent_tool_default
        ON agent_tool_configs(tool_id)
        WHERE is_default = 1;

      CREATE INDEX IF NOT EXISTS idx_automations_enabled_next_run
        ON automations(enabled, next_run_at);

      CREATE INDEX IF NOT EXISTS idx_runs_automation_created
        ON automation_runs(automation_id, created_at);
    `)
  }

  private createRuntimeIndexes(db: Database.Database): void {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

      CREATE UNIQUE INDEX IF NOT EXISTS uniq_tasks_worktree_path
        ON tasks(worktree_path)
        WHERE worktree_path IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_tasks_project_branch
        ON tasks(project_id, branch_name)
        WHERE project_id IS NOT NULL AND branch_name IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS uniq_workflow_definitions_global_name
        ON workflow_definitions(name)
        WHERE scope = 'global';
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_workflow_definitions_project_name
        ON workflow_definitions(project_id, name)
        WHERE scope = 'project';
      CREATE INDEX IF NOT EXISTS idx_workflow_definitions_scope_project
        ON workflow_definitions(scope, project_id, updated_at DESC);
    `)

    // Workflow tables had a legacy schema in older DBs; guard index creation so we can migrate cleanly.
    if (this.tableHasColumn(db, 'workflow_runs', 'status') && this.tableHasColumn(db, 'workflow_runs', 'updated_at')) {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_workflow_runs_status
          ON workflow_runs(status, updated_at DESC);
      `)
    }

    if (this.tableHasColumn(db, 'workflow_runs', 'workflow_definition_id')) {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_workflow_runs_definition
          ON workflow_runs(workflow_definition_id, created_at DESC);
      `)
    }

    if (this.tableHasColumn(db, 'workflow_run_nodes', 'workflow_run_id')) {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_workflow_run_nodes_run_status
          ON workflow_run_nodes(workflow_run_id, status, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_workflow_run_nodes_session_id
          ON workflow_run_nodes(session_id);
      `)
    }

    if (this.tableHasColumn(db, 'workflow_run_reviews', 'workflow_run_node_id')) {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_workflow_run_reviews_node
          ON workflow_run_reviews(workflow_run_node_id, reviewed_at DESC);
      `)
    }
  }

  private migrateSchema(db: Database.Database, originalUserVersion: number): void {
    let currentVersion = Number(db.pragma('user_version', { simple: true }) ?? originalUserVersion)

    if (currentVersion < 4) {
      const migrateToV4 = db.transaction(() => {
        this.createBaseTables(db)
        this.createBaseIndexes(db)
        db.pragma('user_version = 4')
      })

      migrateToV4()
      currentVersion = 4
      console.log('[DatabaseService] Migrated schema to v4')
    }

    if (currentVersion < 5) {
      const migrateToV5 = db.transaction(() => {
        if (this.tableExists(db, 'task_nodes') && !this.tableHasColumn(db, 'task_nodes', 'resume_session_id')) {
          db.exec(`ALTER TABLE task_nodes ADD COLUMN resume_session_id TEXT`)
        }
        db.pragma('user_version = 5')
      })

      migrateToV5()
      currentVersion = 5
      console.log('[DatabaseService] Migrated schema to v5')
    }

    if (currentVersion < 6) {
      const migrateToV6 = db.transaction(() => {
        this.normalizeAgentToolConfigs(db)
        db.pragma('user_version = 6')
      })

      migrateToV6()
      currentVersion = 6
      console.log('[DatabaseService] Migrated schema to v6')
    }

    if (currentVersion < 7) {
      const migrateToV7 = db.transaction(() => {
        this.createRuntimeTables(db)
        this.createRuntimeIndexes(db)
        db.pragma('user_version = 7')
      })

      migrateToV7()
      currentVersion = 7
      console.log('[DatabaseService] Migrated schema to v7')
    }

    if (currentVersion < 8) {
      db.pragma('foreign_keys = OFF')
      const migrateToV8 = db.transaction(() => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS tasks_v8 (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            prompt TEXT NOT NULL,

            status TEXT NOT NULL DEFAULT 'todo'
              CHECK (status IN ('todo', 'in_progress', 'in_review', 'done', 'failed')),
            task_mode TEXT NOT NULL DEFAULT 'conversation'
              CHECK (task_mode IN ('conversation', 'workflow')),

            project_id TEXT,
            worktree_path TEXT,
            branch_name TEXT,
            base_branch TEXT,
            workspace_path TEXT,

            started_at TEXT,
            completed_at TEXT,
            cost REAL,
            duration REAL,

            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,

            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,

            CHECK (
              (worktree_path IS NULL AND branch_name IS NULL AND base_branch IS NULL)
              OR
              (worktree_path IS NOT NULL AND branch_name IS NOT NULL AND base_branch IS NOT NULL)
            )
          );

          INSERT INTO tasks_v8 (
            id, title, prompt, status, task_mode, project_id, worktree_path, branch_name,
            base_branch, workspace_path, started_at, completed_at, cost, duration, created_at, updated_at
          )
          SELECT
            id, title, prompt, status, task_mode, project_id, worktree_path, branch_name,
            base_branch, workspace_path, started_at, completed_at, cost, duration, created_at, updated_at
          FROM tasks;

          DROP TABLE tasks;
          ALTER TABLE tasks_v8 RENAME TO tasks;
        `)

        this.createRuntimeIndexes(db)
        db.pragma('user_version = 8')
      })

      try {
        migrateToV8()
        currentVersion = 8
        console.log('[DatabaseService] Migrated schema to v8')
      } finally {
        db.pragma('foreign_keys = ON')
      }
    }

    if (currentVersion < 9) {
      db.pragma('foreign_keys = OFF')
      const migrateToV9 = db.transaction(() => {
        // workflow_template_nodes used to include a NOT NULL `capability_spec_json` column. The current
        // code no longer writes it, so we rebuild the table to match the new schema while preserving data.
        if (this.tableHasColumn(db, 'workflow_template_nodes', 'capability_spec_json')) {
          db.exec(`
            DROP TABLE IF EXISTS workflow_template_nodes_v9;
            CREATE TABLE workflow_template_nodes_v9 (
              id TEXT PRIMARY KEY,
              template_id TEXT NOT NULL,
              node_order INTEGER NOT NULL CHECK (node_order >= 1),
              name TEXT NOT NULL,
              prompt TEXT NOT NULL,
              cli_tool_id TEXT
                CHECK (cli_tool_id IS NULL OR cli_tool_id IN (
                  'claude-code', 'cursor-agent', 'gemini-cli', 'codex', 'codex-cli', 'opencode'
                )),
              agent_tool_config_id TEXT,
              requires_approval INTEGER NOT NULL DEFAULT 0 CHECK (requires_approval IN (0, 1)),
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY (template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE,
              FOREIGN KEY (agent_tool_config_id) REFERENCES agent_tool_configs(id) ON DELETE SET NULL,
              UNIQUE (template_id, node_order)
            );

            INSERT INTO workflow_template_nodes_v9 (
              id, template_id, node_order, name, prompt, cli_tool_id, agent_tool_config_id,
              requires_approval, created_at, updated_at
            )
            SELECT
              id,
              template_id,
              node_order,
              name,
              prompt,
              CASE
                WHEN cli_tool_id IN ('claude-code', 'cursor-agent', 'gemini-cli', 'codex', 'codex-cli', 'opencode')
                  THEN cli_tool_id
                ELSE NULL
              END AS cli_tool_id,
              agent_tool_config_id,
              requires_approval,
              created_at,
              updated_at
            FROM workflow_template_nodes;

            DROP TABLE workflow_template_nodes;
            ALTER TABLE workflow_template_nodes_v9 RENAME TO workflow_template_nodes;
          `)

          this.createBaseIndexes(db)
        }

        // Older DBs may have a legacy workflow runtime schema (different columns and extra tables).
        // Rebuild runtime workflow tables to the current schema to prevent crashes at startup.
        const hasNewWorkflowRuns = this.tableHasColumn(db, 'workflow_runs', 'workflow_definition_id')
        const hasNewWorkflowRunNodes = this.tableHasColumn(db, 'workflow_run_nodes', 'workflow_run_id')
        if (!hasNewWorkflowRuns || !hasNewWorkflowRunNodes) {
          const legacyWorkflowTables = [
            'workflow_run_reviews',
            'workflow_attempt_artifacts',
            'workflow_node_attempts',
            'workflow_run_edges',
            'workflow_run_snapshots',
            'workflow_run_nodes',
            'workflow_runs'
          ]

          // Snapshot legacy workflow runtime data before dropping incompatible tables.
          // This keeps historical rows available for manual recovery if needed.
          for (const tableName of legacyWorkflowTables) {
            if (!this.tableExists(db, tableName)) {
              continue
            }

            const backupTableName = `legacy_${tableName}_v9`
            if (this.tableExists(db, backupTableName)) {
              continue
            }

            db.exec(`
              CREATE TABLE ${backupTableName} AS
              SELECT * FROM ${tableName};
            `)
          }

          db.exec(`
            DROP TABLE IF EXISTS workflow_run_reviews;
            DROP TABLE IF EXISTS workflow_attempt_artifacts;
            DROP TABLE IF EXISTS workflow_node_attempts;
            DROP TABLE IF EXISTS workflow_run_edges;
            DROP TABLE IF EXISTS workflow_run_snapshots;
            DROP TABLE IF EXISTS workflow_run_nodes;
            DROP TABLE IF EXISTS workflow_runs;
          `)
          this.createRuntimeTables(db)
        }

        db.pragma('user_version = 9')
      })

      try {
        migrateToV9()
        currentVersion = 9
        console.log('[DatabaseService] Migrated schema to v9')
      } finally {
        db.pragma('foreign_keys = ON')
      }
    }

    if (currentVersion < 10) {
      db.pragma('foreign_keys = OFF')
      const migrateToV10 = db.transaction(() => {
        db.exec(`
          DROP INDEX IF EXISTS uniq_global_template_name;
          DROP INDEX IF EXISTS uniq_project_template_name;
          DROP INDEX IF EXISTS idx_workflow_template_nodes_template_id;
          DROP INDEX IF EXISTS idx_task_nodes_task_id;
          DROP INDEX IF EXISTS idx_task_nodes_status;
          DROP INDEX IF EXISTS idx_task_nodes_task_status_order;
          DROP INDEX IF EXISTS idx_task_nodes_session_id;
          DROP INDEX IF EXISTS uniq_task_nodes_single_in_progress;
          DROP TABLE IF EXISTS workflow_template_nodes;
          DROP TABLE IF EXISTS workflow_templates;
          DROP TABLE IF EXISTS task_nodes;
        `)

        db.exec(`
          DROP TABLE IF EXISTS workflow_runs_v10;
          CREATE TABLE workflow_runs_v10 (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL UNIQUE,
            workflow_definition_id TEXT,
            status TEXT NOT NULL
              CHECK (status IN ('waiting', 'running', 'review', 'done', 'failed')),
            definition_snapshot_json TEXT NOT NULL,
            current_wave INTEGER NOT NULL DEFAULT 0,
            started_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (workflow_definition_id) REFERENCES workflow_definitions(id) ON DELETE RESTRICT
          );

          INSERT INTO workflow_runs_v10 (
            id, task_id, workflow_definition_id, status, definition_snapshot_json,
            current_wave, started_at, completed_at, created_at, updated_at
          )
          SELECT
            id, task_id, workflow_definition_id, status, definition_snapshot_json,
            current_wave, started_at, completed_at, created_at, updated_at
          FROM workflow_runs;

          DROP TABLE workflow_runs;
          ALTER TABLE workflow_runs_v10 RENAME TO workflow_runs;
        `)

        db.exec(`
          DROP TABLE IF EXISTS automation_runs_v10;
          CREATE TABLE automation_runs_v10 (
            id TEXT PRIMARY KEY,
            automation_id TEXT NOT NULL,
            scheduled_at TEXT NOT NULL,
            triggered_at TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'skipped')),
            task_id TEXT,
            task_node_id TEXT,
            session_id TEXT,
            error_message TEXT,
            finished_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
            FOREIGN KEY (task_node_id) REFERENCES workflow_run_nodes(id) ON DELETE SET NULL,
            UNIQUE (automation_id, scheduled_at)
          );

          INSERT INTO automation_runs_v10 (
            id, automation_id, scheduled_at, triggered_at, status, task_id, task_node_id,
            session_id, error_message, finished_at, created_at, updated_at
          )
          SELECT
            id, automation_id, scheduled_at, triggered_at, status, task_id, task_node_id,
            session_id, error_message, finished_at, created_at, updated_at
          FROM automation_runs;

          DROP TABLE automation_runs;
          ALTER TABLE automation_runs_v10 RENAME TO automation_runs;
        `)

        this.createBaseTables(db)
        this.createBaseIndexes(db)
        this.createRuntimeTables(db)
        this.createRuntimeIndexes(db)
        db.pragma('user_version = 10')
      })

      try {
        migrateToV10()
        currentVersion = 10
        console.log('[DatabaseService] Migrated schema to v10')
      } finally {
        db.pragma('foreign_keys = ON')
      }
    }

    if (currentVersion < 11) {
      const migrateToV11 = db.transaction(() => {
        db.exec(`
          DROP INDEX IF EXISTS uniq_workflow_run_nodes_single_running;
        `)

        this.createRuntimeIndexes(db)
        db.pragma('user_version = 11')
      })

      migrateToV11()
      currentVersion = 11
      console.log('[DatabaseService] Migrated schema to v11')
    }

    if (currentVersion < 12) {
      db.pragma('foreign_keys = OFF')
      const migrateToV12 = db.transaction(() => {
        db.exec(`
          DROP TABLE IF EXISTS workflow_run_reviews;
          DROP TABLE IF EXISTS workflow_run_nodes;
          DROP TABLE IF EXISTS workflow_runs;
          DROP TABLE IF EXISTS automation_runs;
        `)

        this.createBaseTables(db)
        this.createBaseIndexes(db)
        this.createRuntimeTables(db)
        this.createRuntimeIndexes(db)
        db.pragma('user_version = 12')
      })

      try {
        migrateToV12()
        currentVersion = 12
        console.log('[DatabaseService] Migrated schema to v12')
      } finally {
        db.pragma('foreign_keys = ON')
      }
    }

    if (currentVersion < TARGET_SCHEMA_VERSION) {
      db.pragma(`user_version = ${TARGET_SCHEMA_VERSION}`)
    }
  }

  private tableHasColumn(db: Database.Database, tableName: string, columnName: string): boolean {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name?: string }>
    return columns.some((column) => column.name === columnName)
  }

  private tableExists(db: Database.Database, tableName: string): boolean {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName) as { name?: string } | undefined

    return row?.name === tableName
  }

  private normalizeAgentToolConfigs(db: Database.Database): void {
    const rows = db
      .prepare('SELECT id, tool_id, config_json FROM agent_tool_configs')
      .all() as Array<{ id: string; tool_id: string; config_json: string }>

    const updateStmt = db.prepare(
      'UPDATE agent_tool_configs SET config_json = ?, updated_at = ? WHERE id = ?'
    )

    for (const row of rows) {
      let parsed: Record<string, unknown>
      try {
        const value = JSON.parse(row.config_json)
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          continue
        }
        parsed = value as Record<string, unknown>
      } catch {
        continue
      }

      const normalized = normalizeCliToolConfig(row.tool_id, parsed)
      const nextJson = JSON.stringify(normalized, null, 2)
      if (nextJson === row.config_json) {
        continue
      }

      updateStmt.run(nextJson, new Date().toISOString(), row.id)
    }
  }
}
