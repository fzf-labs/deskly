import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

import { DatabaseConnection } from '../../src/main/services/database/DatabaseConnection'

describe('agent tool config schema migration', () => {
  it('migrates stored config_json values to canonical supported keys and upgrades schema to latest version', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'deskly-agent-config-'))
    const dbPath = join(tempDir, 'test.db')

    let seedDb: Database.Database
    try {
      seedDb = new Database(dbPath)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('NODE_MODULE_VERSION')) {
        rmSync(tempDir, { recursive: true, force: true })
        return
      }
      throw error
    }

    seedDb.exec(`
      CREATE TABLE agent_tool_configs (
        id TEXT PRIMARY KEY,
        tool_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        config_json TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)

    const now = new Date().toISOString()
    seedDb
      .prepare(
        `INSERT INTO agent_tool_configs (
           id, tool_id, name, description, config_json, is_default, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'cfg-1',
        'codex',
        'DEFAULT',
        null,
        JSON.stringify(
          {
            configOverrides: ['model="gpt-5"'],
            localProvider: 'ollama',
            model_reasoning_effort: 'high',
            developer_instructions: 'legacy',
            include_apply_patch_tool: true
          },
          null,
          2
        ),
        1,
        now,
        now
      )
    seedDb.pragma('user_version = 5')
    seedDb.close()

    const connection = new DatabaseConnection(dbPath)
    const db = connection.open()
    connection.initTables()

    const userVersion = Number(db.pragma('user_version', { simple: true }) ?? 0)
    expect(userVersion).toBe(9)

    const row = db
      .prepare('SELECT config_json FROM agent_tool_configs WHERE id = ?')
      .get('cfg-1') as { config_json: string }

    expect(JSON.parse(row.config_json)).toEqual({
      config_overrides: ['model="gpt-5"'],
      local_provider: 'ollama'
    })

    connection.close()
    rmSync(tempDir, { recursive: true, force: true })
  })
})
