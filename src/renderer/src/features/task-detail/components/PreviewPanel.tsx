import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Edit3, Plus, Settings2, Sparkles, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/providers/language-provider'

import { useVitePreview, type SavePreviewConfigInput } from '../hooks/useVitePreview'
import { canOpenInlinePreview, formatCommandLine, splitCommandLine } from '../model/preview'
import { VitePreview } from './VitePreview'

interface PreviewPanelProps {
  taskId: string | null
  projectId: string | null
  workingDir: string | null
  workspacePath: string | null
  isVisible: boolean
}

interface PreviewConfigDialogState {
  editingId: string | null
  name: string
  commandLine: string
  cwd: string
  port: string
}

type ConfigDialogMode = 'manage' | 'form'

const EMPTY_DIALOG_STATE: PreviewConfigDialogState = {
  editingId: null,
  name: '',
  commandLine: '',
  cwd: '',
  port: ''
}

const buildDialogState = (
  config?: {
    id: string
    name: string
    command: string
    args: string[]
    cwd?: string | null
    port?: number | null
  } | null
): PreviewConfigDialogState => {
  if (!config) return EMPTY_DIALOG_STATE

  return {
    editingId: config.id,
    name: config.name,
    commandLine: formatCommandLine(config.command, config.args),
    cwd: config.cwd ?? '',
    port: config.port ? String(config.port) : ''
  }
}

