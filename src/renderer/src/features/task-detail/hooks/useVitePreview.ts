import { useCallback, useEffect, useMemo, useState } from 'react'

import type {
  CreatePreviewConfigInput,
  PreviewConfig,
  PreviewConfigSyncResult,
  PreviewInstance,
  UpdatePreviewConfigInput
} from '@shared/contracts/preview'

import {
  canOpenInlinePreview,
  getPreviewInstanceId,
  resolvePreviewWorkingDir,
  resolveSelectedPreviewConfigId,
  selectDefaultPreviewConfig
} from '../model/preview'

export type PreviewStatus = 'idle' | 'starting' | 'running' | 'error' | 'stopped'

export interface PreviewState {
  previewUrl: string | null
  status: PreviewStatus
  error: string | null
  hostPort: number | null
  activeConfigId: string | null
  outputLines: string[]
}

export interface SavePreviewConfigInput {
  name: string
  command: string
  args: string[]
  cwd?: string | null
  port?: number | null
}

export interface UseVitePreviewReturn extends PreviewState {
  configs: PreviewConfig[]
  isLoadingConfigs: boolean
  isDetectingConfigs: boolean
  isProjectScoped: boolean
  selectedConfigId: string
  selectedConfig: PreviewConfig | null
  syncResult: PreviewConfigSyncResult | null
  detectError: string | null
  canDetectConfigs: boolean
  reloadConfigs: (preferredConfigId?: string | null) => Promise<void>
  refreshStatus: () => Promise<void>
  refreshOutput: () => Promise<void>
  detectAndSync: () => Promise<void>
  selectConfig: (configId: string) => Promise<void>
  saveConfig: (input: SavePreviewConfigInput, editingId?: string | null) => Promise<PreviewConfig>
  deleteConfig: (configId: string) => Promise<void>
  startPreview: (configId?: string) => Promise<void>
  stopPreview: () => Promise<void>
}

interface UseVitePreviewInput {
  taskId: string | null
  projectId: string | null
  workingDir: string | null
  workspacePath: string | null
  isVisible: boolean
}

const PREVIEW_OUTPUT_LIMIT = 200
const PREVIEW_POLL_INTERVAL_MS = 1500

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const toPreviewStatus = (status?: PreviewInstance['status'] | null): PreviewStatus => {
  if (!status || status === 'stopped' || status === 'stopping') {
    return 'idle'
  }

  return status as PreviewStatus
}

