export type CliConfigFieldType =
  | 'string'
  | 'stringArray'
  | 'stringMap'
  | 'boolean'
  | 'booleanNullable'

export interface CliConfigFieldOption {
  value: string
  label: string
  labels?: Partial<Record<'en-US' | 'zh-CN', string>>
}

export interface CliConfigFieldSpec {
  type: CliConfigFieldType
  required?: boolean
  defaultValue?: unknown
  multiline?: boolean
  options?: CliConfigFieldOption[]
  label?: string
  labels?: Partial<Record<'en-US' | 'zh-CN', string>>
  description?: string
  descriptions?: Partial<Record<'en-US' | 'zh-CN', string>>
  advanced?: boolean
  desklyManaged?: boolean
  uiHidden?: boolean
}

export interface CliToolConfigSpec {
  fields: Record<string, CliConfigFieldSpec>
  aliases?: Record<string, string>
}

const CODEX_SANDBOX_OPTIONS: CliConfigFieldOption[] = [
  {
    value: 'read-only',
    label: 'Read Only',
    labels: { 'en-US': 'Read Only', 'zh-CN': '只读' }
  },
  {
    value: 'workspace-write',
    label: 'Workspace Write',
    labels: { 'en-US': 'Workspace Write', 'zh-CN': '工作区可写' }
  },
  {
    value: 'danger-full-access',
    label: 'Danger Full Access',
    labels: { 'en-US': 'Danger Full Access', 'zh-CN': '完全访问' }
  }
]

const CODEX_APPROVAL_OPTIONS: CliConfigFieldOption[] = [
  {
    value: 'untrusted',
    label: 'Untrusted',
    labels: { 'en-US': 'Untrusted', 'zh-CN': '不受信任时询问' }
  },
  {
    value: 'on-failure',
    label: 'On Failure',
    labels: { 'en-US': 'On Failure', 'zh-CN': '失败时询问' }
  },
  {
    value: 'on-request',
    label: 'On Request',
    labels: { 'en-US': 'On Request', 'zh-CN': '按需询问' }
  },
  {
    value: 'never',
    label: 'Never',
    labels: { 'en-US': 'Never', 'zh-CN': '从不询问' }
  }
]

const CODEX_REASONING_EFFORT_OPTIONS: CliConfigFieldOption[] = [
  {
    value: 'low',
    label: 'Low',
    labels: { 'en-US': 'Low', 'zh-CN': '低' }
  },
  {
    value: 'medium',
    label: 'Medium',
    labels: { 'en-US': 'Medium', 'zh-CN': '中' }
  },
  {
    value: 'high',
    label: 'High',
    labels: { 'en-US': 'High', 'zh-CN': '高' }
  },
  {
    value: 'xhigh',
    label: 'XHigh',
    labels: { 'en-US': 'XHigh', 'zh-CN': '超高' }
  }
]

const CODEX_PERMISSION_PRESET_OPTIONS: CliConfigFieldOption[] = [
  {
    value: 'default',
    label: 'Default',
    labels: { 'en-US': 'Default', 'zh-CN': '默认' }
  },
  {
    value: 'full-access',
    label: 'Full Access',
    labels: { 'en-US': 'Full Access', 'zh-CN': '完全访问' }
  },
  {
    value: 'custom',
    label: 'Custom',
    labels: { 'en-US': 'Custom', 'zh-CN': '自定义' }
  }
]

const CLAUDE_PERMISSION_MODE_OPTIONS: CliConfigFieldOption[] = [
  { value: 'default', label: 'Default' },
  { value: 'auto', label: 'Auto' },
  { value: 'plan', label: 'Plan' },
  { value: 'acceptEdits', label: 'Accept Edits' },
  { value: 'bypassPermissions', label: 'Bypass Permissions' },
  { value: 'dontAsk', label: "Don't Ask" }
]

