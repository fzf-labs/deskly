import * as os from 'os'
import * as path from 'path'
import { CliAdapter, CliSessionHandle, CliStartOptions } from '../types'
import { ProcessCliSession, InitSequenceStep } from '../ProcessCliSession'
import { AgentCLIToolConfigService } from '../../AgentCLIToolConfigService'
import { failureSignal, parseJsonLine, successSignal } from './completion'
import {
  asBoolean,
  asString,
  asStringArray,
  pushFlag,
  pushFlagWithValue,
  pushRepeatableFlag
} from './config-utils'
import { ProcessCommandSpec } from '../ProcessCliSession'

function detectClaudeCompletion(line: string) {
  const msg = parseJsonLine(line)
  if (!msg) return null
  if (msg.type === 'error') return failureSignal('error')
  if (msg.type !== 'result') return null

  const subtype = msg.subtype as string | undefined
  const isError = msg.is_error as boolean | undefined
  if (subtype === 'success' || isError === false) return successSignal('result')
  if (subtype === 'error' || isError === true) return failureSignal('result')
  return successSignal('result')
}

export class ClaudeCodeAdapter implements CliAdapter {
  id = 'claude-code'
  private configService: AgentCLIToolConfigService

  constructor(configService: AgentCLIToolConfigService) {
    this.configService = configService
  }

  private getExecutablePath(override?: string, toolConfig?: Record<string, unknown>): string {
    if (override) return override

    const useRouter = asBoolean(
      toolConfig?.claude_code_router
    )
    if (useRouter) {
      return 'claude-code-router'
    }

    const config = this.configService.getConfig('claude-code')
    const cmd = config.executablePath || 'claude'
    if (cmd === 'claude') {
      return path.join(os.homedir(), '.local/bin/claude')
    }
    return cmd
  }

  async startSession(options: CliStartOptions): Promise<CliSessionHandle> {
    return new ProcessCliSession(
      options.sessionId,
      options.toolId,
      this.buildCommandSpec(options),
      detectClaudeCompletion,
      undefined,
      options.taskId,
      options.projectId,
      options.taskNodeId,
      options.msgStore
    )
  }

