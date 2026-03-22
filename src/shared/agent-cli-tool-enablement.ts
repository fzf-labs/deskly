export const SUPPORTED_CLI_TOOL_IDS = [
  'claude-code',
  'codex',
  'cursor-agent',
  'gemini-cli',
  'opencode'
] as const

export type SupportedCliToolId = (typeof SUPPORTED_CLI_TOOL_IDS)[number]

export type EnabledCliTools = Record<SupportedCliToolId, boolean>

export const createDefaultEnabledCliTools = (): EnabledCliTools => ({
  'claude-code': true,
  codex: true,
  'cursor-agent': true,
  'gemini-cli': true,
  opencode: true
})

export const isSupportedCliToolId = (value: unknown): value is SupportedCliToolId =>
  typeof value === 'string' &&
  (SUPPORTED_CLI_TOOL_IDS as readonly string[]).includes(value)

export const normalizeEnabledCliTools = (value: unknown): EnabledCliTools => {
  const defaults = createDefaultEnabledCliTools()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaults
  }

  const record = value as Record<string, unknown>
  for (const toolId of SUPPORTED_CLI_TOOL_IDS) {
    if (typeof record[toolId] === 'boolean') {
      defaults[toolId] = record[toolId] as boolean
    }
  }

  return defaults
}

export const isCliToolEnabled = (
  toolId: string | null | undefined,
  enabledCliTools: EnabledCliTools
): boolean => {
  if (!toolId || !isSupportedCliToolId(toolId)) {
    return false
  }

  return enabledCliTools[toolId] !== false
}

export const getEnabledCliToolIds = (enabledCliTools: EnabledCliTools): SupportedCliToolId[] =>
  SUPPORTED_CLI_TOOL_IDS.filter((toolId) => enabledCliTools[toolId] !== false)

export const filterEnabledCliTools = <T extends { id: string }>(
  tools: T[],
  enabledCliTools: EnabledCliTools
): T[] => tools.filter((tool) => isCliToolEnabled(tool.id, enabledCliTools))
