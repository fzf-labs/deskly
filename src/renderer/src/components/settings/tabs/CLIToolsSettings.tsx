import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  RefreshCw,
  Search,
  Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { shell } from '@/lib/electron-api'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/providers/language-provider'
import {
  getLocalizedSystemCliText,
  getSystemCliSearchText,
  getSystemCliSupportedSources,
  isSystemCliToolInstalled,
  normalizeSystemCliTools
} from '@/lib/system-cli-tools'
import {
  SYSTEM_CLI_PACKAGE_MANAGERS,
  type SystemCliPackageManager,
  type SystemCliToolInfo
} from '../../../../../shared/system-cli-tools'
import { SystemCliToolDetailDialog } from './SystemCliToolDetailDialog'

type CLIToolsPage = 'installed' | 'recommended'

const TOOL_CACHE = {
  tools: null as SystemCliToolInfo[] | null
}

const openExternalUrl = async (url: string) => {
  try {
    await shell.openUrl(url)
  } catch {
    window.open(url, '_blank')
  }
}

const sourceTone = (source: SystemCliPackageManager): string => {
  switch (source) {
    case 'brew':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
    case 'pipx':
      return 'border-sky-500/20 bg-sky-500/10 text-sky-700'
    case 'npm':
      return 'border-orange-500/20 bg-orange-500/10 text-orange-700'
    case 'cargo':
      return 'border-violet-500/20 bg-violet-500/10 text-violet-700'
  }
}