const CLAUDE_OUTPUT_FORMAT_OPTIONS: CliConfigFieldOption[] = [
  { value: 'text', label: 'Text' },
  { value: 'json', label: 'JSON' },
  { value: 'stream-json', label: 'Stream JSON' }
]

const CLAUDE_INPUT_FORMAT_OPTIONS: CliConfigFieldOption[] = [
  { value: 'text', label: 'Text' },
  { value: 'stream-json', label: 'Stream JSON' }
]

const CURSOR_MODE_OPTIONS: CliConfigFieldOption[] = [
  { value: 'plan', label: 'Plan' },
  { value: 'ask', label: 'Ask' }
]

const CURSOR_SANDBOX_OPTIONS: CliConfigFieldOption[] = [
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' }
]

const GEMINI_APPROVAL_MODE_OPTIONS: CliConfigFieldOption[] = [
  { value: 'default', label: 'Default' },
  { value: 'auto_edit', label: 'Auto Edit' },
  { value: 'yolo', label: 'YOLO' },
  { value: 'plan', label: 'Plan' }
]

const GEMINI_OUTPUT_FORMAT_OPTIONS: CliConfigFieldOption[] = [
  { value: 'text', label: 'Text' },
  { value: 'json', label: 'JSON' },
  { value: 'stream-json', label: 'Stream JSON' }
]

const OPCODE_LOG_LEVEL_OPTIONS: CliConfigFieldOption[] = [
  { value: 'DEBUG', label: 'DEBUG' },
  { value: 'INFO', label: 'INFO' },
  { value: 'WARN', label: 'WARN' },
  { value: 'ERROR', label: 'ERROR' }
]

const COMMON_WRAPPER_FIELDS: Record<string, CliConfigFieldSpec> = {
  append_prompt: { type: 'string', multiline: true, desklyManaged: true },
  base_command_override: { type: 'string', advanced: true, desklyManaged: true },
  additional_params: {
    type: 'stringArray',
    advanced: true,
    description: 'One argument per line',
    desklyManaged: true
  },
  env: {
    type: 'stringMap',
    advanced: true,
    description: 'KEY=VALUE per line',
    desklyManaged: true
  }
}

