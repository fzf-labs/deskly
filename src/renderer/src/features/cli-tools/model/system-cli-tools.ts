import type {
  LocalizedText,
  SystemCliInstalledSource,
  SystemCliPackageManager,
  SystemCliToolInfo,
  SystemCliToolInstallState
} from '../../../../../shared/system-cli-tools'
import { DEFAULT_RECOMMENDED_SYSTEM_CLI_TOOL_IDS } from '../../../../../shared/system-cli-tools'

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
  tool.installed === true || tool.installState === 'installed'

export const getLocalizedSystemCliText = (
  value: LocalizedText,
  language: string
): string => (language.startsWith('zh') ? value.zh : value.en)

export const getSystemCliSupportedSources = (
  tool: SystemCliToolInfo
): SystemCliPackageManager[] => {
  const sources = tool.packageSources?.map((source) => source.manager) ?? []
  return Array.from(new Set(sources))
}

export const getSystemCliPrimarySupportedSource = (
  tool: SystemCliToolInfo
): SystemCliPackageManager | null => {
  const sources = getSystemCliSupportedSources(tool)
  return sources[0] ?? null
}

export const getSystemCliInstalledSources = (
  tool: SystemCliToolInfo
): SystemCliInstalledSource[] => {
  if (!isSystemCliToolInstalled(tool)) {
    return []
  }

  if (tool.installedVia) {
    return [tool.installedVia]
  }

  return getSystemCliSupportedSources(tool)
}

export const getSystemCliRecommendedGroupSource = (
  tool: SystemCliToolInfo
): SystemCliInstalledSource | null => {
  if (isSystemCliToolInstalled(tool)) {
    return getSystemCliInstalledSources(tool)[0] ?? null
  }

  return getSystemCliPrimarySupportedSource(tool)
}

export const getSystemCliDocsUrl = (tool: SystemCliToolInfo): string | null => {
  if (tool.installedVia === 'system') {
    return tool.docsUrl ?? null
  }

  const preferredSource =
    tool.installedVia ??
    (tool.packageSources?.some((source) => source.manager === 'brew')
      ? 'brew'
      : tool.packageSources?.some((source) => source.manager === 'npm')
        ? 'npm'
        : tool.packageSources?.some((source) => source.manager === 'cargo')
          ? 'cargo'
          : null)

  if (preferredSource === 'brew') {
    const brewSource = tool.packageSources?.find((source) => source.manager === 'brew')
    const packageName = brewSource?.packages[0]

    if (packageName) {
      return `https://formulae.brew.sh/formula/${encodeURIComponent(packageName)}#default`
    }
  }

  if (preferredSource === 'npm') {
    const npmSource = tool.packageSources?.find((source) => source.manager === 'npm')
    const packageName = npmSource?.packages[0]

    if (packageName) {
      return `https://www.npmjs.com/package/${encodeURIComponent(packageName)}`
    }
  }

  if (preferredSource === 'cargo') {
    const cargoSource = tool.packageSources?.find((source) => source.manager === 'cargo')
    const packageName = cargoSource?.packages[0]

    if (packageName) {
      return `https://crates.io/crates/${encodeURIComponent(packageName)}`
    }
  }

  return tool.docsUrl ?? null
}

export const getSystemCliSearchText = (tool: SystemCliToolInfo): string =>
  [
    tool.id,
    tool.displayName,
    tool.category,
    tool.installedVia ?? '',
    ...getSystemCliInstalledSources(tool),
    ...getSystemCliSupportedSources(tool),
    ...(tool.packageSources?.flatMap((source) => source.packages) ?? []),
    tool.summary.zh,
    tool.summary.en,
    tool.detailIntro.zh,
    tool.detailIntro.en,
    ...tool.useCases.flatMap((item) => [item.zh, item.en]),
    ...tool.guideSteps.flatMap((item) => [item.zh, item.en]),
    ...tool.examplePrompts.flatMap((item) => [
      item.label.zh,
      item.label.en,
      item.prompt.zh,
      item.prompt.en
    ])
  ]
    .join(' ')
    .toLowerCase()

export const filterRecommendedSystemCliTools = (
  tools: SystemCliToolInfo[]
): SystemCliToolInfo[] => {
  const recommendedIds = new Set(DEFAULT_RECOMMENDED_SYSTEM_CLI_TOOL_IDS)
  return tools.filter((tool) => recommendedIds.has(tool.id))
}