export function CLIToolsSettings() {
  const { language, t } = useLanguage()
  const [tools, setTools] = useState<SystemCliToolInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSource, setActiveSource] = useState<'all' | SystemCliPackageManager>('all')
  const [page, setPage] = useState<CLIToolsPage>('installed')
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null)

  const loadTools = useCallback(async (force = false) => {
    setLoading(true)
    setError(false)

    if (!force && TOOL_CACHE.tools) {
      setTools(TOOL_CACHE.tools)
      void window.api?.systemCliTools?.refresh?.({ level: 'fast' })
      setLoading(false)
      return
    }

    try {
      const result = force
        ? await window.api?.systemCliTools?.refresh?.({ level: 'full', force: true })
        : await window.api?.systemCliTools?.getSnapshot?.()

      const normalized = normalizeSystemCliTools(result)
      TOOL_CACHE.tools = normalized
      setTools(normalized)

      if (!force) {
        void window.api?.systemCliTools?.refresh?.({ level: 'fast' })
      }
    } catch (loadError) {
      console.error('[CLIToolsSettings] Failed to load system CLI tools:', loadError)
      setError(true)
      setTools(TOOL_CACHE.tools ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTools()
  }, [loadTools])

  useEffect(() => {
    const unsubscribe = window.api?.systemCliTools?.onUpdated?.((updatedTools) => {
      const normalized = normalizeSystemCliTools(updatedTools)
      TOOL_CACHE.tools = normalized
      setTools(normalized)
    })

    return () => {
      unsubscribe?.()
    }
  }, [])

  const installedTools = useMemo(
    () => tools.filter((tool) => isSystemCliToolInstalled(tool)),
    [tools]
  )

  const filteredTools = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return tools.filter((tool) => {
      const installed = isSystemCliToolInstalled(tool)

      if (activeSource !== 'all') {
        if (installed) {
          const matchesInstalledSource =
            tool.installedVia === activeSource ||
            (!tool.installedVia && getSystemCliSupportedSources(tool).includes(activeSource))

          if (!matchesInstalledSource) {
            return false
          }
        } else if (!getSystemCliSupportedSources(tool).includes(activeSource)) {
          return false
        }
      }

      if (!normalizedQuery) {
        return true
      }

      return getSystemCliSearchText(tool).includes(normalizedQuery)
    })
  }, [activeSource, searchQuery, tools])

  const recommendedTools = useMemo(
    () => filteredTools.filter((tool) => !isSystemCliToolInstalled(tool)),
    [filteredTools]
  )

  const visibleInstalledTools = useMemo(
    () => filteredTools.filter((tool) => isSystemCliToolInstalled(tool)),
    [filteredTools]
  )

  const selectedTool = useMemo(
    () => tools.find((tool) => tool.id === selectedToolId) ?? null,
    [selectedToolId, tools]
  )

  const visibleSourceGroups = useMemo(
    () => (activeSource === 'all' ? SYSTEM_CLI_PACKAGE_MANAGERS : [activeSource]),
    [activeSource]
  )

  const sourceInstalledCounts = useMemo(
    () =>
      Object.fromEntries(
        SYSTEM_CLI_PACKAGE_MANAGERS.map((source) => [
          source,
          installedTools.filter(
            (tool) =>
              tool.installedVia === source ||
              (!tool.installedVia && getSystemCliSupportedSources(tool).includes(source))
          ).length
        ])
      ) as Record<SystemCliPackageManager, number>,
    [installedTools]
  )

  const installedGroups = useMemo(
    () =>
      Object.fromEntries(
        visibleSourceGroups.map((source) => [
          source,
          visibleInstalledTools.filter(
            (tool) =>
              tool.installedVia === source ||
              (!tool.installedVia && getSystemCliSupportedSources(tool).includes(source))
          )
        ])
      ) as Record<SystemCliPackageManager, SystemCliToolInfo[]>,
    [visibleInstalledTools, visibleSourceGroups]
  )

  const recommendedGroups = useMemo(
    () =>
      Object.fromEntries(
        visibleSourceGroups.map((source) => [
          source,
          recommendedTools.filter((tool) => getSystemCliSupportedSources(tool).includes(source))
        ])
      ) as Record<SystemCliPackageManager, SystemCliToolInfo[]>,
    [recommendedTools, visibleSourceGroups]
  )

  const currentGroups = page === 'installed' ? installedGroups : recommendedGroups
  const currentTools = page === 'installed' ? visibleInstalledTools : recommendedTools
  const currentEmptyText =
    page === 'installed'
      ? t.settings.cliToolsInstalledEmpty
      : activeSource !== 'all' || searchQuery.trim().length > 0
        ? t.settings.cliToolsRecommendedFilteredEmpty
        : t.settings.cliToolsRecommendedEmpty

  const getSourceLabel = (source: 'all' | SystemCliPackageManager): string => {
    switch (source) {
      case 'brew':
        return t.settings.cliToolsSourceBrew
      case 'pipx':
        return t.settings.cliToolsSourcePipx
      case 'npm':
        return t.settings.cliToolsSourceNpm
      case 'cargo':
        return t.settings.cliToolsSourceCargo
      default:
        return t.settings.cliToolsFilterAll
    }
  }

  const getVisibleSources = (tool: SystemCliToolInfo): SystemCliPackageManager[] => {
    const installed = isSystemCliToolInstalled(tool)
    return installed
      ? (tool.installedVia ? [tool.installedVia] : getSystemCliSupportedSources(tool))
      : getSystemCliSupportedSources(tool)
  }

  const renderSourceBadge = (source: SystemCliPackageManager) => (
    <span
      key={source}
      className={cn('rounded-full border px-2 py-0.5 text-[10px] uppercase', sourceTone(source))}
    >
      {getSourceLabel(source)}
    </span>
  )

  const renderInstalledRow = (tool: SystemCliToolInfo) => {
    const docsUrl = tool.docsUrl
    const summaryText = getLocalizedSystemCliText(tool.summary, language).trim()

    return (
      <div
        key={tool.id}
        className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-foreground text-sm font-semibold">{tool.displayName}</h4>
            <code className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[11px]">
              {tool.command}
            </code>
          </div>
          {summaryText ? (
            <p className="text-muted-foreground text-xs leading-5">
              {summaryText}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="bg-muted text-foreground rounded-full px-2.5 py-1 font-mono">
              {tool.version || '—'}
            </span>
            <span
              className="bg-muted text-muted-foreground max-w-full truncate rounded-full px-2.5 py-1 font-mono"
              title={tool.installPath || '—'}
            >
              {tool.installPath || '—'}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setSelectedToolId(tool.id)}
          >
            {t.settings.cliToolsDetails}
          </Button>
          {docsUrl ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void openExternalUrl(docsUrl)}
            >
              <ArrowUpRight className="mr-1 size-3.5" />
              {t.settings.cliToolsDocs}
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  const renderRecommendedCard = (tool: SystemCliToolInfo) => {
    const docsUrl = tool.docsUrl
    const visibleSources = getVisibleSources(tool)
    const primaryUseCase = tool.useCases[0]
    const summaryText = getLocalizedSystemCliText(tool.summary, language).trim()

    return (
      <div
        key={tool.id}
        className="border-border/70 bg-background flex h-full flex-col gap-3 rounded-xl border p-4"
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-foreground text-sm font-semibold">{tool.displayName}</h4>
            <code className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[11px]">
              {tool.command}
            </code>
          </div>
          {summaryText ? (
            <p className="text-muted-foreground text-xs leading-5">
              {summaryText}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {visibleSources.map(renderSourceBadge)}
        </div>

        {primaryUseCase ? (
          <div className="bg-muted/60 rounded-xl px-3 py-2">
            <div className="text-muted-foreground text-[11px]">{t.settings.cliToolsUseCases}</div>
            <div className="text-foreground mt-1 text-sm">
              {getLocalizedSystemCliText(primaryUseCase, language)}
            </div>
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setSelectedToolId(tool.id)}
          >
            {t.settings.cliToolsDetails}
          </Button>
          {docsUrl ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void openExternalUrl(docsUrl)}
            >
              <ArrowUpRight className="mr-1 size-3.5" />
              {t.settings.cliToolsDocs}
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  const renderSourceSection = (
    source: SystemCliPackageManager,
    toolsInGroup: SystemCliToolInfo[],
    variant: CLIToolsPage
  ) => (
    <div key={source} className="border-border bg-background overflow-hidden rounded-2xl border">
      <div className="bg-muted/35 flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] uppercase', sourceTone(source))}>
            {getSourceLabel(source)}
          </span>
          <span className="text-muted-foreground text-xs">
            {variant === 'installed'
              ? t.settings.cliToolsInstalledSection
              : t.settings.cliToolsRecommendedSection}
          </span>
        </div>
        <span className="bg-background text-foreground rounded-full px-2.5 py-1 text-xs font-medium">
          {toolsInGroup.length}
        </span>
      </div>

      {toolsInGroup.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-muted-foreground">
          {variant === 'installed'
            ? t.settings.cliToolsSourceInstalledEmpty
            : t.settings.cliToolsSourceRecommendedEmpty}
        </div>
      ) : variant === 'installed' ? (
        <div className="divide-border divide-y">{toolsInGroup.map(renderInstalledRow)}</div>
      ) : (
        <div className="grid gap-3 p-4 lg:grid-cols-2">{toolsInGroup.map(renderRecommendedCard)}</div>
      )}
    </div>
  )

  const renderContentBlock = () => {
    if (error) {
      return (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border px-4 py-3 text-sm">
          {t.settings.cliToolsDetectError}
        </div>
      )
    }

    if (loading && tools.length === 0) {
      return (
        <div className="border-border bg-background rounded-2xl border px-4 py-10 text-center text-sm">
          {t.settings.cliToolsDetecting}
        </div>
      )
    }

    if (!loading && currentTools.length === 0) {
      return (
        <div className="border-border bg-background rounded-2xl border px-4 py-10 text-center">
          <div className="text-muted-foreground mx-auto flex size-10 items-center justify-center rounded-2xl border">
            <Search className="size-4" />
          </div>
          <p className="text-foreground mt-4 text-sm font-medium">{currentEmptyText}</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {visibleSourceGroups.map((source) => renderSourceSection(source, currentGroups[source], page))}
      </div>
    )
  }

  const renderTopPanel = () => (
    <div className="border-border bg-gradient-to-br from-muted/60 via-background to-background rounded-2xl border p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="from-primary/15 to-primary/5 text-primary flex size-11 items-center justify-center rounded-2xl border bg-gradient-to-br">
              {page === 'installed' ? <Boxes className="size-5" /> : <Sparkles className="size-5" />}
            </div>
            <div>
              <h2 className="text-foreground text-xl font-semibold tracking-tight">
                {page === 'installed' ? t.settings.cliToolsTitle : t.settings.cliToolsRecommendedSection}
              </h2>
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
                {page === 'installed'
                  ? t.settings.cliToolsDescription
                  : t.settings.cliToolsRecommendedPageDescription}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="border-border bg-background/80 rounded-xl border px-4 py-3">
              <div className="text-muted-foreground text-xs">{t.settings.cliToolsInstalledCount}</div>
              <div className="text-foreground mt-1 text-2xl font-semibold">{summary.installed}</div>
            </div>
            <div className="border-border bg-background/80 rounded-xl border px-4 py-3">
              <div className="text-muted-foreground text-xs">{t.settings.cliToolsMissingCount}</div>
              <div className="text-foreground mt-1 text-2xl font-semibold">{summary.missing}</div>
            </div>
            <div className="border-border bg-background/80 rounded-xl border px-4 py-3">
              <div className="text-muted-foreground text-xs">{t.settings.cliToolsCatalogCount}</div>
              <div className="text-foreground mt-1 text-2xl font-semibold">{summary.total}</div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {page === 'recommended' ? (
            <Button type="button" variant="ghost" onClick={() => setPage('installed')}>
              <ArrowLeft className="mr-2 size-4" />
              {t.settings.cliToolsBackToInstalled}
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => void loadTools(true)} disabled={loading}>
            <RefreshCw className={cn('mr-2 size-4', loading && 'animate-spin')} />
            {t.settings.cliToolsRescan}
          </Button>
          {page === 'installed' ? (
            <Button type="button" variant="secondary" onClick={() => setPage('recommended')}>
              <Sparkles className="mr-2 size-4" />
              {t.settings.cliToolsOpenRecommended}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border bg-background/85 p-3">
        <div className="relative max-w-xl">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t.settings.cliToolsSearchPlaceholder}
              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring h-10 w-full rounded-xl border py-2 pr-3 pl-9 text-sm focus:ring-2 focus:outline-none"
            />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {SYSTEM_CLI_PACKAGE_MANAGERS.map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => setActiveSource((current) => (current === source ? 'all' : source))}
              className={cn(
                'bg-muted/45 flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors',
                activeSource === source
                  ? 'border-primary bg-primary/8'
                  : 'border-border hover:border-foreground/20 hover:bg-muted/70'
              )}
            >
              {renderSourceBadge(source)}
              <span className="text-foreground text-xs font-medium">
                {sourceInstalledCounts[source]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {renderContentBlock()}
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {renderTopPanel()}

      <SystemCliToolDetailDialog
        open={selectedTool !== null}
        tool={selectedTool}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedToolId(null)
          }
        }}
      />
    </div>
  )
}