const CLI_TOOL_CONFIG_SPECS: Record<string, CliToolConfigSpec> = {
  'claude-code': {
    fields: {
      ...COMMON_WRAPPER_FIELDS,
      claude_code_router: { type: 'booleanNullable', advanced: true, desklyManaged: true },
      model: { type: 'string' },
      allow_dangerously_skip_permissions: { type: 'booleanNullable', advanced: true },
      dangerously_skip_permissions: { type: 'booleanNullable', advanced: true },
      agent: { type: 'string', advanced: true },
      agents: { type: 'string', multiline: true, advanced: true },
      add_dir: { type: 'stringArray', advanced: true, description: 'One path per line' },
      allowed_tools: { type: 'stringArray', advanced: true, description: 'One tool per line' },
      disallowed_tools: { type: 'stringArray', advanced: true, description: 'One tool per line' },
      append_system_prompt: { type: 'string', multiline: true, advanced: true },
      system_prompt: { type: 'string', multiline: true, advanced: true },
      permission_mode: { type: 'string', options: CLAUDE_PERMISSION_MODE_OPTIONS, advanced: true },
      mcp_config: { type: 'stringArray', advanced: true, description: 'One config per line' },
      strict_mcp_config: { type: 'booleanNullable', advanced: true },
      settings: { type: 'string', multiline: true, advanced: true },
      setting_sources: { type: 'string', advanced: true },
      continue: { type: 'booleanNullable', advanced: true },
      resume: { type: 'string', advanced: true },
      output_format: { type: 'string', options: CLAUDE_OUTPUT_FORMAT_OPTIONS, advanced: true },
      input_format: { type: 'string', options: CLAUDE_INPUT_FORMAT_OPTIONS, advanced: true },
      include_partial_messages: { type: 'booleanNullable', advanced: true },
      replay_user_messages: { type: 'booleanNullable', advanced: true },
      no_session_persistence: { type: 'booleanNullable', advanced: true },
      debug: { type: 'string', advanced: true },
      debug_file: { type: 'string', advanced: true },
      verbose: { type: 'booleanNullable', advanced: true },
      betas: { type: 'stringArray', advanced: true, description: 'One beta header per line' },
      fallback_model: { type: 'string', advanced: true },
      max_budget_usd: { type: 'string', advanced: true },
      json_schema: { type: 'string', multiline: true, advanced: true },
      tools: { type: 'stringArray', advanced: true, description: 'One tool per line' },
      file_resources: { type: 'stringArray', advanced: true, description: 'One file spec per line' },
      chrome: { type: 'booleanNullable', advanced: true },
      no_chrome: { type: 'booleanNullable', advanced: true },
      ide: { type: 'booleanNullable', advanced: true },
      plugin_dir: { type: 'stringArray', advanced: true, description: 'One directory per line' }
    },
    aliases: {
      allowDangerouslySkipPermissions: 'allow_dangerously_skip_permissions',
      agentsJson: 'agents',
      addDir: 'add_dir',
      allowedTools: 'allowed_tools',
      disallowedTools: 'disallowed_tools',
      appendSystemPrompt: 'append_system_prompt',
      systemPrompt: 'system_prompt',
      mcpConfig: 'mcp_config',
      strictMcpConfig: 'strict_mcp_config',
      settingSources: 'setting_sources',
      outputFormat: 'output_format',
      inputFormat: 'input_format',
      includePartialMessages: 'include_partial_messages',
      replayUserMessages: 'replay_user_messages',
      noSessionPersistence: 'no_session_persistence',
      debugFile: 'debug_file',
      fallbackModel: 'fallback_model',
      maxBudgetUsd: 'max_budget_usd',
      jsonSchema: 'json_schema',
      fileResources: 'file_resources',
      noChrome: 'no_chrome',
      pluginDir: 'plugin_dir',
      plan: 'permission_mode'
    }
  },
  codex: {
    fields: {
      ...COMMON_WRAPPER_FIELDS,
      model: {
        type: 'string',
        defaultValue: 'gpt-5.4',
        labels: { 'en-US': 'Model', 'zh-CN': '模型' },
        descriptions: {
          'en-US': 'Default Codex model for this profile. Leave empty to use the CLI default.',
          'zh-CN': '当前配置默认使用的 Codex 模型。留空时使用 Codex CLI 自身默认值。'
        }
      },
      reasoning_effort: {
        type: 'string',
        defaultValue: 'high',
        options: CODEX_REASONING_EFFORT_OPTIONS,
        labels: { 'en-US': 'Reasoning Effort', 'zh-CN': '推理强度' },
        descriptions: {
          'en-US': 'Controls how much reasoning budget Codex uses for the task.',
          'zh-CN': '控制 Codex 在任务中使用的推理强度，可选低、中、高、超高。'
        }
      },
      permissions_preset: {
        type: 'string',
        defaultValue: 'custom',
        options: CODEX_PERMISSION_PRESET_OPTIONS,
        labels: { 'en-US': 'Permissions', 'zh-CN': '权限预设' },
        descriptions: {
          'en-US': 'A simplified permission preset that maps to sandbox and approval behavior.',
          'zh-CN': '更易理解的权限预设，会自动映射到底层的 sandbox 和审批策略。'
        }
      },
      sandbox: {
        type: 'string',
        defaultValue: 'workspace-write',
        options: CODEX_SANDBOX_OPTIONS,
        labels: { 'en-US': 'Sandbox', 'zh-CN': '沙箱权限' },
        descriptions: {
          'en-US': 'Controls filesystem access scope. In most cases, the default is enough.',
          'zh-CN': '控制 Agent 的文件系统访问范围。大多数情况下保持默认即可。'
        }
      },
      ask_for_approval: {
        type: 'string',
        defaultValue: 'never',
        options: CODEX_APPROVAL_OPTIONS,
        labels: { 'en-US': 'Approval Policy', 'zh-CN': '审批策略' },
        descriptions: {
          'en-US': 'Decides when Deskly should ask for confirmation before sensitive actions.',
          'zh-CN': '决定在执行敏感操作前，Deskly 何时需要人工确认。'
        }
      },
      profile: {
        type: 'string',
        labels: { 'en-US': 'Profile', 'zh-CN': '配置档' },
        descriptions: {
          'en-US': 'Use a named Codex profile from your local CLI configuration.',
          'zh-CN': '使用本地 Codex CLI 配置中已经定义好的 profile。'
        }
      },
      oss: { type: 'booleanNullable', uiHidden: true },
      config_overrides: {
        type: 'stringArray',
        advanced: true,
        description: 'One key=value override per line',
        labels: { 'en-US': 'Config Overrides', 'zh-CN': '配置覆盖' },
        descriptions: {
          'en-US': 'Extra key=value overrides for advanced cases. One entry per line.',
          'zh-CN': '用于高级场景的额外 key=value 覆盖项，每行一个。'
        }
      },
      enable_features: {
        type: 'stringArray',
        advanced: true,
        description: 'One feature per line',
        uiHidden: true
      },
      disable_features: {
        type: 'stringArray',
        advanced: true,
        description: 'One feature per line',
        uiHidden: true
      },
      image_paths: {
        type: 'stringArray',
        advanced: true,
        description: 'One image path per line',
        uiHidden: true
      },
      full_auto: {
        type: 'booleanNullable',
        advanced: true,
        uiHidden: true,
        labels: { 'en-US': 'Full Auto', 'zh-CN': '全自动执行' },
        descriptions: {
          'en-US': 'Let Codex run with a more automated execution mode.',
          'zh-CN': '让 Codex 使用更自动化的执行模式。'
        }
      },
      dangerously_bypass_approvals_and_sandbox: {
        type: 'booleanNullable',
        advanced: true,
        uiHidden: true
      },
      local_provider: {
        type: 'string',
        advanced: true,
        uiHidden: true,
        labels: { 'en-US': 'Local Provider', 'zh-CN': '本地 Provider' },
        descriptions: {
          'en-US': 'Use a local model provider such as Ollama when needed.',
          'zh-CN': '按需接入本地模型 Provider，例如 Ollama。'
        }
      },
      search: {
        type: 'booleanNullable',
        advanced: true,
        uiHidden: true,
        labels: { 'en-US': 'Search', 'zh-CN': '联网搜索' },
        descriptions: {
          'en-US': 'Allow Codex to use search when the task needs external information.',
          'zh-CN': '允许 Codex 在任务需要外部信息时使用搜索能力。'
        }
      },
      add_dir: {
        type: 'stringArray',
        advanced: true,
        description: 'One directory per line',
        uiHidden: true,
        labels: { 'en-US': 'Extra Directories', 'zh-CN': '额外目录' },
        descriptions: {
          'en-US': 'Grant access to additional directories. One directory per line.',
          'zh-CN': '为 Codex 追加可访问目录，每行一个目录。'
        }
      },
      cd: { type: 'string', advanced: true, uiHidden: true },
      no_alt_screen: { type: 'booleanNullable', advanced: true, uiHidden: true },
      skip_git_repo_check: {
        type: 'booleanNullable',
        advanced: true,
        uiHidden: true,
        labels: { 'en-US': 'Skip Git Check', 'zh-CN': '跳过 Git 检查' },
        descriptions: {
          'en-US': 'Skip the repository check when running outside a standard Git repo.',
          'zh-CN': '在非标准 Git 仓库环境中跳过仓库检查。'
        }
      },
      ephemeral: {
        type: 'booleanNullable',
        advanced: true,
        uiHidden: true,
        labels: { 'en-US': 'Ephemeral Session', 'zh-CN': '临时会话' },
        descriptions: {
          'en-US': 'Run without keeping a persistent session context.',
          'zh-CN': '以不保留持久会话上下文的方式运行。'
        }
      },
      output_schema: { type: 'string', advanced: true, uiHidden: true },
      color: {
        type: 'string',
        options: [
          { value: 'always', label: 'Always' },
          { value: 'never', label: 'Never' },
          { value: 'auto', label: 'Auto' }
        ],
        advanced: true,
        uiHidden: true
      },
      progress_cursor: { type: 'booleanNullable', advanced: true, uiHidden: true },
      output_last_message: { type: 'string', advanced: true, uiHidden: true },
      thread_id: { type: 'string', advanced: true, uiHidden: true }
    },
    aliases: {
      permissionsPreset: 'permissions_preset',
      reasoningEffort: 'reasoning_effort',
      configOverrides: 'config_overrides',
      enableFeatures: 'enable_features',
      disableFeatures: 'disable_features',
      imagePaths: 'image_paths',
      fullAuto: 'full_auto',
      dangerouslyBypassApprovalsAndSandbox: 'dangerously_bypass_approvals_and_sandbox',
      localProvider: 'local_provider',
      addDir: 'add_dir',
      noAltScreen: 'no_alt_screen',
      skipGitRepoCheck: 'skip_git_repo_check',
      outputSchema: 'output_schema',
      progressCursor: 'progress_cursor',
      outputLastMessage: 'output_last_message',
      threadId: 'thread_id',
      sessionId: 'thread_id',
      resumeSessionId: 'thread_id'
    }
  },
  'codex-cli': {
    fields: {},
    aliases: {}
  },
  'cursor-agent': {
    fields: {
      ...COMMON_WRAPPER_FIELDS,
      api_key: { type: 'string' },
      force: { type: 'booleanNullable' },
      yolo: { type: 'booleanNullable', advanced: true },
      model: { type: 'string', defaultValue: 'auto' },
      mode: { type: 'string', options: CURSOR_MODE_OPTIONS, advanced: true },
      plan: { type: 'booleanNullable', advanced: true },
      resume: { type: 'string', advanced: true },
      continue: { type: 'booleanNullable', advanced: true },
      sandbox: { type: 'string', options: CURSOR_SANDBOX_OPTIONS, advanced: true },
      trust: { type: 'booleanNullable', advanced: true },
      workspace: { type: 'string', advanced: true },
      header: { type: 'stringArray', advanced: true, description: 'One header per line' },
      approve_mcps: { type: 'booleanNullable', advanced: true },
      worktree: { type: 'string', advanced: true },
      worktree_base: { type: 'string', advanced: true },
      skip_worktree_setup: { type: 'booleanNullable', advanced: true }
    },
    aliases: {
      apiKey: 'api_key',
      approveMcps: 'approve_mcps',
      worktreeBase: 'worktree_base',
      skipWorktreeSetup: 'skip_worktree_setup'
    }
  },
  'gemini-cli': {
    fields: {
      ...COMMON_WRAPPER_FIELDS,
      model: { type: 'string' },
      sandbox: { type: 'booleanNullable', advanced: true },
      yolo: { type: 'booleanNullable', advanced: true },
      approval_mode: { type: 'string', options: GEMINI_APPROVAL_MODE_OPTIONS, advanced: true },
      policy: { type: 'stringArray', advanced: true, description: 'One policy path per line' },
      acp: { type: 'booleanNullable', advanced: true },
      allowed_mcp_server_names: { type: 'stringArray', advanced: true, description: 'One MCP server name per line' },
      allowed_tools: { type: 'stringArray', advanced: true, description: 'One tool per line' },
      extensions: { type: 'stringArray', advanced: true, description: 'One extension per line' },
      resume: { type: 'string', advanced: true },
      include_directories: { type: 'stringArray', advanced: true, description: 'One directory per line' },
      output_format: { type: 'string', options: GEMINI_OUTPUT_FORMAT_OPTIONS, advanced: true },
      raw_output: { type: 'booleanNullable', advanced: true },
      accept_raw_output_risk: { type: 'booleanNullable', advanced: true },
      debug: { type: 'booleanNullable', advanced: true }
    },
    aliases: {
      approvalMode: 'approval_mode',
      experimentalAcp: 'acp',
      allowedMcpServerNames: 'allowed_mcp_server_names',
      allowedTools: 'allowed_tools',
      includeDirectories: 'include_directories',
      outputFormat: 'output_format',
      rawOutput: 'raw_output',
      acceptRawOutputRisk: 'accept_raw_output_risk'
    }
  },
  opencode: {
    fields: {
      ...COMMON_WRAPPER_FIELDS,
      model: { type: 'string' },
      continue: { type: 'booleanNullable', advanced: true },
      session: { type: 'string', advanced: true },
      agent: { type: 'string', advanced: true },
      print_logs: { type: 'booleanNullable', advanced: true },
      log_level: { type: 'string', options: OPCODE_LOG_LEVEL_OPTIONS, advanced: true },
      port: { type: 'string', advanced: true },
      hostname: { type: 'string', advanced: true },
      mdns: { type: 'booleanNullable', advanced: true },
      mdns_domain: { type: 'string', advanced: true },
      cors: { type: 'stringArray', advanced: true, description: 'One domain per line' }
    },
    aliases: {
      printLogs: 'print_logs',
      logLevel: 'log_level',
      mdnsDomain: 'mdns_domain',
      resume: 'session',
      resumeId: 'session',
      resume_id: 'session',
      sessionId: 'session',
      session_id: 'session',
      conversationId: 'session',
      conversation_id: 'session',
      threadId: 'session',
      thread_id: 'session'
    }
  }
}

