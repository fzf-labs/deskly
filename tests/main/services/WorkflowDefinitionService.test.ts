import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { afterEach, describe, expect, it } from 'vitest'

import { WorkflowDefinitionService } from '../../../src/main/services/WorkflowDefinitionService'
import { DatabaseConnection } from '../../../src/main/services/database/DatabaseConnection'
import { WorkflowDefinitionRepository } from '../../../src/main/services/database/WorkflowDefinitionRepository'

const tempDirs: string[] = []

const buildDefinition = () => ({
  version: 1 as const,
  nodes: [
    {
      id: 'node-1',
      key: 'analyze',
      type: 'agent' as const,
      name: 'Analyze',
      prompt: 'Inspect the task',
      cliToolId: null,
      agentToolConfigId: null,
      requiresApprovalAfterRun: false,
      position: { x: 0, y: 0 }
    }
  ],
  edges: []
})

const setupService = () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'deskly-workflow-definition-'))
  tempDirs.push(tempDir)

  const connection = new DatabaseConnection(join(tempDir, 'test.db'))
  let db
  try {
    db = connection.open()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('NODE_MODULE_VERSION')) {
      rmSync(tempDir, { recursive: true, force: true })
      return null
    }
    throw error
  }

  connection.initTables()

  return {
    connection,
    service: new WorkflowDefinitionService(new WorkflowDefinitionRepository(db))
  }
}

describe('WorkflowDefinitionService', () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop()
      if (tempDir) {
        rmSync(tempDir, { recursive: true, force: true })
      }
    }
  })

  it('throws a stable conflict error when creating a duplicate project workflow name', () => {
    const setup = setupService()
    if (!setup) {
      return
    }

    const { connection, service } = setup

    try {
      service.createDefinition({
        scope: 'project',
        project_id: 'project-1',
        name: 'Feature delivery',
        description: null,
        definition: buildDefinition()
      })

      expect(() =>
        service.createDefinition({
          scope: 'project',
          project_id: 'project-1',
          name: 'Feature delivery',
          description: null,
          definition: buildDefinition()
        })
      ).toThrow('WORKFLOW_DEFINITION_NAME_CONFLICT')
    } finally {
      connection.close()
    }
  })

  it('throws a stable conflict error when renaming to an existing workflow name', () => {
    const setup = setupService()
    if (!setup) {
      return
    }

    const { connection, service } = setup

    try {
      const left = service.createDefinition({
        scope: 'project',
        project_id: 'project-1',
        name: 'Analyze',
        description: null,
        definition: buildDefinition()
      })

      service.createDefinition({
        scope: 'project',
        project_id: 'project-1',
        name: 'Ship',
        description: null,
        definition: buildDefinition()
      })

      expect(() =>
        service.updateDefinition({
          id: left.id,
          scope: 'project',
          project_id: 'project-1',
          name: 'Ship',
          description: null,
          definition: buildDefinition()
        })
      ).toThrow('WORKFLOW_DEFINITION_NAME_CONFLICT')
    } finally {
      connection.close()
    }
  })

  it('filters legacy invalid definitions from reads', () => {
    const setup = setupService()
    if (!setup) {
      return
    }

    const { connection, service } = setup

    try {
      const valid = service.createDefinition({
        scope: 'project',
        project_id: 'project-1',
        name: 'Valid workflow',
        description: null,
        definition: buildDefinition()
      })

      const db = (connection as unknown as { open: () => unknown }).open()
      ;(db as { prepare: (sql: string) => { run: (...args: unknown[]) => unknown } })
        .prepare(
          `
            INSERT INTO workflow_definitions (
              id, scope, project_id, name, description, definition_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          'legacy-invalid',
          'project',
          'project-1',
          'Legacy invalid',
          null,
          JSON.stringify({
            version: 1,
            nodes: [
              {
                id: 'legacy-command',
                key: 'legacy-command',
                type: 'command',
                name: 'Command',
                prompt: 'legacy',
                requiresApprovalAfterRun: false,
                position: null
              }
            ],
            edges: []
          }),
          '2026-03-24T00:00:00.000Z',
          '2026-03-24T00:00:00.000Z'
        )

      const listed = service.listDefinitions({ scope: 'project', projectId: 'project-1' })

      expect(listed.map((definition) => definition.id)).toEqual([valid.id])
      expect(service.getDefinition('legacy-invalid')).toBeNull()
    } finally {
      connection.close()
    }
  })
})
