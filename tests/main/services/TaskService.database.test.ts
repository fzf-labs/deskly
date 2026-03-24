import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const tempRoots: string[] = []

const setupTaskServiceWithRealDatabase = async () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'deskly-task-service-db-'))
  const dataDir = join(rootDir, 'data')
  const worktreesDir = join(rootDir, 'worktrees')
  mkdirSync(dataDir, { recursive: true })
  mkdirSync(worktreesDir, { recursive: true })
  tempRoots.push(rootDir)

  vi.resetModules()
  vi.doMock('../../../src/main/app/AppPaths', () => ({
    getAppPaths: () => ({
      getDatabaseFile: () => join(dataDir, 'deskly.db'),
      getWorktreesDir: () => worktreesDir,
      getTaskDataDir: (taskId: string, projectId?: string | null) =>
        join(rootDir, 'sessions', projectId?.trim() || 'project', taskId),
      getTaskMessagesFile: (taskId: string, projectId?: string | null) =>
        join(rootDir, 'sessions', projectId?.trim() || 'project', `${taskId}.jsonl`)
    })
  }))

  const [{ DatabaseService }, { TaskService }] = await Promise.all([
    import('../../../src/main/services/DatabaseService'),
    import('../../../src/main/services/TaskService')
  ])

  let db
  try {
    db = new DatabaseService()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('NODE_MODULE_VERSION')) {
      rmSync(rootDir, { recursive: true, force: true })
      return null
    }
    throw error
  }
  const taskService = new TaskService(
    db,
    { addWorktree: vi.fn() } as never,
    {
      getSettings: () => ({
        enabledCliTools: {
          'claude-code': true,
          codex: true,
          'cursor-agent': true,
          'gemini-cli': true,
          opencode: true
        }
      })
    } as never
  )

  return { db, taskService }
}

describe('TaskService + DatabaseService conversation runtime', () => {
  afterEach(() => {
    vi.resetModules()
    while (tempRoots.length > 0) {
      const root = tempRoots.pop()
      if (root) {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  it('creates exactly one workflow run for a conversation task', async () => {
    const setup = await setupTaskServiceWithRealDatabase()
    if (!setup) {
      return
    }
    const { db, taskService } = setup

    try {
      const task = await taskService.createTask({
        title: 'Conversation task',
        prompt: 'Solve the issue',
        taskMode: 'conversation',
        cliToolId: 'codex'
      })

      const run = db.getWorkflowRunByTask(task.id)
      expect(run).not.toBeNull()
      expect(run?.workflow_definition_id).toBeNull()

      const nodes = db.getTaskNodes(task.id)
      expect(nodes).toHaveLength(1)
      expect(nodes[0]).toEqual(
        expect.objectContaining({
          task_id: task.id,
          cli_tool_id: 'codex',
          status: 'todo'
        })
      )
    } finally {
      db.close()
    }
  })

  it('writes workflow node cli_tool_id when a workflow task inherits the task default CLI', async () => {
    const setup = await setupTaskServiceWithRealDatabase()
    if (!setup) {
      return
    }
    const { db, taskService } = setup

    try {
      const definition = db.createWorkflowDefinition({
        scope: 'project',
        project_id: 'project-1',
        name: 'Workflow runtime defaults',
        definition: {
          version: 1,
          nodes: [
            {
              id: 'node-1',
              key: 'analyze',
              type: 'agent',
              name: 'Analyze',
              prompt: 'Inspect the task',
              cliToolId: null,
              agentToolConfigId: null,
              requiresApprovalAfterRun: false,
              position: { x: 0, y: 0 }
            }
          ],
          edges: []
        }
      })

      const task = await taskService.createTask({
        title: 'Workflow task',
        prompt: 'Solve the issue',
        taskMode: 'workflow',
        projectId: 'project-1',
        workflowDefinitionId: definition.id,
        cliToolId: 'codex'
      })

      const nodes = db.getTaskNodes(task.id)
      expect(nodes).toHaveLength(1)
      expect(nodes[0]).toEqual(
        expect.objectContaining({
          task_id: task.id,
          cli_tool_id: 'codex',
          status: 'todo'
        })
      )
    } finally {
      db.close()
    }
  })
})