const TOOL_ID_ALIASES: Record<string, string> = {
  'codex-cli': 'codex'
}

export function resolveCliToolSpecId(toolId: string): string {
  return TOOL_ID_ALIASES[toolId] ?? toolId
}

export function getCliToolConfigSpec(toolId: string): CliToolConfigSpec | undefined {
  return CLI_TOOL_CONFIG_SPECS[resolveCliToolSpecId(toolId)]
}

export function listCliToolConfigKeys(toolId: string): string[] {
  const spec = getCliToolConfigSpec(toolId)
  return spec ? Object.keys(spec.fields) : []
}

export function getVisibleCliToolConfigSpec(toolId: string): Record<string, CliConfigFieldSpec> {
  const spec = getCliToolConfigSpec(toolId)
  if (!spec) return {}

  return Object.fromEntries(
    Object.entries(spec.fields).filter(([, field]) => !field.desklyManaged && field.uiHidden !== true)
  )
}

export function createCliToolConfigTemplate(toolId: string): Record<string, unknown> {
  const spec = getCliToolConfigSpec(toolId)
  if (!spec) return {}

  return Object.entries(spec.fields).reduce<Record<string, unknown>>((acc, [key, field]) => {
    acc[key] = sanitizeFieldValue(field, undefined, true)
    return acc
  }, {})
}

