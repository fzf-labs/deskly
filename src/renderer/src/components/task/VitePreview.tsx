export { VitePreview } from '@features/task-detail'
      {/* Left: Status and URL */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* Status indicator */}
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
        {url && (
          <>
            <span className="text-muted-foreground/50">|</span>
            <span className="text-muted-foreground truncate text-xs">
              {url}
            </span>
          </>
        )}
      </div>

      {/* Right: Action buttons */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Refresh */}
        {status === 'running' && (
          <button
            onClick={onRefresh}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors"
            title={t.preview.refreshHint}
          >
            <RefreshCw className="size-4" />
          </button>
        )}

        {/* Open external */}
        {url && (
          <button
            onClick={onOpenExternal}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors"
            title={t.preview.openInNewTab}
          >
            <ExternalLink className="size-4" />
          </button>
        )}

        {/* Fullscreen */}
        <button
          onClick={onFullscreen}
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors"
          title={isFullscreen ? t.preview.exitFullscreen : t.preview.fullscreen}
        >
          <Maximize2 className="size-4" />
        </button>

        {/* Stop server */}
        {status === 'running' && onStop && (
          <button
            onClick={onStop}
            className="text-muted-foreground flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"
            title={t.preview.stopServer}
          >
            <Square className="size-4" />
          </button>
        )}

        {/* Close */}
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors"
            title={t.preview.close}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
