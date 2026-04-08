import type { PreviewConfig, PreviewConfigSyncResult } from '@shared/contracts/preview'

export interface DefaultPreviewSelection {
  config: PreviewConfig | null
  shouldAutoStart: boolean
}

export const getPreviewInstanceId = (projectId: string): string =>
  `task-detail-preview:${projectId}`

export const canOpenInlinePreview = (
  config?: Pick<PreviewConfig, 'launchCapability' | 'port'> | null
): boolean => Boolean(config && config.launchCapability === 'inline-web' && config.port)

export const supportsInlinePreview = (
  config?: Pick<PreviewConfig, 'launchCapability'> | null
): boolean => Boolean(config && config.launchCapability === 'inline-web')

export const selectDefaultPreviewConfig = (configs: PreviewConfig[]): DefaultPreviewSelection => {
  const [firstConfig] = configs

  return {
    config: firstConfig ?? null,
    shouldAutoStart: false
  }
}

export const resolveSelectedPreviewConfigId = (
  configs: PreviewConfig[],
  currentSelectedId?: string | null,
  preferredConfigId?: string | null
): string => {
  if (preferredConfigId && configs.some((config) => config.id === preferredConfigId)) {
    return preferredConfigId
  }

  if (currentSelectedId && configs.some((config) => config.id === currentSelectedId)) {
    return currentSelectedId
  }

  return selectDefaultPreviewConfig(configs).config?.id ?? ''
}

export const resolvePreviewWorkingDir = (
  configCwd?: string | null,
  fallbackCwd?: string | null
): string | undefined => {
  const trimmedConfigCwd = configCwd?.trim()
  if (trimmedConfigCwd) {
    return trimmedConfigCwd
  }

  const trimmedFallbackCwd = fallbackCwd?.trim()
  return trimmedFallbackCwd || undefined
}

export const splitCommandLine = (value: string): string[] => {
  const trimmed = value.trim()
  if (!trimmed) return []

  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let escapeNext = false

  for (const char of trimmed) {
    if (escapeNext) {
      current += char
      escapeNext = false
      continue
    }

    if (char === '\\') {
      escapeNext = true
      continue
    }

    if (quote) {
      if (char === quote) {
        quote = null
      } else {
        current += char
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (escapeNext) {
    current += '\\'
  }

  if (current) {
    tokens.push(current)
  }

  return tokens
}

const quoteCommandPart = (value: string): string => {
  if (!/[\s"'\\]/.test(value)) {
    return value
  }

  return `"${value.replace(/(["\\])/g, '\\$1')}"`
}

export const formatCommandLine = (command: string, args: string[]): string => {
  return [command, ...args].filter(Boolean).map(quoteCommandPart).join(' ')
}

export const summarizePreviewSyncResult = (result: PreviewConfigSyncResult) => ({
  added: result.added.length,
  updated: result.updated.length,
  deleted: result.deleted.length,
  skipped: result.skipped.length
})