export function resolveCodexPermissionsPreset(
  preset: unknown
): Partial<Record<'sandbox' | 'ask_for_approval', string>> {
  if (preset === 'default') {
    return {
      sandbox: 'workspace-write',
      ask_for_approval: 'on-request'
    }
  }

  if (preset === 'full-access') {
    return {
      sandbox: 'danger-full-access',
      ask_for_approval: 'never'
    }
  }

  return {}
}

export function deriveCodexPermissionsPreset(config: Record<string, unknown>): string {
  const sandbox = typeof config.sandbox === 'string' ? config.sandbox : ''
  const askForApproval =
    typeof config.ask_for_approval === 'string' ? config.ask_for_approval : ''

  if (sandbox === 'workspace-write' && askForApproval === 'on-request') {
    return 'default'
  }

  if (sandbox === 'danger-full-access' && askForApproval === 'never') {
    return 'full-access'
  }

  return 'custom'
}

interface NormalizeOptions {
  includeDefaults?: boolean
}

export function normalizeCliToolConfig(
  toolId: string,
  raw: Record<string, unknown>
): Record<string, unknown> {
  return normalizeCliToolConfigWithOptions(toolId, raw, {})
}

export function normalizeCliToolConfigWithDefaults(
  toolId: string,
  raw: Record<string, unknown>
): Record<string, unknown> {
  return normalizeCliToolConfigWithOptions(toolId, raw, { includeDefaults: true })
}

