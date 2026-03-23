import { EventEmitter } from 'events'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  CliAdapter,
  CliSessionClosePayload,
  CliSessionHandle,
  CliStartOptions
} from '../../src/main/services/cli/types'

const tempRoots: string[] = []

class ImmediateCloseHandle extends EventEmitter implements CliSessionHandle {
  sessionId: string
  toolId: string
  status = 'stopped' as const
  msgStore = {
    getHistory: () => [],
    subscribe: () => () => undefined
  } as never
  lastClosePayload: CliSessionClosePayload
  lastErrorPayload = null

  constructor(sessionId: string, toolId: string) {
    super()
    this.sessionId = sessionId
    this.toolId = toolId
    this.lastClosePayload = {
      sessionId,
      code: 0
    }
  }

  stop(): void {}
}

class ImmediateCloseCodexAdapter implements CliAdapter {
  id = 'codex'

  async startSession(options: CliStartOptions): Promise<CliSessionHandle> {
    return new ImmediateCloseHandle(options.sessionId, options.toolId)
  }
}

const setupServices = async () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'deskly-cli-session-db-'))
  const dataDir = join(rootDir, 'data')
  const worktreesDir = join(rootDir, 'worktrees')
  mkdirSync(dataDir, { recursive: true })
  mkdirSync(worktreesDir, { recursive: true })
  tempRoots.push(rootDir)

  vi.resetModules()
  vi.doMock('../../src/main/app/AppPaths', () => ({
    getAppPaths: () => ({
      getDatabaseFile: () => join(dataDir, 'deskly.db'),
      getWorktreesDir: () => worktreesDir,
      getTaskDataDir: (taskId: string, projectId?: string | null) =>
        join(rootDir, 'sessions', projectId?.trim() || 'project', taskId),
      getTaskMessagesFile: (taskId: string, projectId?: string | null) =>
        join(rootDir, 'sessions', projectId?.trim() || 'project', `${taskId}.jsonl`),
      getTaskNodeMessagesFile: (
        taskId: string,
        taskNodeId: string,
        projectId?: string | null
      ) => join(rootDir, 'sessions', projectId?.trim() || 'project', taskId, `${taskNodeId}.jsonl`)
    })
  }))

  const [{ DatabaseService }, { TaskService }, { CliSessionService }] = await Promise.all([
    import('../../src/main/services/DatabaseService'),
    import('../../src/main/services/TaskService'),
    import('../../src/main/services/cli/CliSessionService')
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
  const cliSessionService = new CliSessionService(
    {
      getConfig: () => ({}),
      saveConfig: vi.fn()
    } as never,
    db,
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
  cliSessionService.registerAdapter(new ImmediateCloseCodexAdapter())

  return { db, taskService, cliSessionService }
}

describe('CliSessionService', () => {
  afterEach(() => {
    vi.resetModules()
    while (tempRoots.length > 0) {
      const root = tempRoots.pop()
      if (root) {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  it('completes a task node even when the session already exited before listeners attach', async () => {
    const setup = await setupServices()
    if (!setup) {
      return
    }
    const { db, taskService, cliSessionService } = setup

    try {
      const task = await taskService.createTask({
        title: 'Immediate exit task',
        prompt: 'Summarize the result',
        taskMode: 'conversation',
        cliToolId: 'codex'
      })

      const runningNode = db.startTaskExecution(task.id)
      expect(runningNode?.status).toBe('in_progress')

      await cliSessionService.startSession(
        'session-immediate-close',
        'codex',
        rootDirForTask(task),
        runningNode?.prompt,
        undefined,
        undefined,
        task.project_id,
        task.id,
        runningNode?.agent_tool_config_id ?? null,
        runningNode?.id
      )

      const updatedNode = db.getTaskNode(runningNode!.id)
      expect(updatedNode?.status).toBe('in_review')
      expect(updatedNode?.session_id).toBe('session-immediate-close')
      expect(cliSessionService.getSession('session-immediate-close')).toBeNull()
    } finally {
      db.close()
    }
  })
})

function rootDirForTask(task: { workspace_path?: string | null; worktree_path?: string | null }): string {
  return task.workspace_path ?? task.worktree_path ?? process.cwd()
}
