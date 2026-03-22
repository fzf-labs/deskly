import type {
  SystemCliToolInfo,
  SystemCliToolInstallState
} from '../../../shared/system-cli-tools'

const INSTALL_STATES = new Set<SystemCliToolInstallState>([
  'unknown',
  'checking',
  'installed',
  'missing',
  'error'
])

const isSystemCliToolInfo = (value: unknown): value is SystemCliToolInfo =>
  Boolean(value) &&
  typeof value === 'object' &&
  typeof (value as { id?: unknown }).id === 'string' &&
  typeof (value as { displayName?: unknown }).displayName === 'string'

export const normalizeSystemCliTools = (value: unknown): SystemCliToolInfo[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isSystemCliToolInfo)
    .map((tool) => ({
      ...tool,
      installState: INSTALL_STATES.has(tool.installState) ? tool.installState : 'unknown'
    }))
}

export const isSystemCliToolInstalled = (tool: SystemCliToolInfo): boolean =>
  tool.installState === 'installed'
