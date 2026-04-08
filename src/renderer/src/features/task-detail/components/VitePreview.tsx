import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, ExternalLink, Logs, Maximize2, Play, RefreshCw, Square, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { shell } from '@/lib/electron-api'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/providers/language-provider'
import type { PreviewStatus } from '../hooks/useVitePreview'

interface VitePreviewProps {
  previewUrl: string | null
  status: PreviewStatus
  error: string | null
  outputLines?: string[]
  launchCapability?: 'inline-web' | 'config-only'
  canStart?: boolean
  onStart?: () => void
  onStop?: () => void
  onClose?: () => void
  className?: string
}

export function VitePreview({
  previewUrl,
  status,
  error,
  outputLines = [],
  launchCapability = 'inline-web',
  canStart = true,
  onStart,
  onStop,
  onClose,
  className
}: VitePreviewProps) {
  const { t } = useLanguage()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLogsVisible, setIsLogsVisible] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)

  const handleRefresh = useCallback(() => {
    setIframeKey((current) => current + 1)
  }, [])

  const handleOpenExternal = useCallback(async () => {
    if (!previewUrl) return
    try {
      await shell.openUrl(previewUrl)
    } catch {
      window.open(previewUrl, '_blank')
    }
  }, [previewUrl])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'r') {
        event.preventDefault()
        handleRefresh()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleRefresh])

  const renderBody = () => {
    if (launchCapability === 'config-only') {
      return (
        <StatePanel title={t.preview.previewUnavailable} description={t.preview.configOnlyHint} />
      )
    }

    if (status === 'starting') {
      return <StatePanel title={t.preview.startingServer} description={t.preview.installingDeps} />
    }

    if (status === 'error' && error) {
      return (
        <StatePanel
          icon={<AlertCircle className="size-8 text-red-500" />}
          title={t.preview.previewError}
          description={error}
        />
      )
    }

    if (status === 'running' && !previewUrl) {
      return <StatePanel title={t.preview.livePreview} description={t.preview.portMissingHint} />
    }

    if (status === 'idle' || !previewUrl) {
      return (
        <StatePanel
          title={t.preview.livePreview}
          description={t.preview.livePreviewHint}
        />
      )
    }

    return (
      <div className="flex-1 overflow-hidden bg-white">
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={previewUrl}
          className="h-full w-full border-0"
          title={t.preview.livePreview}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'bg-background flex h-full flex-col',
        isFullscreen && 'fixed inset-0 z-50',
        className
      )}
    >
      <PreviewHeader
        url={previewUrl}
        status={status}
        canStart={canStart}
        isFullscreen={isFullscreen}
        onStart={onStart}
        onRefresh={handleRefresh}
        onOpenExternal={handleOpenExternal}
        onStop={onStop}
        onClose={onClose}
        isLogsVisible={isLogsVisible}
        onToggleLogs={() => setIsLogsVisible((current) => !current)}
        onFullscreen={() => setIsFullscreen((current) => !current)}
      />
      <div className="min-h-0 flex-1">{renderBody()}</div>
      {isLogsVisible ? <PreviewLogs outputLines={outputLines} /> : null}
    </div>
  )
}

function StatePanel({
  icon,
  title,
  description,
  action
}: {
  icon?: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="bg-muted/20 flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="border-border bg-background mb-4 flex size-16 items-center justify-center rounded-xl border">
        {icon || <Play className="text-muted-foreground/50 size-8" />}
      </div>
      <h3 className="text-foreground mb-1 text-sm font-medium">{title}</h3>
      <p className="text-muted-foreground mb-4 max-w-md text-xs">{description}</p>
      {action}
    </div>
  )
}

function PreviewHeader({
  url,
  status,
  canStart,
  isFullscreen,
  onStart,
  onRefresh,
  onOpenExternal,
  onStop,
  onClose,
  isLogsVisible,
  onToggleLogs,
  onFullscreen
}: {
  url: string | null
  status: PreviewStatus
  canStart: boolean
  isFullscreen: boolean
  onStart?: () => void
  onRefresh: () => void
  onOpenExternal: () => void
  onStop?: () => void
  onClose?: () => void
  isLogsVisible: boolean
  onToggleLogs: () => void
  onFullscreen: () => void
}) {
  const { t } = useLanguage()

  return (
    <div className="border-border/50 bg-muted/30 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div
          className={cn(
            'size-2 shrink-0 rounded-full',
            status === 'running' && 'bg-green-500',
            status === 'starting' && 'animate-pulse bg-yellow-500',
            status === 'error' && 'bg-red-500',
            (status === 'idle' || status === 'stopped') && 'bg-gray-400'
          )}
        />
        <span className="text-muted-foreground shrink-0 text-xs font-medium">
          {t.preview.livePreview}
        </span>
        {url ? (
          <>
            <span className="text-muted-foreground/50">|</span>
            <span className="text-muted-foreground truncate text-xs">{url}</span>
          </>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {status !== 'running' && status !== 'starting' && onStart && canStart ? (
          <Button
            type="button"
            size="icon-sm"
            onClick={onStart}
            title={t.preview.startPreview}
            aria-label={t.preview.startPreview}
          >
            <Play className="size-4" />
          </Button>
        ) : null}

        {status === 'running' && onStop ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onStop}
            className="h-8 gap-1.5 border-red-200 px-3 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950"
          >
            <Square className="size-4" />
            {t.preview.stopServer}
          </Button>
        ) : null}

        {status === 'running' ? (
          <button
            onClick={onRefresh}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors"
            title={t.preview.refreshHint}
          >
            <RefreshCw className="size-4" />
          </button>
        ) : null}

        {url ? (
          <button
            onClick={onOpenExternal}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors"
            title={t.preview.openInNewTab}
          >
            <ExternalLink className="size-4" />
          </button>
        ) : null}

        <button
          onClick={onFullscreen}
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors"
          title={isFullscreen ? t.preview.exitFullscreen : t.preview.fullscreen}
        >
          <Maximize2 className="size-4" />
        </button>

        <Button
          type="button"
          size="icon-sm"
          variant={isLogsVisible ? 'secondary' : 'outline'}
          onClick={onToggleLogs}
          title={t.preview.previewLogs}
          aria-label={t.preview.previewLogs}
        >
          <Logs className="size-4" />
        </Button>

        {onClose ? (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors"
            title={t.preview.close}
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function PreviewLogs({ outputLines }: { outputLines: string[] }) {
  const { t } = useLanguage()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    element.scrollTop = element.scrollHeight
  }, [outputLines])

  return (
    <div className="border-border/50 bg-muted/20 flex shrink-0 flex-col border-t">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="text-foreground text-xs font-medium">{t.preview.previewLogs}</div>
        <div className="text-muted-foreground text-[11px]">{t.preview.previewLogsHint}</div>
      </div>
      <div
        ref={containerRef}
        className="bg-background/80 max-h-40 min-h-28 overflow-y-auto border-t px-4 py-3 font-mono text-xs leading-5"
      >
        {outputLines.length === 0 ? (
          <div className="text-muted-foreground whitespace-pre-wrap">
            {t.preview.previewLogsEmpty}
          </div>
        ) : (
          outputLines.map((line, index) => (
            <div key={`${index}-${line}`} className="text-foreground whitespace-pre-wrap break-all">
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