function normalizeCliToolConfigWithOptions(
  toolId: string,
  raw: Record<string, unknown>,
  options: NormalizeOptions
): Record<string, unknown> {
  const spec = getCliToolConfigSpec(toolId)
  if (!spec) return raw

  const specId = resolveCliToolSpecId(toolId)
  const normalizedInput = applySpecialCases(specId, applyAliases(spec, raw))
  const includeDefaults = options.includeDefaults === true

  return Object.entries(spec.fields).reduce<Record<string, unknown>>((acc, [key, field]) => {
    const hasValue = Object.prototype.hasOwnProperty.call(normalizedInput, key)
    if (!hasValue && !includeDefaults) {
      return acc
    }

    const sanitized = sanitizeFieldValue(field, normalizedInput[key], includeDefaults)
    if (!includeDefaults && shouldOmitField(field, sanitized)) {
      return acc
    }

    acc[key] = sanitized
    return acc
  }, {})
}

function applySpecialCases(
  specId: string,
  raw: Record<string, unknown>
): Record<string, unknown> {
  if (specId !== 'codex') {
    return raw
  }

  const next = { ...raw }
  const preset = typeof next.permissions_preset === 'string' ? next.permissions_preset : ''

  if (preset) {
    Object.assign(next, resolveCodexPermissionsPreset(preset))
    return next
  }

  next.permissions_preset = deriveCodexPermissionsPreset(next)
  return next
}

