import { EventEmitter } from 'events'
import { CliAdapter, CliSessionHandle, CliSessionStatus, CliStartOptions } from './types'
import { ClaudeCodeAdapter } from './adapters/ClaudeCodeAdapter'
import { CursorAgentAdapter } from './adapters/CursorAgentAdapter'
import { GeminiCliAdapter } from './adapters/GeminiCliAdapter'
import { CodexCliAdapter } from './adapters/CodexCliAdapter'
import { OpencodeAdapter } from './adapters/OpencodeAdapter'
import { MsgStoreService } from '../MsgStoreService'
import { AgentCLIToolConfigService } from '../AgentCLIToolConfigService'
import { DatabaseService } from '../DatabaseService'
import { SettingsService } from '../SettingsService'
import { LogMsg } from '../../types/log'
import { normalizeCliToolConfig } from '../../../shared/agent-cli-config-spec'
import { isCliToolEnabled } from '../../../shared/agent-cli-tool-enablement'
import { newUlid } from '../../utils/ids'

interface SessionRecord {
  handle: CliSessionHandle
  toolId: string
  workdir: string
  startTime: Date
  taskId?: string
  taskNodeId?: string
  projectId?: string | null
}

interface CliOneShotRunOptions {
  toolId: string
  workdir: string
  prompt: string
  model?: string
  timeoutMs?: number
  toolConfig?: Record<string, unknown>
}

interface CliOneShotRunResult {
  sessionId: string
  toolId: string
  code: number | null
  status: CliSessionStatus
  stdout: string
  stderr: string
  logs: LogMsg[]
}

export class CliSessionService extends EventEmitter {
  private sessions: Map<string, SessionRecord> = new Map()
  private pendingMsgStores: Map<string, MsgStoreService> = new Map()
  private adapters: Map<string, CliAdapter> = new Map()
  private configService: AgentCLIToolConfigService
  private databaseService: DatabaseService
  private settingsService: SettingsService

  constructor(
    configService: AgentCLIToolConfigService,
    databaseService: DatabaseService,
    settingsService: SettingsService
  ) {
    super()
    this.configService = configService
    this.databaseService = databaseService
    this.settingsService = settingsService

    this.registerAdapter(new ClaudeCodeAdapter(configService))
    this.registerAdapter(new CursorAgentAdapter())
    this.registerAdapter(new GeminiCliAdapter())
    this.registerAdapter(new CodexCliAdapter())
    this.registerAdapter(new OpencodeAdapter())
  }

  init(): void {
    this.reconcileInProgressNodes()
  }

  registerAdapter(adapter: CliAdapter): void {
    this.adapters.set(adapter.id, adapter)
  }

  private sanitizeToolConfig(
    toolId: string,
    config: Record<string, unknown>
  ): Record<string, unknown> {
    return normalizeCliToolConfig(toolId, config)
  }

  private assertToolEnabled(toolId: string): void {
    if (!isCliToolEnabled(toolId, this.settingsService.getSettings().enabledCliTools)) {
      throw new Error('CLI tool is disabled in Settings -> Agent CLI')
    }
  }

