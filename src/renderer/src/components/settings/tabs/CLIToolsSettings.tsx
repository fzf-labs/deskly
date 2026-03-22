import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, RefreshCw, Search, Terminal, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { shell } from '@/lib/electron-api'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/providers/language-provider'
import {
  getLocalizedSystemCliText,
  getSystemCliSearchText,
  isSystemCliToolInstalled,
  normalizeSystemCliTools
} from '@/lib/system-cli-tools'
import {
  type SystemCliToolInfo
} from '../../../../../shared/system-cli-tools'
import { Switch } from '../components/Switch'
import { SystemCliToolDetailDialog } from './SystemCliToolDetailDialog'

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

const statusTone = (tool: SystemCliToolInfo): string => {
  if (tool.installState === 'installed') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
  }
  if (tool.installState === 'checking' || tool.installState === 'unknown') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700'
  }
  return 'border-rose-500/30 bg-rose-500/10 text-rose-600'
}

export function CLIToolsSettings() {
  const { language, t } = useLanguage()
  const [tools, setTools] = useState<SystemCliToolInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | SystemCliToolInfo['category']>('all')
  const [installedOnly, setInstalledOnly] = useState(false)
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
  const summary = useMemo(
    () => ({
      installed: installedTools.length,
      missing: tools.length - installedTools.length,
      total: tools.length
    }),
    [installedTools.length, tools.length]
  )

  const filteredTools = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return tools.filter((tool) => {
      if (installedOnly && !isSystemCliToolInstalled(tool)) {
        return false
      }

      if (activeCategory !== 'all' && tool.category !== activeCategory) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      return getSystemCliSearchText(tool).includes(normalizedQuery)
    })
  }, [activeCategory, installedOnly, searchQuery, tools])

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

  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set(tools.map((tool) => tool.category)))
    return ['all', ...categories] as Array<'all' | SystemCliToolInfo['category']>
  }, [tools])

  const getCategoryLabel = (category: 'all' | SystemCliToolInfo['category']): string => {
    switch (category) {
      case 'media':
        return t.settings.cliToolsCategoryMedia
      case 'data':
        return t.settings.cliToolsCategoryData
      case 'search':
        return t.settings.cliToolsCategorySearch
      case 'download':
        return t.settings.cliToolsCategoryDownload
      case 'document':
        return t.settings.cliToolsCategoryDocument
      default:
        return t.settings.cliToolsFilterAll
    }
  }

  const renderToolCard = (tool: SystemCliToolInfo) => {
    const homepageUrl = tool.homepageUrl

    return (
      <div
        key={tool.id}
        className="border-border bg-background flex flex-col gap-3 rounded-lg border p-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-foreground text-sm font-semibold">{tool.displayName}</h3>
              <span className="text-muted-foreground rounded-full border px-1.5 py-0.5 text-[10px] uppercase">
                {getCategoryLabel(tool.category)}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              {getLocalizedSystemCliText(tool.summary, language)}
            </p>
          </div>
          <span
            className={cn(
              'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
              statusTone(tool)
            )}
          >
            {tool.installState === 'installed'
              ? t.settings.cliToolsInstalled
              : tool.installState === 'checking' || tool.installState === 'unknown'
                ? t.settings.cliToolsDetecting
                : t.settings.cliToolsNotInstalled}
          </span>
        </div>

        <div className="grid gap-2 text-[11px] sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-muted-foreground">{t.settings.cliToolsVersion}</p>
            <p className="text-foreground font-mono">{tool.version || '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">{t.settings.cliToolsPath}</p>
            <p className="text-foreground font-mono break-all">{tool.installPath || '—'}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setSelectedToolId(tool.id)}
          >
            {t.settings.cliToolsDetails}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void openExternalUrl(tool.docsUrl)}
          >
            <ArrowUpRight className="mr-1 size-3.5" />
            {t.settings.cliToolsDocs}
          </Button>
          {homepageUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void openExternalUrl(homepageUrl)}
            >
              <ArrowUpRight className="mr-1 size-3.5" />
              {t.settings.cliToolsHomepage}
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="border-border bg-muted/20 rounded-xl border p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="bg-background text-muted-foreground flex size-9 items-center justify-center rounded-lg border">
                <Wrench className="size-4" />
              </div>
              <div>
                <h2 className="text-foreground text-lg font-semibold">{t.settings.cliToolsTitle}</h2>
                <p className="text-muted-foreground text-sm">{t.settings.cliToolsDescription}</p>
              </div>
            </div>
          </div>

          <Button type="button" variant="outline" onClick={() => void loadTools(true)} disabled={loading}>
            <RefreshCw className={cn('mr-2 size-4', loading && 'animate-spin')} />
            {t.settings.cliToolsRescan}
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="border-border bg-background rounded-lg border px-4 py-3">
            <p className="text-muted-foreground text-xs">{t.settings.cliToolsInstalledCount}</p>
            <p className="text-foreground mt-1 text-2xl font-semibold">{summary.installed}</p>
          </div>
          <div className="border-border bg-background rounded-lg border px-4 py-3">
            <p className="text-muted-foreground text-xs">{t.settings.cliToolsMissingCount}</p>
            <p className="text-foreground mt-1 text-2xl font-semibold">{summary.missing}</p>
          </div>
          <div className="border-border bg-background rounded-lg border px-4 py-3">
            <p className="text-muted-foreground text-xs">{t.settings.cliToolsCatalogCount}</p>
            <p className="text-foreground mt-1 text-2xl font-semibold">{summary.total}</p>
          </div>
        </div>
      </div>

      <div className="border-border bg-background space-y-3 rounded-xl border p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t.settings.cliToolsSearchPlaceholder}
              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring h-9 w-full rounded-lg border py-2 pr-3 pl-9 text-sm focus:ring-2 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 self-start lg:self-auto">
            <span className="text-sm">{t.settings.cliToolsInstalledOnly}</span>
            <Switch checked={installedOnly} onChange={setInstalledOnly} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((category) => {
            const active = activeCategory === category
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-muted/20 text-muted-foreground hover:text-foreground'
                )}
              >
                {getCategoryLabel(category)}
              </button>
            )
          })}
        </div>
      </div>

      {error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">
          {t.settings.cliToolsDetectError}
        </div>
      ) : null}

      {!loading && filteredTools.length === 0 ? (
        <div className="border-border rounded-lg border px-4 py-8 text-center text-sm">
          {t.settings.cliToolsNoResults}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="text-muted-foreground size-4" />
          <h3 className="text-sm font-semibold">{t.settings.cliToolsInstalledSection}</h3>
        </div>

        {loading && tools.length === 0 ? (
          <div className="border-border rounded-lg border px-4 py-6 text-center text-sm">
            {t.settings.cliToolsDetecting}
          </div>
        ) : visibleInstalledTools.length === 0 ? (
          <div className="border-border rounded-lg border px-4 py-6 text-center text-sm">
            {t.settings.cliToolsInstalledEmpty}
          </div>
        ) : <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">{visibleInstalledTools.map(renderToolCard)}</div>}
      </section>

      {!installedOnly ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Wrench className="text-muted-foreground size-4" />
            <h3 className="text-sm font-semibold">{t.settings.cliToolsRecommendedSection}</h3>
          </div>

          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">{recommendedTools.map(renderToolCard)}</div>
        </section>
      ) : null}

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
