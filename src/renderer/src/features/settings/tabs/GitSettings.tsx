import { useEffect, useState } from 'react'
import { GitBranch, Check, AlertCircle, FolderOpen } from 'lucide-react'
import { useLanguage } from '@/providers/language-provider'
import { path, shell } from '@/lib/electron-api'
import {
  DEFAULT_BRANCH_PREFIX,
  DEFAULT_WORKTREE_PREFIX,
  normalizeBranchPrefix,
  normalizeWorktreePrefix
} from '@shared/task-naming'

import type { SettingsTabProps } from '../types'

const DEFAULT_WORKTREE_DIR = '~/.deskly/worktrees'

export function GitSettings({ settings, onSettingsChange }: SettingsTabProps) {
  const { t } = useLanguage()
  const [installed, setInstalled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [worktreePrefixInput, setWorktreePrefixInput] = useState(
    settings.gitWorktreePrefix || DEFAULT_WORKTREE_PREFIX
  )
  const [worktreePrefixError, setWorktreePrefixError] = useState<string | null>(null)
  const [branchPrefixInput, setBranchPrefixInput] = useState(
    settings.gitBranchPrefix || DEFAULT_BRANCH_PREFIX
  )
  const [branchPrefixError, setBranchPrefixError] = useState<string | null>(null)
  const [worktreeDirInput, setWorktreeDirInput] = useState(
    settings.gitWorktreeDir || DEFAULT_WORKTREE_DIR
  )
  const [worktreeDirError, setWorktreeDirError] = useState<string | null>(null)

  useEffect(() => {
    setWorktreePrefixInput(settings.gitWorktreePrefix || DEFAULT_WORKTREE_PREFIX)
  }, [settings.gitWorktreePrefix])

  useEffect(() => {
    setBranchPrefixInput(settings.gitBranchPrefix || DEFAULT_BRANCH_PREFIX)
  }, [settings.gitBranchPrefix])

  useEffect(() => {
    setWorktreeDirInput(settings.gitWorktreeDir || DEFAULT_WORKTREE_DIR)
  }, [settings.gitWorktreeDir])

  useEffect(() => {
    let mounted = true
    const checkInstalled = async () => {
      setLoading(true)
      try {
        const result = await window.api?.git?.checkInstalled?.()
        const isInstalled =
          typeof result === 'boolean'
            ? result
            : Boolean((result as { data?: boolean } | undefined)?.data)
        console.info('[GitSettings] Git checkInstalled result:', result)
        if (mounted) setInstalled(isInstalled)
      } catch (error) {
        console.error('[GitSettings] Failed to check git install status:', error)
        if (mounted) setInstalled(false)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void checkInstalled()
    return () => {
      mounted = false
    }
  }, [])

  const statusLabel = loading
    ? t.settings?.gitChecking || 'Checking...'
    : installed
      ? t.settings?.gitInstalled || 'Installed'
      : t.settings?.gitNotInstalled || 'Not installed'

  const handleWorktreePrefixChange = (value: string) => {
    setWorktreePrefixInput(value)
    const trimmed = value.trim()
    if (!trimmed) {
      setWorktreePrefixError(
        t.settings?.gitWorktreePrefixError || 'Worktree prefix cannot be empty.'
      )
      return
    }

    setWorktreePrefixError(null)
    onSettingsChange({
      ...settings,
      gitWorktreePrefix: normalizeWorktreePrefix(trimmed)
    })
  }

  const handleWorktreePrefixBlur = () => {
    const trimmed = worktreePrefixInput.trim()
    if (!trimmed) {
      setWorktreePrefixInput(settings.gitWorktreePrefix || DEFAULT_WORKTREE_PREFIX)
      setWorktreePrefixError(
        t.settings?.gitWorktreePrefixError || 'Worktree prefix cannot be empty.'
      )
      return
    }

    const normalized = normalizeWorktreePrefix(trimmed)
    if (normalized !== worktreePrefixInput) {
      setWorktreePrefixInput(normalized)
    }
    if (normalized !== settings.gitWorktreePrefix) {
      onSettingsChange({ ...settings, gitWorktreePrefix: normalized })
    }
    setWorktreePrefixError(null)
  }

  const handleBranchPrefixChange = (value: string) => {
    setBranchPrefixInput(value)
    const trimmed = value.trim()
    if (!trimmed) {
      setBranchPrefixError(
        t.settings?.gitBranchPrefixError || 'Branch prefix cannot be empty.'
      )
      return
    }

    setBranchPrefixError(null)
    onSettingsChange({
      ...settings,
      gitBranchPrefix: normalizeBranchPrefix(trimmed)
    })
  }

  const handleBranchPrefixBlur = () => {
    const trimmed = branchPrefixInput.trim()
    if (!trimmed) {
      setBranchPrefixInput(settings.gitBranchPrefix || DEFAULT_BRANCH_PREFIX)
      setBranchPrefixError(
        t.settings?.gitBranchPrefixError || 'Branch prefix cannot be empty.'
      )
      return
    }

    const normalized = normalizeBranchPrefix(trimmed)
    if (normalized !== branchPrefixInput) {
      setBranchPrefixInput(normalized)
    }
    if (normalized !== settings.gitBranchPrefix) {
      onSettingsChange({ ...settings, gitBranchPrefix: normalized })
    }
    setBranchPrefixError(null)
  }

  const handleWorktreeDirChange = (value: string) => {
    setWorktreeDirInput(value)
    const trimmed = value.trim()
    if (!trimmed) {
      setWorktreeDirError(
        t.settings?.gitWorktreeDirError || 'Directory cannot be empty.'
      )
      return
    }
    setWorktreeDirError(null)
    onSettingsChange({ ...settings, gitWorktreeDir: trimmed })
  }

  const handleWorktreeDirBlur = () => {
    const trimmed = worktreeDirInput.trim()
    if (!trimmed) {
      setWorktreeDirInput(settings.gitWorktreeDir || DEFAULT_WORKTREE_DIR)
      setWorktreeDirError(
        t.settings?.gitWorktreeDirError || 'Directory cannot be empty.'
      )
      return
    }
    if (trimmed !== worktreeDirInput) {
      setWorktreeDirInput(trimmed)
      onSettingsChange({ ...settings, gitWorktreeDir: trimmed })
    }
    setWorktreeDirError(null)
  }

  const openWorktreeDir = async () => {
    const trimmed = worktreeDirInput.trim()
    if (!trimmed) return
    try {
      let resolved = trimmed
      if (resolved.startsWith('~')) {
        const homeDir = await path.homeDir()
        resolved =
          resolved === '~' ? homeDir : resolved.replace(/^~(?=\/)/, homeDir)
      }
      await shell.openPath(resolved)
    } catch (error) {
      console.error('[GitSettings] Failed to open worktree dir:', error)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        {t.settings?.gitDescription ||
          'Check Git installation status and configure branch and worktree naming.'}
      </p>

      <div className="border-border rounded-lg border p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-muted/60 text-muted-foreground flex size-9 items-center justify-center rounded-md">
              <GitBranch className="size-4" />
            </div>
            <div>
              <p className="text-foreground text-sm font-medium">
                {t.settings?.gitInstallStatus || 'Git Installation'}
              </p>
              <p className="text-muted-foreground text-xs">
                {t.settings?.gitInstallStatusDesc ||
                  'Detects whether Git is available on this machine.'}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
              loading
                ? 'border-muted-foreground/30 bg-muted/40 text-muted-foreground'
                : installed
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-600'
            }`}
          >
            {loading ? null : installed ? (
              <Check className="size-3" />
            ) : (
              <AlertCircle className="size-3" />
            )}
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-foreground block text-sm font-medium">
          {t.settings?.gitWorktreePrefixLabel || 'Worktree Prefix'}
        </label>
        <input
          type="text"
          value={worktreePrefixInput}
          placeholder={t.settings?.gitWorktreePrefixPlaceholder || 'e.g., wt'}
          onChange={(event) => handleWorktreePrefixChange(event.target.value)}
          onBlur={handleWorktreePrefixBlur}
          className="border-input bg-background text-foreground focus:ring-ring block h-10 w-full max-w-sm rounded-lg border px-3 text-sm focus:border-transparent focus:ring-2 focus:outline-none"
        />
        <p className="text-muted-foreground text-sm">
          {t.settings?.gitWorktreePrefixDesc ||
            'Prefix used when creating new Git worktree directories.'}
        </p>
        {worktreePrefixError && (
          <p className="text-destructive text-xs">{worktreePrefixError}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-foreground block text-sm font-medium">
          {t.settings?.gitBranchPrefixLabel || 'Branch Prefix'}
        </label>
        <input
          type="text"
          value={branchPrefixInput}
          placeholder={t.settings?.gitBranchPrefixPlaceholder || 'e.g., feature'}
          onChange={(event) => handleBranchPrefixChange(event.target.value)}
          onBlur={handleBranchPrefixBlur}
          className="border-input bg-background text-foreground focus:ring-ring block h-10 w-full max-w-sm rounded-lg border px-3 text-sm focus:border-transparent focus:ring-2 focus:outline-none"
        />
        <p className="text-muted-foreground text-sm">
          {t.settings?.gitBranchPrefixDesc ||
            'Prefix used when creating new Git branches.'}
        </p>
        {branchPrefixError && (
          <p className="text-destructive text-xs">{branchPrefixError}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-foreground block text-sm font-medium">
          {t.settings?.gitWorktreeDirLabel || 'Worktree Directory'}
        </label>
        <div className="flex w-full max-w-sm items-center gap-2">
          <input
            type="text"
            value={worktreeDirInput}
            placeholder={
              t.settings?.gitWorktreeDirPlaceholder || DEFAULT_WORKTREE_DIR
            }
            onChange={(event) => handleWorktreeDirChange(event.target.value)}
            onBlur={handleWorktreeDirBlur}
            className="border-input bg-background text-foreground focus:ring-ring block h-10 w-full rounded-lg border px-3 text-sm focus:border-transparent focus:ring-2 focus:outline-none"
          />
          <button
            type="button"
            onClick={openWorktreeDir}
            disabled={!worktreeDirInput.trim()}
            className="border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors"
            title={t.settings?.gitWorktreeDirOpen || 'Open folder'}
            aria-label={t.settings?.gitWorktreeDirOpen || 'Open folder'}
          >
            <FolderOpen className="size-4" />
          </button>
        </div>
        <p className="text-muted-foreground text-sm">
          {t.settings?.gitWorktreeDirDesc ||
            'Directory used to create new Git worktrees.'}
        </p>
        {worktreeDirError && (
          <p className="text-destructive text-xs">{worktreeDirError}</p>
        )}
      </div>
    </div>
  )
}