export function PreviewPanel({
  taskId,
  projectId,
  workingDir,
  workspacePath,
  isVisible
}: PreviewPanelProps) {
  const { t } = useLanguage()
  const preview = useVitePreview({
    taskId,
    projectId,
    workingDir,
    workspacePath,
    isVisible
  })
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<ConfigDialogMode>('manage')
  const [managerSelectedId, setManagerSelectedId] = useState('')
  const [dialogState, setDialogState] = useState<PreviewConfigDialogState>(EMPTY_DIALOG_STATE)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const managerSelectedConfig = useMemo(
    () => preview.configs.find((config) => config.id === managerSelectedId) ?? null,
    [managerSelectedId, preview.configs]
  )

  const syncSummaryText = useMemo(() => {
    if (!preview.syncResult) {
      return null
    }

    return [
      `${t.preview.detectAdded}: ${preview.syncResult.added.length}`,
      `${t.preview.detectUpdated}: ${preview.syncResult.updated.length}`,
      `${t.preview.detectDeleted}: ${preview.syncResult.deleted.length}`,
      `${t.preview.detectSkipped}: ${preview.syncResult.skipped.length}`
    ].join(' · ')
  }, [
    preview.syncResult,
    t.preview.detectAdded,
    t.preview.detectDeleted,
    t.preview.detectSkipped,
    t.preview.detectUpdated
  ])

  useEffect(() => {
    if (!isDialogOpen) {
      return
    }

    setManagerSelectedId((current) => {
      if (current && preview.configs.some((config) => config.id === current)) {
        return current
      }

      if (
        preview.selectedConfigId &&
        preview.configs.some((config) => config.id === preview.selectedConfigId)
      ) {
        return preview.selectedConfigId
      }

      return preview.configs[0]?.id ?? ''
    })
  }, [isDialogOpen, preview.configs, preview.selectedConfigId])

  const openConfigManager = () => {
    setDialogMode('manage')
    setDialogError(null)
    setManagerSelectedId(preview.selectedConfigId || preview.configs[0]?.id || '')
    setIsDialogOpen(true)
  }

  const openCreateDialog = () => {
    setDialogMode('form')
    setDialogState(EMPTY_DIALOG_STATE)
    setDialogError(null)
    setIsDialogOpen(true)
  }

  const openEditDialog = (config = managerSelectedConfig) => {
    if (!config) return
    setDialogMode('form')
    setDialogState(buildDialogState(config))
    setDialogError(null)
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    const parts = splitCommandLine(dialogState.commandLine)
    if (!dialogState.name.trim()) {
      setDialogError(t.preview.configNameRequired)
      return
    }

    if (parts.length === 0) {
      setDialogError(t.preview.commandRequired)
      return
    }

    const [command, ...args] = parts
    const parsedPort = dialogState.port.trim() ? Number(dialogState.port.trim()) : null
    if (
      dialogState.port.trim() &&
      (parsedPort === null || !Number.isInteger(parsedPort) || parsedPort <= 0)
    ) {
      setDialogError(t.preview.portInvalid)
      return
    }

    const payload: SavePreviewConfigInput = {
      name: dialogState.name.trim(),
      command,
      args,
      cwd: dialogState.cwd.trim() || null,
      port: parsedPort
    }

    setIsSaving(true)
    setDialogError(null)
    try {
      const savedConfig = await preview.saveConfig(payload, dialogState.editingId)
      setManagerSelectedId(savedConfig.id)
      setDialogMode('manage')
      setDialogState(EMPTY_DIALOG_STATE)
    } catch (saveError) {
      setDialogError(saveError instanceof Error ? saveError.message : String(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (config = managerSelectedConfig) => {
    if (!config) return

    const confirmed = window.confirm(t.preview.deleteConfigConfirm.replace('{name}', config.name))
    if (!confirmed) return

    await preview.deleteConfig(config.id)
  }

  const handleUseConfig = async () => {
    if (!managerSelectedConfig) {
      return
    }

    await preview.selectConfig(managerSelectedConfig.id)
    setIsDialogOpen(false)
  }

  const handleDetectConfigs = async () => {
    await preview.detectAndSync()
    setDialogMode('manage')
  }

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      setDialogMode('manage')
      setDialogError(null)
      setDialogState(EMPTY_DIALOG_STATE)
    }
  }

  if (!projectId) {
    return (
      <PreviewStateCard title={t.preview.noProjectTitle} description={t.preview.noProjectHint} />
    )
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="border-border/60 bg-background/80 flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-foreground flex items-center gap-2 text-sm font-medium">
              <span className="truncate">
                {preview.selectedConfig?.name || t.preview.selectConfigTitle}
              </span>
              {preview.selectedConfig ? (
                <>
                  <InlineBadge
                    tone={preview.selectedConfig.ownership === 'ai-managed' ? 'violet' : 'slate'}
                  >
                    {preview.selectedConfig.ownership === 'ai-managed'
                      ? t.preview.aiManagedBadge
                      : t.preview.manualBadge}
                  </InlineBadge>
                  <InlineBadge
                    tone={
                      preview.selectedConfig.launchCapability === 'inline-web' ? 'emerald' : 'amber'
                    }
                  >
                    {preview.selectedConfig.launchCapability === 'inline-web'
                      ? t.preview.inlineWebBadge
                      : t.preview.configOnlyBadge}
                  </InlineBadge>
                  {preview.activeConfigId === preview.selectedConfig.id &&
                  preview.status === 'running' ? (
                    <InlineBadge tone="emerald">{t.preview.activeBadge}</InlineBadge>
                  ) : null}
                </>
              ) : null}
            </div>
            <div className="text-muted-foreground mt-1 truncate text-xs">
              {preview.selectedConfig
                ? formatCommandLine(preview.selectedConfig.command, preview.selectedConfig.args)
                : t.preview.previewConfigsHint}
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={openConfigManager}>
            <Settings2 className="size-4" />
            {t.preview.manageConfigs}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {preview.configs.length === 0 ? (
            <PreviewStateCard
              title={t.preview.noConfigsTitle}
              description={t.preview.noConfigsHint}
              action={
                <Button type="button" onClick={openConfigManager}>
                  <Settings2 className="size-4" />
                  {t.preview.manageConfigs}
                </Button>
              }
            />
          ) : !preview.selectedConfig ? (
            <PreviewStateCard
              title={t.preview.selectConfigTitle}
              description={t.preview.selectConfigHint}
              action={
                <Button type="button" onClick={openConfigManager}>
                  <Settings2 className="size-4" />
                  {t.preview.manageConfigs}
                </Button>
              }
            />
          ) : (
            <VitePreview
              className={cn('min-h-0 h-full', preview.isLoadingConfigs && 'opacity-80')}
              previewUrl={preview.previewUrl}
              status={preview.status}
              error={preview.error}
              outputLines={preview.outputLines}
              launchCapability={preview.selectedConfig.launchCapability}
              canStart={canOpenInlinePreview(preview.selectedConfig)}
              onStart={() => void preview.startPreview()}
              onStop={() => void preview.stopPreview()}
            />
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-4xl">
          {dialogMode === 'manage' ? (
            <>
              <DialogHeader>
                <DialogTitle>{t.preview.manageConfigsTitle}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-muted-foreground text-sm">{t.preview.manageConfigsHint}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleDetectConfigs()}
                      disabled={!preview.canDetectConfigs || preview.isDetectingConfigs}
                      title={
                        !preview.canDetectConfigs ? t.preview.detectWorkspaceRequired : undefined
                      }
                    >
                      <Sparkles className="size-4" />
                      {preview.isDetectingConfigs
                        ? t.preview.detectingConfigs
                        : t.preview.detectConfigs}
                    </Button>
                    <Button type="button" size="sm" onClick={openCreateDialog}>
                      <Plus className="size-4" />
                      {t.preview.addConfig}
                    </Button>
                  </div>
                </div>

                {!preview.canDetectConfigs ? (
                  <StatusNotice tone="info" title={t.preview.detectWorkspaceRequired} />
                ) : null}

                {preview.detectError ? (
                  <StatusNotice tone="error" title={t.preview.detectFailedTitle}>
                    {preview.detectError}
                  </StatusNotice>
                ) : null}

                {preview.syncResult ? (
                  <StatusNotice tone="info" title={t.preview.detectSummaryTitle}>
                    <div>{syncSummaryText}</div>
                    {preview.syncResult.skipped[0] ? (
                      <div className="mt-1">{preview.syncResult.skipped[0].reason}</div>
                    ) : null}
                  </StatusNotice>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div className="space-y-2">
                    <div className="text-foreground text-sm font-medium">
                      {t.preview.previewConfigs}
                    </div>
                    {preview.configs.length === 0 ? (
                      <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-sm">
                        {t.preview.noConfigsHint}
                      </div>
                    ) : (
                      <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                        {preview.configs.map((config) => {
                          const isSelected = config.id === managerSelectedId
                          return (
                            <button
                              key={config.id}
                              type="button"
                              onClick={() => setManagerSelectedId(config.id)}
                              className={cn(
                                'w-full rounded-lg border px-3 py-3 text-left transition-colors',
                                isSelected
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border/60 hover:bg-muted/40'
                              )}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                                  {config.name}
                                </span>
                                <InlineBadge
                                  tone={config.ownership === 'ai-managed' ? 'violet' : 'slate'}
                                >
                                  {config.ownership === 'ai-managed'
                                    ? t.preview.aiManagedBadge
                                    : t.preview.manualBadge}
                                </InlineBadge>
                                <InlineBadge
                                  tone={
                                    config.launchCapability === 'inline-web' ? 'emerald' : 'amber'
                                  }
                                >
                                  {config.launchCapability === 'inline-web'
                                    ? t.preview.inlineWebBadge
                                    : t.preview.configOnlyBadge}
                                </InlineBadge>
                                {config.lastUsedAt ? (
                                  <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                                    {t.preview.lastUsedBadge}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-muted-foreground mt-2 truncate text-xs">
                                {formatCommandLine(config.command, config.args)}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 rounded-lg border border-border/60 px-4 py-4">
                    {managerSelectedConfig ? (
                      <>
                        <div>
                          <div className="text-foreground text-sm font-medium">
                            {managerSelectedConfig.name}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <InlineBadge
                              tone={
                                managerSelectedConfig.ownership === 'ai-managed'
                                  ? 'violet'
                                  : 'slate'
                              }
                            >
                              {managerSelectedConfig.ownership === 'ai-managed'
                                ? t.preview.aiManagedBadge
                                : t.preview.manualBadge}
                            </InlineBadge>
                            <InlineBadge
                              tone={
                                managerSelectedConfig.launchCapability === 'inline-web'
                                  ? 'emerald'
                                  : 'amber'
                              }
                            >
                              {managerSelectedConfig.launchCapability === 'inline-web'
                                ? t.preview.inlineWebBadge
                                : t.preview.configOnlyBadge}
                            </InlineBadge>
                          </div>
                        </div>

                        <div className="text-muted-foreground grid gap-2 text-xs">
                          <div>
                            <span className="font-medium">{t.preview.commandLineLabel}：</span>
                            {formatCommandLine(
                              managerSelectedConfig.command,
                              managerSelectedConfig.args
                            )}
                          </div>
                          <div>
                            <span className="font-medium">{t.preview.cwdLabel}：</span>
                            {managerSelectedConfig.cwd ||
                              workingDir ||
                              t.preview.defaultWorkspaceCwd}
                          </div>
                          <div>
                            <span className="font-medium">{t.preview.portLabel}：</span>
                            {managerSelectedConfig.port || t.preview.portUnset}
                          </div>
                          {managerSelectedConfig.launchCapability === 'config-only' ? (
                            <div className="text-amber-600 dark:text-amber-400">
                              {t.preview.configOnlyHint}
                            </div>
                          ) : !managerSelectedConfig.port ? (
                            <div className="text-amber-600 dark:text-amber-400">
                              {t.preview.portMissingHint}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(managerSelectedConfig)}
                          >
                            <Edit3 className="size-4" />
                            {t.preview.editConfig}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleDelete(managerSelectedConfig)}
                          >
                            <Trash2 className="size-4" />
                            {t.preview.deleteConfig}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-muted-foreground text-sm">
                        {t.preview.selectConfigHint}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t.common.close}
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleUseConfig()}
                  disabled={!managerSelectedConfig}
                >
                  {t.preview.useConfig}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  {dialogState.editingId ? t.preview.editConfigTitle : t.preview.addConfigTitle}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.preview.configNameLabel}</label>
                  <input
                    value={dialogState.name}
                    onChange={(event) =>
                      setDialogState((current) => ({
                        ...current,
                        name: event.target.value
                      }))
                    }
                    className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
                    placeholder={t.preview.configNamePlaceholder}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.preview.commandLineLabel}</label>
                  <input
                    value={dialogState.commandLine}
                    onChange={(event) =>
                      setDialogState((current) => ({
                        ...current,
                        commandLine: event.target.value
                      }))
                    }
                    className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
                    placeholder={t.preview.commandLinePlaceholder}
                  />
                  <p className="text-muted-foreground text-xs">{t.preview.commandLineHint}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t.preview.cwdLabel}</label>
                    <input
                      value={dialogState.cwd}
                      onChange={(event) =>
                        setDialogState((current) => ({
                          ...current,
                          cwd: event.target.value
                        }))
                      }
                      className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
                      placeholder={workingDir || t.preview.cwdPlaceholder}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t.preview.portLabel}</label>
                    <input
                      value={dialogState.port}
                      onChange={(event) =>
                        setDialogState((current) => ({
                          ...current,
                          port: event.target.value
                        }))
                      }
                      className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
                      inputMode="numeric"
                      placeholder={t.preview.portPlaceholder}
                    />
                  </div>
                </div>

                {dialogError ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {dialogError}
                  </div>
                ) : null}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogMode('manage')}>
                  {t.preview.backToConfigList}
                </Button>
                <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
                  {dialogState.editingId ? t.common.save : t.preview.addConfig}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function PreviewStateCard({
  title,
  description,
  action
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="bg-muted/10 flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="text-foreground text-sm font-medium">{title}</div>
      <div className="text-muted-foreground mt-1 max-w-md text-xs">{description}</div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

function InlineBadge({
  children,
  tone
}: {
  children: ReactNode
  tone: 'amber' | 'emerald' | 'slate' | 'violet'
}) {
  const toneClassName =
    tone === 'emerald'
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : tone === 'amber'
        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : tone === 'violet'
          ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
          : 'bg-muted text-muted-foreground'

  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', toneClassName)}>
      {children}
    </span>
  )
}

function StatusNotice({
  title,
  children,
  tone = 'info'
}: {
  title: string
  children?: ReactNode
  tone?: 'error' | 'info'
}) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2 text-xs',
        tone === 'error'
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-border/60 bg-muted/40 text-muted-foreground'
      )}
    >
      <div className="text-foreground font-medium">{title}</div>
      {children ? <div className="mt-1">{children}</div> : null}
    </div>
  )
}