  async startSession(
    sessionId: string,
    toolId: string,
    workdir: string,
    prompt?: string,
    env?: NodeJS.ProcessEnv,
    model?: string,
    projectId?: string | null,
    taskId?: string,
    configId?: string | null,
    taskNodeId?: string
  ): Promise<void> {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`)
    }

    this.assertToolEnabled(toolId)

    const adapter = this.adapters.get(toolId)
    if (!adapter) {
      throw new Error(`Unsupported CLI tool: ${toolId}`)
    }

    const explicitTaskNode = taskNodeId ? this.databaseService.getTaskNode(taskNodeId) : null
    let resolvedTaskId = taskId ?? explicitTaskNode?.task_id
    const taskNode =
      explicitTaskNode ??
      (resolvedTaskId ? this.databaseService.getCurrentTaskNode(resolvedTaskId) : null)
    if (!resolvedTaskId && taskNode) {
      resolvedTaskId = taskNode.task_id
    }
    const resolvedTaskNodeId = taskNode?.id

    const baseConfig = this.configService.getConfig(toolId)
    const normalizedBase: Record<string, unknown> = { ...baseConfig }
    if (typeof baseConfig.defaultModel === 'string' && !('model' in normalizedBase)) {
      normalizedBase.model = baseConfig.defaultModel
    }
    let resolvedConfigId = configId ?? null
    if (!resolvedConfigId && taskNode?.agent_tool_config_id) {
      resolvedConfigId = taskNode.agent_tool_config_id
    }
    if (!resolvedConfigId && resolvedTaskId) {
      const currentNode = this.databaseService.getCurrentTaskNode(resolvedTaskId)
      resolvedConfigId = currentNode?.agent_tool_config_id ?? null
    }

    let profileConfig: Record<string, unknown> = {}
    if (resolvedConfigId) {
      const record = this.databaseService.getAgentToolConfig(resolvedConfigId)
      if (record?.config_json) {
        try {
          const parsed = JSON.parse(record.config_json)
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            profileConfig = parsed as Record<string, unknown>
          }
        } catch (error) {
          console.error('[CliSessionService] Failed to parse agent tool config:', error)
        }
      }
    }

    const toolConfig = this.sanitizeToolConfig(toolId, {
      ...normalizedBase,
      ...profileConfig
    })

    if (toolId === 'cursor-agent') {
      const model = toolConfig.model
      if (typeof model !== 'string' || !model.trim()) {
        toolConfig.model = 'auto'
      }
      const configuredResume = typeof toolConfig.resume === 'string' ? toolConfig.resume.trim() : ''
      if (
        !configuredResume &&
        typeof taskNode?.resume_session_id === 'string' &&
        taskNode.resume_session_id.trim()
      ) {
        toolConfig.resume = taskNode.resume_session_id
      }
    }

    if (toolId === 'gemini-cli') {
      const configuredResume = typeof toolConfig.resume === 'string' ? toolConfig.resume.trim() : ''
      if (
        !configuredResume &&
        typeof taskNode?.resume_session_id === 'string' &&
        taskNode.resume_session_id.trim()
      ) {
        toolConfig.resume = taskNode.resume_session_id
      }
    }

    if (toolId === 'opencode') {
      const configuredSession =
        typeof toolConfig.session === 'string' ? toolConfig.session.trim() : ''
      if (
        !configuredSession &&
        typeof taskNode?.resume_session_id === 'string' &&
        taskNode.resume_session_id.trim()
      ) {
        toolConfig.session = taskNode.resume_session_id
      }
    }

    if (toolId === 'codex') {
      const configuredThreadId =
        typeof toolConfig.thread_id === 'string' ? toolConfig.thread_id.trim() : ''
      if (
        !configuredThreadId &&
        typeof taskNode?.resume_session_id === 'string' &&
        taskNode.resume_session_id.trim()
      ) {
        toolConfig.thread_id = taskNode.resume_session_id
      }
    }

    const resolveConfigString = (...values: unknown[]): string | undefined => {
      for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
          return value.trim()
        }
      }
      return undefined
    }

    const envFromConfig =
      toolConfig.env && typeof toolConfig.env === 'object' && !Array.isArray(toolConfig.env)
        ? (toolConfig.env as Record<string, string>)
        : undefined
    const mergedEnv = {
      ...process.env,
      ...(envFromConfig ?? {}),
      ...(env ?? {})
    }

    const executablePath = resolveConfigString(
      toolConfig.base_command_override,
      normalizedBase.executablePath
    )

    const appendPrompt = resolveConfigString(toolConfig.append_prompt)
    const resolvedPrompt =
      [prompt?.trim(), appendPrompt]
        .filter((entry): entry is string => Boolean(entry))
        .join('\n\n') || undefined

    const pendingMsgStore = this.pendingMsgStores.get(sessionId)
    const msgStore =
      pendingMsgStore ??
      new MsgStoreService(undefined, resolvedTaskId, sessionId, projectId, resolvedTaskNodeId)

    const handleResumeIdCaptured = (resumeId: string): void => {
      if (!resolvedTaskNodeId) return
      const normalized = resumeId.trim()
      if (!normalized) return
      const latestNode = this.databaseService.getTaskNode(resolvedTaskNodeId)
      if (latestNode?.resume_session_id === normalized) return
      this.databaseService.updateTaskNodeResumeSessionId(resolvedTaskNodeId, normalized)
    }

    const handle = await adapter.startSession({
      sessionId,
      toolId,
      workdir,
      taskId: resolvedTaskId,
      taskNodeId: resolvedTaskNodeId,
      projectId,
      prompt: resolvedPrompt,
      env: mergedEnv,
      executablePath,
      toolConfig,
      model,
      onResumeIdCaptured: handleResumeIdCaptured,
      msgStore
    } as CliStartOptions)

    this.sessions.set(sessionId, {
      handle,
      toolId,
      workdir,
      startTime: new Date(),
      taskId: resolvedTaskId,
      taskNodeId: resolvedTaskNodeId,
      projectId
    })

    if (resolvedTaskNodeId) {
      this.databaseService.updateTaskNodeSession(resolvedTaskNodeId, sessionId)
    }

    if (pendingMsgStore) {
      this.pendingMsgStores.delete(sessionId)
    }

    handle.on(
      'status',
      (data: { sessionId: string; status: CliSessionStatus; forced?: boolean }) => {
        this.emit('status', data)
      }
    )

    handle.on(
      'output',
      (data: { sessionId: string; type: 'stdout' | 'stderr'; content: string }) => {
        this.emit('output', data)
      }
    )

    handle.on(
      'close',
      (data: { sessionId: string; code: number | null; forcedStatus?: CliSessionStatus }) => {
        const sessionRecord = this.sessions.get(data.sessionId)
        const durationSeconds = sessionRecord
          ? (Date.now() - sessionRecord.startTime.getTime()) / 1000
          : undefined

        if (sessionRecord?.taskNodeId) {
          if (data.code === 0) {
            this.databaseService.completeTaskNode(sessionRecord.taskNodeId, {
              sessionId: data.sessionId,
              duration: durationSeconds
            })
          } else if (typeof data.code === 'number') {
            this.databaseService.markTaskNodeErrorReview(
              sessionRecord.taskNodeId,
              `CLI exited with code ${data.code}`
            )
          }
        }

        this.emit('close', {
          ...data,
          taskId: sessionRecord?.taskId,
          taskNodeId: sessionRecord?.taskNodeId
        })
        this.sessions.delete(data.sessionId)
      }
    )

    handle.on('error', (data: { sessionId: string; error: string }) => {
      const sessionRecord = this.sessions.get(data.sessionId)
      if (sessionRecord?.taskNodeId) {
        this.databaseService.markTaskNodeErrorReview(sessionRecord.taskNodeId, data.error)
      }
      this.emit('error', {
        ...data,
        taskId: sessionRecord?.taskId,
        taskNodeId: sessionRecord?.taskNodeId
      })
    })
  }

  stopSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    session.handle.stop()
  }

  sendInput(sessionId: string, input: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    if (!session.handle.sendInput) {
      throw new Error(`Session ${sessionId} does not support input`)
    }
    session.handle.sendInput(input)
  }

  getSession(sessionId: string): {
    id: string
    status: CliSessionStatus
    workdir: string
    toolId: string
    startTime: Date
    taskId?: string
    taskNodeId?: string
  } | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    return {
      id: sessionId,
      status: session.handle.status,
      workdir: session.workdir,
      toolId: session.toolId,
      startTime: session.startTime,
      taskId: session.taskId,
      taskNodeId: session.taskNodeId
    }
  }

  getAllSessions(): Array<{
    id: string
    status: CliSessionStatus
    workdir: string
    toolId: string
    startTime: Date
    taskId?: string
    taskNodeId?: string
  }> {
    return Array.from(this.sessions.entries()).map(([id, session]) => ({
      id,
      status: session.handle.status,
      workdir: session.workdir,
      toolId: session.toolId,
      startTime: session.startTime,
      taskId: session.taskId,
      taskNodeId: session.taskNodeId
    }))
  }

  getSessionMsgStore(sessionId: string): MsgStoreService | undefined {
    return this.sessions.get(sessionId)?.handle.msgStore ?? this.pendingMsgStores.get(sessionId)
  }

  subscribeToSession(sessionId: string, callback: (msg: LogMsg) => void): (() => void) | undefined {
    const msgStore = this.getSessionMsgStore(sessionId)
    if (!msgStore) return undefined
    return msgStore.subscribe(callback)
  }

  getSessionLogHistory(
    sessionId?: string | null,
    taskId?: string | null,
    taskNodeId?: string | null
  ): LogMsg[] {
    const msgStore = sessionId ? this.getSessionMsgStore(sessionId) : undefined
    if (msgStore) {
      return msgStore.getHistory()
    }

    if (!taskId) {
      return []
    }

    const task = this.databaseService.getTask(taskId)
    const resolvedTaskNodeId =
      taskNodeId ?? this.databaseService.getCurrentTaskNode(taskId)?.id ?? null

    return MsgStoreService.loadFromFile(taskId, resolvedTaskNodeId, task?.project_id)
  }

  getToolConfig(toolId: string): Record<string, unknown> {
    return this.configService.getConfig(toolId)
  }

  saveToolConfig(toolId: string, updates: Record<string, unknown>): void {
    const current = this.configService.getConfig(toolId)
    this.configService.saveConfig(toolId, { ...current, ...updates })
  }

  async runOneShotSession(options: CliOneShotRunOptions): Promise<CliOneShotRunResult> {
    this.assertToolEnabled(options.toolId)

    const adapter = this.adapters.get(options.toolId)
    if (!adapter) {
      throw new Error(`Unsupported CLI tool: ${options.toolId}`)
    }

    const sessionId = newUlid()
    const baseConfig = this.configService.getConfig(options.toolId)
    const normalizedBase: Record<string, unknown> = { ...baseConfig }
    if (typeof baseConfig.defaultModel === 'string' && !('model' in normalizedBase)) {
      normalizedBase.model = baseConfig.defaultModel
    }

    const toolConfig = this.sanitizeToolConfig(options.toolId, {
      ...normalizedBase,
      ...(options.toolConfig ?? {})
    })

    const msgStore = new MsgStoreService()
    const handle = await adapter.startSession({
      sessionId,
      toolId: options.toolId,
      workdir: options.workdir,
      prompt: options.prompt,
      toolConfig,
      model: options.model,
      msgStore,
      env: process.env
    } as CliStartOptions)

    return await new Promise<CliOneShotRunResult>((resolve, reject) => {
      const stdoutChunks: string[] = []
      const stderrChunks: string[] = []
      let settled = false

      const cleanup = () => {
        handle.off('output', onOutput)
        handle.off('close', onClose)
        handle.off('error', onError)
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }

      const finish = (runner: () => void) => {
        if (settled) return
        settled = true
        cleanup()
        runner()
      }

      const onOutput = (data: {
        sessionId: string
        type: 'stdout' | 'stderr'
        content: string
      }) => {
        if (data.sessionId !== sessionId) return
        if (data.type === 'stdout') {
          stdoutChunks.push(data.content)
        } else {
          stderrChunks.push(data.content)
        }
      }

      const onClose = (data: {
        sessionId: string
        code: number | null
        forcedStatus?: CliSessionStatus
      }) => {
        if (data.sessionId !== sessionId) return
        finish(() =>
          resolve({
            sessionId,
            toolId: options.toolId,
            code: data.code,
            status: data.forcedStatus ?? handle.status,
            stdout: stdoutChunks.join('\n'),
            stderr: stderrChunks.join('\n'),
            logs: msgStore.getHistory()
          })
        )
      }

      const onError = (data: { sessionId: string; error: string | Error }) => {
        if (data.sessionId !== sessionId) return
        finish(() =>
          reject(
            data.error instanceof Error
              ? data.error
              : new Error(typeof data.error === 'string' ? data.error : 'CLI session failed')
          )
        )
      }

      const timeoutMs = options.timeoutMs ?? 45000
      const timeoutId =
        timeoutMs > 0
          ? setTimeout(() => {
              try {
                handle.stop()
              } catch {
                // ignore stop errors on timeout
              }
              finish(() => reject(new Error(`CLI_ONE_SHOT_TIMEOUT:${options.toolId}:${timeoutMs}`)))
            }, timeoutMs)
          : null

      handle.on('output', onOutput)
      handle.on('close', onClose)
      handle.on('error', onError)
    })
  }

  getSessionOutput(
    sessionId: string,
    taskId?: string | null,
    taskNodeId?: string | null
  ): string[] {
    const history = this.getSessionLogHistory(sessionId, taskId, taskNodeId)
    return history
      .filter((msg) => msg.type === 'stdout')
      .map((msg) => (msg as { content: string }).content)
  }

  private reconcileInProgressNodes(): void {
    const inProgressNodes = this.databaseService.getInProgressTaskNodes()
    for (const node of inProgressNodes) {
      const hasRunningSession = node.session_id ? this.sessions.has(node.session_id) : false
      if (!hasRunningSession) {
        this.databaseService.markTaskNodeErrorReview(
          node.id,
          node.error_message || 'session_not_running_after_restart'
        )
      }
    }
  }

  dispose(): void {
    for (const [sessionId, session] of this.sessions.entries()) {
      try {
        session.handle.stop()
      } catch (error) {
        console.error('[CliSessionService] Failed to stop session:', sessionId, error)
      }
      this.sessions.delete(sessionId)
    }
    this.pendingMsgStores.clear()
  }
}