  buildCommandSpec(options: CliStartOptions): ProcessCommandSpec {
    const config = this.configService.getConfig('claude-code')
    const toolConfig = options.toolConfig ?? {}
    const model =
      options.model ||
      asString((toolConfig as Record<string, unknown>).model) ||
      config.defaultModel
    const homeDir = os.homedir()

    const args = [
      '-p',
      '--verbose',
      '--output-format=stream-json',
      '--input-format=stream-json',
      '--session-id', options.sessionId
    ]

    const allowDangerouslySkipPermissions = asBoolean(
      (toolConfig as Record<string, unknown>).allow_dangerously_skip_permissions
    )
    if (allowDangerouslySkipPermissions) {
      args.push('--allow-dangerously-skip-permissions')
    }

    const skipPermissions = asBoolean(
      (toolConfig as Record<string, unknown>).dangerously_skip_permissions
    )
    if (skipPermissions === undefined || skipPermissions === true) {
      args.push('--dangerously-skip-permissions')
    }

    if (model) {
      args.push('--model', model)
    }

    pushFlagWithValue(args, '--agent', (toolConfig as Record<string, unknown>).agent)
    pushFlagWithValue(args, '--agents', (toolConfig as Record<string, unknown>).agents)
    pushRepeatableFlag(args, '--add-dir', (toolConfig as Record<string, unknown>).add_dir)

    const allowedTools = asStringArray((toolConfig as Record<string, unknown>).allowed_tools)
    if (allowedTools) {
      args.push('--allowed-tools', allowedTools.join(','))
    }
    const disallowedTools = asStringArray((toolConfig as Record<string, unknown>).disallowed_tools)
    if (disallowedTools) {
      args.push('--disallowed-tools', disallowedTools.join(','))
    }

    pushFlagWithValue(args, '--append-system-prompt', (toolConfig as Record<string, unknown>).append_system_prompt)
    pushFlagWithValue(args, '--system-prompt', (toolConfig as Record<string, unknown>).system_prompt)
    pushFlagWithValue(args, '--permission-mode', (toolConfig as Record<string, unknown>).permission_mode)
    pushRepeatableFlag(args, '--mcp-config', (toolConfig as Record<string, unknown>).mcp_config)
    pushFlag(args, '--strict-mcp-config', asBoolean((toolConfig as Record<string, unknown>).strict_mcp_config))
    pushFlagWithValue(args, '--settings', (toolConfig as Record<string, unknown>).settings)
    pushFlagWithValue(args, '--setting-sources', (toolConfig as Record<string, unknown>).setting_sources)
    pushFlag(args, '--continue', asBoolean((toolConfig as Record<string, unknown>).continue))
    pushFlagWithValue(args, '--resume', (toolConfig as Record<string, unknown>).resume)
    pushFlagWithValue(args, '--output-format', (toolConfig as Record<string, unknown>).output_format)
    pushFlagWithValue(args, '--input-format', (toolConfig as Record<string, unknown>).input_format)
    pushFlag(args, '--include-partial-messages', asBoolean((toolConfig as Record<string, unknown>).include_partial_messages))
    pushFlag(args, '--replay-user-messages', asBoolean((toolConfig as Record<string, unknown>).replay_user_messages))
    pushFlag(args, '--no-session-persistence', asBoolean((toolConfig as Record<string, unknown>).no_session_persistence))
    const debugValue = (toolConfig as Record<string, unknown>).debug
    if (typeof debugValue === 'string' && debugValue.trim()) {
      args.push('--debug', debugValue.trim())
    } else {
      pushFlag(args, '--debug', asBoolean(debugValue))
    }
    pushFlagWithValue(args, '--debug-file', (toolConfig as Record<string, unknown>).debug_file)
    pushFlag(args, '--verbose', asBoolean((toolConfig as Record<string, unknown>).verbose))
    pushRepeatableFlag(args, '--betas', (toolConfig as Record<string, unknown>).betas)
    pushFlagWithValue(args, '--fallback-model', (toolConfig as Record<string, unknown>).fallback_model)
    pushFlagWithValue(args, '--max-budget-usd', (toolConfig as Record<string, unknown>).max_budget_usd)
    pushFlagWithValue(args, '--json-schema', (toolConfig as Record<string, unknown>).json_schema)
    pushFlagWithValue(args, '--tools', (toolConfig as Record<string, unknown>).tools)
    pushRepeatableFlag(args, '--file', (toolConfig as Record<string, unknown>).file_resources)
    pushFlag(args, '--chrome', asBoolean((toolConfig as Record<string, unknown>).chrome))
    pushFlag(args, '--no-chrome', asBoolean((toolConfig as Record<string, unknown>).no_chrome))
    pushFlag(args, '--ide', asBoolean((toolConfig as Record<string, unknown>).ide))
    pushRepeatableFlag(args, '--plugin-dir', (toolConfig as Record<string, unknown>).plugin_dir)

    const additionalArgs = asStringArray((toolConfig as Record<string, unknown>).additional_params)
    if (additionalArgs) {
      args.push(...additionalArgs)
    }

    const initSequence: InitSequenceStep[] = [
      {
        message: JSON.stringify({
          type: 'control_request',
          request_id: `init-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          request: { subtype: 'initialize' }
        })
      }
    ]

    if (options.prompt) {
      initSequence.push({
        delay: 100,
        message: JSON.stringify({
          type: 'user',
          message: { role: 'user', content: options.prompt }
        })
      })
    }

    return {
      command: this.getExecutablePath(options.executablePath, toolConfig as Record<string, unknown>),
      args,
      cwd: options.workdir,
      env: {
        ...process.env,
        ...(options.env ?? {}),
        PATH: `${homeDir}/.local/bin:/opt/homebrew/bin:${process.env.PATH || ''}`
      },
      initSequence
    }
  }
}
