export type CliConfigFieldType =
  | 'string'
  | 'stringArray'
  | 'stringMap'
  | 'boolean'
  | 'booleanNullable'

export interface CliConfigFieldOption {
  value: string
  label: string
}

export interface CliConfigFieldSpec {
  type: CliConfigFieldType
  required?: boolean
  defaultValue?: unknown
  multiline?: boolean
  options?: CliConfigFieldOption[]
  description?: string
  advanced?: boolean
  desklyManaged?: boolean
}

export interface CliToolConfigSpec {
  fields: Record<string, CliConfigFieldSpec>
  aliases?: Record<string, string>
}

const CODEX_SANDBOX_OPTIONS: CliConfigFieldOption[] = [
  { value: 'read-only', label: 'Read Only' },
  { value: 'workspace-write', label: 'Workspace Write' },
  { value: 'danger-full-access', label: 'Danger Full Access' }
]

const CODEX_APPROVAL_OPTIONS: CliConfigFieldOption[] = [
  { value: 'untrusted', label: 'Untrusted' },
  { value: 'on-failure', label: 'On Failure' },
  { value: 'on-request', label: 'On Request' },
  { value: 'never', label: 'Never' }
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
      sandbox: { type: 'string', options: CODEX_SANDBOX_OPTIONS },
      ask_for_approval: { type: 'string', options: CODEX_APPROVAL_OPTIONS },
      oss: { type: 'booleanNullable' },
      model: { type: 'string' },
      profile: { type: 'string', advanced: true },
      config_overrides: { type: 'stringArray', advanced: true, description: 'One key=value override per line' },
      enable_features: { type: 'stringArray', advanced: true, description: 'One feature per line' },
      disable_features: { type: 'stringArray', advanced: true, description: 'One feature per line' },
      image_paths: { type: 'stringArray', advanced: true, description: 'One image path per line' },
      full_auto: { type: 'booleanNullable', advanced: true },
      dangerously_bypass_approvals_and_sandbox: { type: 'booleanNullable', advanced: true },
      local_provider: { type: 'string', advanced: true },
      search: { type: 'booleanNullable', advanced: true },
      add_dir: { type: 'stringArray', advanced: true, description: 'One directory per line' },
      cd: { type: 'string', advanced: true },
      no_alt_screen: { type: 'booleanNullable', advanced: true },
      skip_git_repo_check: { type: 'booleanNullable', advanced: true },
      ephemeral: { type: 'booleanNullable', advanced: true },
      output_schema: { type: 'string', advanced: true },
      color: {
        type: 'string',
        options: [
          { value: 'always', label: 'Always' },
          { value: 'never', label: 'Never' },
          { value: 'auto', label: 'Auto' }
        ],
        advanced: true
      },
      progress_cursor: { type: 'booleanNullable', advanced: true },
      output_last_message: { type: 'string', advanced: true },
      thread_id: { type: 'string', advanced: true }
    },
    aliases: {
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

export function createCliToolConfigTemplate(toolId: string): Record<string, unknown> {
  const spec = getCliToolConfigSpec(toolId)
  if (!spec) return {}

  return Object.entries(spec.fields).reduce<Record<string, unknown>>((acc, [key, field]) => {
    acc[key] = sanitizeFieldValue(field, undefined, true)
    return acc
  }, {})
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

  const normalizedInput = applyAliases(spec, raw)
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