function applyAliases(
  spec: CliToolConfigSpec,
  raw: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  const aliases = spec.aliases ?? {}

  for (const [key, value] of Object.entries(raw)) {
    const canonical = aliases[key] ?? key
    if (!spec.fields[canonical]) continue

    if (canonical === 'permission_mode' && value === true) {
      next[canonical] = 'plan'
      continue
    }

    if (next[canonical] === undefined) {
      next[canonical] = value
    }
  }

  return next
}

function sanitizeFieldValue(
  field: CliConfigFieldSpec,
  value: unknown,
  includeDefaults: boolean
): unknown {
  switch (field.type) {
    case 'string':
      if (typeof value === 'string') return value
      return includeDefaults && typeof field.defaultValue === 'string' ? field.defaultValue : ''
    case 'stringArray':
      return sanitizeStringArray(value)
    case 'stringMap':
      return sanitizeStringMap(value)
    case 'boolean':
      if (typeof value === 'boolean') return value
      if (typeof field.defaultValue === 'boolean') return field.defaultValue
      return false
    case 'booleanNullable':
      if (typeof value === 'boolean') return value
      return includeDefaults ? null : undefined
    default:
      return value
  }
}

function sanitizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0
    )
  }
  if (typeof value === 'string' && value.trim()) {
    return [value]
  }
  return []
}

function sanitizeStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [key, entry]) => {
      if (typeof entry === 'string') {
        acc[key] = entry
      }
      return acc
    },
    {}
  )
}

function shouldOmitField(field: CliConfigFieldSpec, value: unknown): boolean {
  if (field.type === 'string') {
    return typeof value !== 'string' || value.trim().length === 0
  }
  if (field.type === 'stringArray') {
    return !Array.isArray(value) || value.length === 0
  }
  if (field.type === 'stringMap') {
    return !value || typeof value !== 'object' || Object.keys(value as Record<string, unknown>).length === 0
  }
  if (field.type === 'booleanNullable') {
    return typeof value !== 'boolean'
  }
  return false
}
