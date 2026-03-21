import { CliAdapter, CliSessionHandle, CliStartOptions } from '../types'
import { ProcessCliAdapter } from './ProcessCliAdapter'
import { parseJsonLine, successSignal } from './completion'
import { asBoolean, asString, asStringArray, pushFlag, pushFlagWithValue, pushRepeatableFlag } from './config-utils'
import { ProcessCommandSpec } from '../ProcessCliSession'

type RecordLike = Record<string, unknown>

function detectCodexCompletion(line: string) {
  const msg = parseJsonLine(line)
  if (!msg) return null

  const event = (msg.event || msg.method || msg.type) as string | undefined
  if (event) {
    const lowered = event.toLowerCase()
    if (lowered.includes('finished')) return successSignal(event)
  }

  return null
}

export class CodexCliAdapter implements CliAdapter {
  id = 'codex'
  private adapter: ProcessCliAdapter
  private threadIds = new Map<string, string>()
  private stdoutBuffers = new Map<string, string>()

  private log(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.info('[CodexCliAdapter]', message, meta)
    } else {
      console.info('[CodexCliAdapter]', message)
    }
  }

  constructor() {
    this.adapter = new ProcessCliAdapter(
      {
        id: this.id,
        buildCommand: (options: CliStartOptions) => this.buildCommandSpec(options),
        detectCompletion: detectCodexCompletion
      }
    )
  }

  async startSession(options: CliStartOptions): Promise<CliSessionHandle> {
    this.log('startSession', {
      sessionId: options.sessionId,
      workdir: options.workdir,
      model: options.model ?? null,
      toolConfig: options.toolConfig ?? null
    })
    const handle = await this.adapter.startSession(options)
    this.attachThreadTracking(handle, options.sessionId)
    return handle
  }

  buildCommandSpec(options: CliStartOptions): ProcessCommandSpec {
    const command = options.executablePath || 'codex'
    const toolConfig = options.toolConfig ?? {}
    const model = options.model || asString((toolConfig as Record<string, unknown>).model)
    const prompt = options.prompt
    const resumeThreadId = this.getResumeThreadId(options)
    const hasPrompt = typeof prompt === 'string' && prompt.trim().length > 0
    const args: string[] = []

    pushRepeatableFlag(args, '-c', (toolConfig as Record<string, unknown>).config_overrides)
    pushRepeatableFlag(args, '--enable', (toolConfig as Record<string, unknown>).enable_features)
    pushRepeatableFlag(args, '--disable', (toolConfig as Record<string, unknown>).disable_features)
    pushRepeatableFlag(args, '-i', (toolConfig as Record<string, unknown>).image_paths)
    pushFlagWithValue(args, '--profile', (toolConfig as Record<string, unknown>).profile)
    pushFlagWithValue(args, '--sandbox', (toolConfig as Record<string, unknown>).sandbox)
    pushFlagWithValue(args, '--ask-for-approval', (toolConfig as Record<string, unknown>).ask_for_approval)
    pushFlag(args, '--full-auto', asBoolean((toolConfig as Record<string, unknown>).full_auto))
    pushFlag(args, '--dangerously-bypass-approvals-and-sandbox', asBoolean((toolConfig as Record<string, unknown>).dangerously_bypass_approvals_and_sandbox))
    pushFlag(args, '--oss', asBoolean((toolConfig as Record<string, unknown>).oss))
    pushFlagWithValue(args, '--local-provider', (toolConfig as Record<string, unknown>).local_provider)
    pushFlag(args, '--search', asBoolean((toolConfig as Record<string, unknown>).search))
    pushRepeatableFlag(args, '--add-dir', (toolConfig as Record<string, unknown>).add_dir)
    pushFlagWithValue(args, '--cd', (toolConfig as Record<string, unknown>).cd)
    pushFlag(args, '--no-alt-screen', asBoolean((toolConfig as Record<string, unknown>).no_alt_screen))

    const additionalArgs = asStringArray((toolConfig as Record<string, unknown>).additional_params)
    if (additionalArgs) {
      args.push(...additionalArgs)
    }

    args.push('exec')
    if (resumeThreadId) {
      args.push('resume')
    }
    pushFlag(args, '--skip-git-repo-check', asBoolean((toolConfig as Record<string, unknown>).skip_git_repo_check))
    pushFlag(args, '--ephemeral', asBoolean((toolConfig as Record<string, unknown>).ephemeral))
    pushFlagWithValue(args, '--output-schema', (toolConfig as Record<string, unknown>).output_schema)
    pushFlagWithValue(args, '--color', (toolConfig as Record<string, unknown>).color)
    pushFlag(args, '--progress-cursor', asBoolean((toolConfig as Record<string, unknown>).progress_cursor))
    args.push('--json')
    pushFlagWithValue(args, '--output-last-message', (toolConfig as Record<string, unknown>).output_last_message)
    if (model) {
      args.push('-m', model)
    }
    if (resumeThreadId) {
      args.push(resumeThreadId)
    }
    if (hasPrompt) {
      args.push('-')
    }

    this.log('buildCommand', {
      sessionId: options.sessionId,
      workdir: options.workdir,
      resumeThreadId: resumeThreadId ?? null,
      model: model ?? null,
      hasPrompt,
      promptLength: typeof prompt === 'string' ? prompt.length : 0,
      command,
      args
    })

    return {
      command,
      args,
      cwd: options.workdir,
      env: options.env,
      initialInput: prompt,
      closeStdinAfterInput: true
    }
  }

  private getResumeThreadId(options: CliStartOptions): string | undefined {
    const config = options.toolConfig as RecordLike | undefined
    const configured =
      this.getString(config?.thread_id) ||
      this.getString(config?.threadId) ||
      this.getString(config?.sessionId) ||
      this.getString(config?.resumeSessionId)
    return configured || this.threadIds.get(options.sessionId)
  }

  private attachThreadTracking(handle: CliSessionHandle, sessionId: string): void {
    let buffer = this.stdoutBuffers.get(sessionId) ?? ''

    const onOutput = (data: { sessionId: string; type: 'stdout' | 'stderr'; content: string }) => {
      if (data.sessionId !== sessionId) return
      if (data.type === 'stderr') {
        this.log('stderr', {
          sessionId,
          bytes: data.content.length,
          preview: data.content.slice(0, 200)
        })
        return
      }
      buffer += data.content
      this.log('stdout', {
        sessionId,
        bytes: data.content.length
      })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue
        const msg = parseJsonLine(line)
        if (!msg || typeof msg !== 'object') continue
        const threadId = this.extractThreadId(msg as RecordLike)
        if (threadId) {
          this.threadIds.set(sessionId, threadId)
          this.log('threadIdCaptured', { sessionId, threadId })
        }
      }
      this.stdoutBuffers.set(sessionId, buffer)
    }

    const cleanup = () => {
      this.stdoutBuffers.delete(sessionId)
      handle.off('output', onOutput)
      handle.off('close', onClose)
      handle.off('error', onError)
    }

    const onClose = () => cleanup()
    const onError = () => cleanup()

    handle.on('status', (data: { sessionId: string; status: string; forced?: boolean }) => {
      if (data.sessionId !== sessionId) return
      this.log('status', data as unknown as Record<string, unknown>)
    })

    handle.on('close', (data: { sessionId: string; code: number | null }) => {
      if (data.sessionId !== sessionId) return
      this.log('close', data as unknown as Record<string, unknown>)
    })

    handle.on('error', (data: { sessionId: string; error: string }) => {
      if (data.sessionId !== sessionId) return
      console.error('[CodexCliAdapter] error', data)
    })

    handle.on('output', onOutput)
    handle.on('close', onClose)
    handle.on('error', onError)
  }

  private extractThreadId(msg: RecordLike): string | undefined {
    const direct = this.getString(msg.threadId) || this.getString(msg.thread_id)
    if (direct) return direct

    const params = this.asRecord(msg.params)
    if (params) {
      const fromParams = this.getThreadIdFromRecord(params)
      if (fromParams) return fromParams
    }

    const result = this.asRecord(msg.result)
    if (result) {
      const fromResult = this.getThreadIdFromRecord(result)
      if (fromResult) return fromResult
    }

    return undefined
  }

  private getThreadIdFromRecord(record: RecordLike): string | undefined {
    const direct = this.getString(record.threadId) || this.getString(record.thread_id)
    if (direct) return direct
    const thread = this.asRecord(record.thread)
    const nested = thread ? this.getString(thread.id) : undefined
    return nested
  }

  private getString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined
  }

  private asRecord(value: unknown): RecordLike | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as RecordLike)
      : null
  }
}