export function useVitePreview({
  taskId,
  projectId,
  workingDir,
  workspacePath,
  isVisible
}: UseVitePreviewInput): UseVitePreviewReturn {
  const [configs, setConfigs] = useState<PreviewConfig[]>([])
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false)
  const [isDetectingConfigs, setIsDetectingConfigs] = useState(false)
  const [selectedConfigId, setSelectedConfigId] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<PreviewStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [detectError, setDetectError] = useState<string | null>(null)
  const [hostPort, setHostPort] = useState<number | null>(null)
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null)
  const [outputLines, setOutputLines] = useState<string[]>([])
  const [syncResult, setSyncResult] = useState<PreviewConfigSyncResult | null>(null)

  const isProjectScoped = Boolean(projectId)
  const canDetectConfigs = Boolean(
    projectId && workspacePath && window.api?.previewConfig?.detectAndSync
  )
  const instanceId = useMemo(
    () => (projectId ? getPreviewInstanceId(projectId) : null),
    [projectId]
  )

  const applyInstance = useCallback((instance: PreviewInstance | null) => {
    if (!instance) {
      setStatus('idle')
      setPreviewUrl(null)
      setHostPort(null)
      setActiveConfigId(null)
      setError(null)
      setOutputLines([])
      return
    }

    const nextPort = typeof instance.port === 'number' ? instance.port : null
    setStatus(toPreviewStatus(instance.status))
    setPreviewUrl(nextPort ? `http://localhost:${nextPort}` : null)
    setHostPort(nextPort)
    setActiveConfigId(instance.configId ?? null)
    setError(instance.error ?? null)
  }, [])

  const reloadConfigs = useCallback(
    async (preferredConfigId?: string | null) => {
      if (!projectId || !window.api?.previewConfig?.getByProject) {
        setConfigs([])
        setSelectedConfigId('')
        return
      }

      setIsLoadingConfigs(true)
      try {
        const nextConfigs = await window.api.previewConfig.getByProject(projectId)
        setConfigs(nextConfigs)
        setSelectedConfigId((previous) =>
          resolveSelectedPreviewConfigId(nextConfigs, previous, preferredConfigId)
        )
      } finally {
        setIsLoadingConfigs(false)
      }
    },
    [projectId]
  )

  const refreshStatus = useCallback(async () => {
    if (!instanceId || !window.api?.preview?.getInstance) {
      applyInstance(null)
      return
    }

    try {
      const instance = await window.api.preview.getInstance(instanceId)
      applyInstance(instance)
    } catch (refreshError) {
      console.error('[useVitePreview] Error fetching preview status:', refreshError)
      setStatus('error')
      setError(toErrorMessage(refreshError))
      setPreviewUrl(null)
      setHostPort(null)
      setActiveConfigId(null)
    }
  }, [applyInstance, instanceId])

  const refreshOutput = useCallback(async () => {
    if (!instanceId || !window.api?.preview?.getOutput) {
      setOutputLines([])
      return
    }

    try {
      const lines = await window.api.preview.getOutput(instanceId, PREVIEW_OUTPUT_LIMIT)
      setOutputLines(lines)
    } catch (refreshError) {
      console.error('[useVitePreview] Error fetching preview logs:', refreshError)
    }
  }, [instanceId])

  const selectedConfig = useMemo(
    () => configs.find((config) => config.id === selectedConfigId) ?? null,
    [configs, selectedConfigId]
  )

  const markConfigAsLastUsed = useCallback(
    async (configId: string) => {
      if (!window.api?.previewConfig?.update) {
        return
      }

      await window.api.previewConfig.update(configId, { lastUsedAt: new Date().toISOString() })
      await reloadConfigs(configId)
    },
    [reloadConfigs]
  )

  const startPreview = useCallback(
    async (configId?: string) => {
      if (!projectId || !instanceId || !window.api?.preview?.start) {
        setStatus('error')
        setError('Preview is unavailable for tasks without a project context.')
        return
      }

      const targetConfig = configs.find((config) => config.id === (configId ?? selectedConfigId))
      if (!targetConfig) {
        setStatus('error')
        setError('No preview configuration selected.')
        return
      }

      if (!canOpenInlinePreview(targetConfig)) {
        setStatus('idle')
        setError(null)
        setPreviewUrl(null)
        setHostPort(null)
        setActiveConfigId(null)
        return
      }

      setSelectedConfigId(targetConfig.id)
      setStatus('starting')
      setError(null)

      try {
        await window.api.preview.start(
          instanceId,
          targetConfig.id,
          targetConfig.command,
          targetConfig.args,
          targetConfig.port,
          resolvePreviewWorkingDir(targetConfig.cwd, workingDir),
          targetConfig.env
        )

        await markConfigAsLastUsed(targetConfig.id)
        await Promise.all([refreshStatus(), refreshOutput()])
      } catch (startError) {
        const nextError = toErrorMessage(startError)
        setStatus('error')
        setError(nextError)
        setPreviewUrl(null)
        setHostPort(null)
        setActiveConfigId(null)

        try {
          if (window.api?.preview?.getInstance) {
            applyInstance(await window.api.preview.getInstance(instanceId))
          }
          await refreshOutput()
        } catch {
          // Ignore follow-up refresh failures after the primary start error.
        }
      }
    },
    [
      applyInstance,
      configs,
      instanceId,
      markConfigAsLastUsed,
      projectId,
      refreshOutput,
      refreshStatus,
      selectedConfigId,
      workingDir
    ]
  )

  const stopPreview = useCallback(async () => {
    if (!instanceId || !window.api?.preview?.stop) {
      applyInstance(null)
      return
    }

    try {
      await window.api.preview.stop(instanceId)
      await Promise.all([refreshStatus(), refreshOutput()])
    } catch (stopError) {
      console.error('[useVitePreview] Stop error:', stopError)
      setStatus('error')
      setError(toErrorMessage(stopError))
    }
  }, [applyInstance, instanceId, refreshOutput, refreshStatus])

  const selectConfig = useCallback(
    async (configId: string) => {
      setSelectedConfigId(configId)

      const targetConfig = configs.find((config) => config.id === configId)
      if (!targetConfig) {
        return
      }

      await markConfigAsLastUsed(configId)

      if (activeConfigId && activeConfigId !== configId) {
        await stopPreview()
        return
      }

      if (!canOpenInlinePreview(targetConfig)) {
        if (activeConfigId) {
          await stopPreview()
        } else {
          await Promise.all([refreshStatus(), refreshOutput()])
        }
      }
    },
    [activeConfigId, configs, markConfigAsLastUsed, refreshOutput, refreshStatus, stopPreview]
  )

  const saveConfig = useCallback(
    async (input: SavePreviewConfigInput, editingId?: string | null) => {
      if (!projectId || !window.api?.previewConfig) {
        throw new Error('Preview is unavailable for tasks without a project context.')
      }

      const basePayload = {
        name: input.name,
        command: input.command,
        args: input.args,
        cwd: input.cwd?.trim() ? input.cwd.trim() : null,
        port: input.port ?? null
      }
      const editingConfig = editingId
        ? (configs.find((config) => config.id === editingId) ?? null)
        : null
      const convertsAiManagedConfig = editingConfig?.ownership === 'ai-managed'

      const savedConfig = editingId
        ? await window.api.previewConfig.update(editingId, {
            ...(basePayload as UpdatePreviewConfigInput),
            ownership: convertsAiManagedConfig ? 'manual' : undefined,
            detectionKey: convertsAiManagedConfig ? null : undefined,
            detectionSignature: convertsAiManagedConfig ? null : undefined,
            detectionSource: convertsAiManagedConfig ? null : undefined
          })
        : await window.api.previewConfig.add({
            ...(basePayload as Omit<CreatePreviewConfigInput, 'projectId'>),
            projectId,
            type: 'frontend',
            ownership: 'manual',
            launchCapability: 'inline-web',
            detectionKey: null,
            detectionSignature: null,
            detectionSource: null
          })

      await reloadConfigs(savedConfig.id)
      setSelectedConfigId(savedConfig.id)
      return savedConfig
    },
    [configs, projectId, reloadConfigs]
  )

  const deleteConfig = useCallback(
    async (configId: string) => {
      if (!projectId || !window.api?.previewConfig?.delete) {
        return
      }

      if (instanceId && window.api?.preview?.getInstance) {
        const instance = await window.api.preview.getInstance(instanceId)
        if (instance?.configId === configId) {
          await stopPreview()
        }
      }

      await window.api.previewConfig.delete(configId)
      await reloadConfigs()
      await Promise.all([refreshStatus(), refreshOutput()])
    },
    [instanceId, projectId, refreshOutput, refreshStatus, reloadConfigs, stopPreview]
  )

  const detectAndSync = useCallback(async () => {
    if (!projectId || !workspacePath || !window.api?.previewConfig?.detectAndSync) {
      const nextError = 'Project workspace is required for AI preview detection.'
      setDetectError(nextError)
      throw new Error(nextError)
    }

    setIsDetectingConfigs(true)
    setDetectError(null)
    try {
      const nextSyncResult = await window.api.previewConfig.detectAndSync(projectId, workspacePath)
      setSyncResult(nextSyncResult)
      await reloadConfigs()

      if (instanceId && window.api?.preview?.getInstance) {
        const instance = await window.api.preview.getInstance(instanceId)
        const activeConfig = nextSyncResult.configs.find(
          (config) => config.id === instance?.configId
        )

        if (instance?.configId && !canOpenInlinePreview(activeConfig)) {
          await stopPreview()
        } else {
          await Promise.all([refreshStatus(), refreshOutput()])
        }
      } else {
        await Promise.all([refreshStatus(), refreshOutput()])
      }
    } catch (detectConfigError) {
      const nextError = toErrorMessage(detectConfigError)
      setDetectError(nextError)
      throw detectConfigError
    } finally {
      setIsDetectingConfigs(false)
    }
  }, [
    instanceId,
    projectId,
    refreshOutput,
    refreshStatus,
    reloadConfigs,
    stopPreview,
    workspacePath
  ])

  useEffect(() => {
    if (!projectId) {
      setConfigs([])
      setSelectedConfigId('')
      setSyncResult(null)
      setDetectError(null)
      applyInstance(null)
      return
    }

    void reloadConfigs()
  }, [applyInstance, projectId, reloadConfigs, taskId])

  useEffect(() => {
    if (!isVisible) {
      return
    }

    const hydrateStatus = async () => {
      await Promise.all([refreshStatus(), refreshOutput()])
    }

    void hydrateStatus()
  }, [isVisible, refreshOutput, refreshStatus])

  useEffect(() => {
    if (!isVisible || !instanceId) {
      return
    }

    const intervalId = window.setInterval(() => {
      void Promise.all([refreshStatus(), refreshOutput()])
    }, PREVIEW_POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [instanceId, isVisible, refreshOutput, refreshStatus])

  useEffect(() => {
    if (!isVisible || configs.length === 0 || selectedConfigId) {
      return
    }

    const defaultSelection = selectDefaultPreviewConfig(configs)
    if (defaultSelection.config) {
      setSelectedConfigId(defaultSelection.config.id)
    }
  }, [configs, isVisible, selectedConfigId])

  return {
    configs,
    isLoadingConfigs,
    isProjectScoped,
    isDetectingConfigs,
    selectedConfigId,
    selectedConfig,
    syncResult,
    detectError,
    canDetectConfigs,
    previewUrl,
    status,
    error,
    hostPort,
    activeConfigId,
    outputLines,
    reloadConfigs,
    refreshStatus,
    refreshOutput,
    detectAndSync,
    selectConfig,
    saveConfig,
    deleteConfig,
    startPreview,
    stopPreview
  }
}
