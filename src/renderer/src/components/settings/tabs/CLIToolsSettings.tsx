import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, RefreshCw, Terminal, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { shell } from '@/lib/electron-api'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/providers/language-provider'
import {
  isSystemCliToolInstalled,
  normalizeSystemCliTools
} from '@/lib/system-cli-tools'
import {
  resolveSystemCliInstallMethods,
  type LocalizedText,
  type SystemCliToolInfo
} from '../../../../../shared/system-cli-tools'

const TOOL_CACHE = {
  tools: null as SystemCliToolInfo[] | null
}

const getLocalizedText = (value: LocalizedText, isZh: boolean): string =>
  isZh ? value.zh : value.en

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
  const isZh = language.startsWith('zh')
  const [tools, setTools] = useState<SystemCliToolInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

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
  const recommendedTools = useMemo(
    () => tools.filter((tool) => !isSystemCliToolInstalled(tool)),
    [tools]
  )
  const summary = useMemo(
    () => ({
      installed: installedTools.length,
      missing: recommendedTools.length,
      total: tools.length
    }),
    [installedTools.length, recommendedTools.length, tools.length]
  )

  const renderToolCard = (tool: SystemCliToolInfo) => {
    const installMethods = resolveSystemCliInstallMethods(tool.installMethods, tool.platform)
    const homepageUrl = tool.homepageUrl

    return (
      <div
        key={tool.id}
        className="border-border bg-muted/20 flex flex-col gap-4 rounded-xl border p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-foreground text-sm font-semibold">{tool.displayName}</h3>
              <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] uppercase">
                {tool.category}
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              {getLocalizedText(tool.summary, isZh)}
            </p>
          </div>
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
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

        <div className="grid gap-3 text-xs sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-muted-foreground">{t.settings.cliToolsVersion}</p>
            <p className="text-foreground font-mono">{tool.version || '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">{t.settings.cliToolsPath}</p>
            <p className="text-foreground font-mono break-all">{tool.installPath || '—'}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t.settings.cliToolsUseCases}</p>
          <ul className="text-muted-foreground space-y-1 text-sm">
            {tool.useCases.map((item) => (
              <li key={`${tool.id}-${item.en}`}>• {getLocalizedText(item, isZh)}</li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t.settings.cliToolsInstallCommand}</p>
          <div className="space-y-2">
            {installMethods.map((method) => (
              <div
                key={`${tool.id}-${method.label}`}
                className="border-border bg-background rounded-lg border px-3 py-2"
              >
                <div className="text-muted-foreground mb-1 text-[11px] uppercase">
                  {method.label}
                </div>
                <code className="text-foreground text-xs font-mono">{method.command}</code>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
    <div className="space-y-6">
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

      {error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">
          {t.settings.cliToolsDetectError}
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
        ) : installedTools.length === 0 ? (
          <div className="border-border rounded-lg border px-4 py-6 text-center text-sm">
            {t.settings.cliToolsInstalledEmpty}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">{installedTools.map(renderToolCard)}</div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Wrench className="text-muted-foreground size-4" />
          <h3 className="text-sm font-semibold">{t.settings.cliToolsRecommendedSection}</h3>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">{recommendedTools.map(renderToolCard)}</div>
      </section>
    </div>
  )
}
