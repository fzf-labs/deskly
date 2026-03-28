import { EventEmitter } from 'events'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  CliAdapter,
  CliSessionClosePayload,
  CliSessionHandle,
  CliStartOptions,
  CliUserInputLogMode
} from '../../src/main/services/cli/types'
import type { MsgStoreService } from '../../src/main/services/MsgStoreService'

const tempRoots: string[] = []

class ImmediateCloseHandle extends EventEmitter implements CliSessionHandle {
  sessionId: string
  toolId: string
  status = 'stopped' as const
  msgStore: MsgStoreService
  lastClosePayload: CliSessionClosePayload
  lastErrorPayload = null

  constructor(sessionId: string, toolId: string, msgStore: MsgStoreService) {
    super()
    this.sessionId = sessionId
    this.toolId = toolId
    this.msgStore = msgStore
    this.lastClosePayload = {
      sessionId,
      code: 0
    }
  }

  stop(): void {}
}

class ImmediateCloseCodexAdapter implements CliAdapter {
  id = 'codex'
  userInputLogMode = 'inject-normalized' as const

  async startSession(options: CliStartOptions): Promise<CliSessionHandle> {
    return new ImmediateCloseHandle(
      options.sessionId,
      options.toolId,
      options.msgStore as MsgStoreService
    )
  }
}

class InteractiveHandle extends EventEmitter implements CliSessionHandle {
  sessionId: string
  toolId: string
  status = 'running' as const
  msgStore: MsgStoreService
  lastClosePayload = null
  lastErrorPayload = null
  inputs: string[] = []

  constructor(sessionId: string, toolId: string, msgStore: MsgStoreService) {
    super()
    this.sessionId = sessionId
    this.toolId = toolId
    this.msgStore = msgStore
  }

  stop(): void {}

  sendInput(input: string): void {
    this.inputs.push(input)
  }
}

class RecordingAdapter implements CliAdapter {
  id = 'codex'
  userInputLogMode?: CliUserInputLogMode
  startCalls: CliStartOptions[] = []
  handles: InteractiveHandle[] = []

  constructor(userInputLogMode: CliUserInputLogMode = 'inject-normalized') {
    this.userInputLogMode = userInputLogMode
  }

  async startSession(options: CliStartOptions): Promise<CliSessionHandle> {
    this.startCalls.push(options)
    const handle = new InteractiveHandle(
      options.sessionId,
      options.toolId,
      options.msgStore as MsgStoreService
    )
    this.handles.push(handle)
    return handle
  }
}

const setupServices = async (options?: {
  adapter?: CliAdapter
  config?: Record<string, unknown>
}) => {
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
      getTaskNodeMessagesFile: (taskId: string, taskNodeId: string, projectId?: string | null) =>
        join(rootDir, 'sessions', projectId?.trim() || 'project', taskId, `${taskNodeId}.jsonl`)
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
      getConfig: () => options?.config ?? {},
      saveConfig: vi.fn()
    } as never,
    db.getAgentToolProfileService(),
    db,
    db.getTaskNodeRuntimeService(),
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
  cliSessionService.registerAdapter(options?.adapter ?? new ImmediateCloseCodexAdapter())

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
      cliSessionService.dispose()
      db.close()
    }
  })

  it('injects synthetic user logs for codex start and followup input without leaking appended prompt', async () => {
    const adapter = new RecordingAdapter('inject-normalized')
    const setup = await setupServices({
      adapter,
      config: {
        append_prompt: 'SYSTEM APPENDED'
      }
    })
    if (!setup) {
      return
    }
    const { db, taskService, cliSessionService } = setup

    try {
      const task = await taskService.createTask({
        title: 'Synthetic user log task',
        prompt: 'Summarize the result',
        taskMode: 'conversation',
        cliToolId: 'codex'
      })

      const runningNode = db.startTaskExecution(task.id)
      expect(runningNode?.status).toBe('in_progress')

      await cliSessionService.startSession(
        'session-synthetic-user-log',
        'codex',
        rootDirForTask(task),
        'Original user prompt',
        undefined,
        undefined,
        task.project_id,
        task.id,
        runningNode?.agent_tool_config_id ?? null,
        runningNode?.id
      )

      expect(adapter.startCalls[0]?.prompt).toBe('Original user prompt\n\nSYSTEM APPENDED')

      const historyAfterStart = cliSessionService.getSessionLogHistory(
        'session-synthetic-user-log',
        task.id,
        runningNode?.id ?? null
      )
      const normalizedStartLogs = historyAfterStart.filter((msg) => msg.type === 'normalized')
      expect(normalizedStartLogs).toHaveLength(1)
      expect(normalizedStartLogs[0]?.entry.type).toBe('user_message')
      expect(normalizedStartLogs[0]?.entry.content).toBe('Original user prompt')
      expect(normalizedStartLogs[0]?.entry.metadata?.syntheticSource).toBe('deskly_user_input')
      expect(normalizedStartLogs[0]?.entry.metadata?.userInputPhase).toBe('start')

      cliSessionService.sendInput('session-synthetic-user-log', 'Follow-up question')
      cliSessionService.sendInput('session-synthetic-user-log', '   ')

      const historyAfterFollowup = cliSessionService.getSessionLogHistory(
        'session-synthetic-user-log',
        task.id,
        runningNode?.id ?? null
      )
      const normalizedUserLogs = historyAfterFollowup.filter(
        (msg) => msg.type === 'normalized' && msg.entry.type === 'user_message'
      )
      expect(normalizedUserLogs).toHaveLength(2)
      expect(normalizedUserLogs[1]?.entry.content).toBe('Follow-up question')
      expect(normalizedUserLogs[1]?.entry.metadata?.userInputPhase).toBe('followup')
      expect(adapter.handles[0]?.inputs).toEqual(['Follow-up question', '   '])
    } finally {
      cliSessionService.dispose()
      db.close()
    }
  })

  it('does not inject synthetic user logs for native adapters', async () => {
    const adapter = new RecordingAdapter('native')
    const setup = await setupServices({ adapter })
    if (!setup) {
      return
    }
    const { db, taskService, cliSessionService } = setup

    try {
      const task = await taskService.createTask({
        title: 'Native user log task',
        prompt: 'Summarize the result',
        taskMode: 'conversation',
        cliToolId: 'codex'
      })

      const runningNode = db.startTaskExecution(task.id)
      expect(runningNode?.status).toBe('in_progress')

      await cliSessionService.startSession(
        'session-native-user-log',
        'codex',
        rootDirForTask(task),
        'Original user prompt',
        undefined,
        undefined,
        task.project_id,
        task.id,
        runningNode?.agent_tool_config_id ?? null,
        runningNode?.id
      )

      cliSessionService.sendInput('session-native-user-log', 'Follow-up question')

      const history = cliSessionService.getSessionLogHistory(
        'session-native-user-log',
        task.id,
        runningNode?.id ?? null
      )
      const normalizedUserLogs = history.filter(
        (msg) => msg.type === 'normalized' && msg.entry.type === 'user_message'
      )
      expect(normalizedUserLogs).toHaveLength(0)
      expect(adapter.handles[0]?.inputs).toEqual(['Follow-up question'])
    } finally {
      cliSessionService.dispose()
      db.close()
    }
  })
})

function rootDirForTask(task: {
  workspace_path?: string | null
  worktree_path?: string | null
}): string {
  return task.workspace_path ?? task.worktree_path ?? process.cwd()
}
