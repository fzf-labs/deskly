import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

import type {
  CreatePreviewConfigInput,
  PreviewConfig,
  PreviewLaunchCapability,
  UpdatePreviewConfigInput
} from '../../shared/contracts/preview'

const compareIsoDate = (left?: string | null, right?: string | null): number => {
  if (left && right) {
    return right.localeCompare(left)
  }
  if (left) return -1
  if (right) return 1
  return 0
}

const comparePreviewConfigs = (left: PreviewConfig, right: PreviewConfig): number => {
  const lastUsedDiff = compareIsoDate(left.lastUsedAt ?? null, right.lastUsedAt ?? null)
  if (lastUsedDiff !== 0) {
    return lastUsedDiff
  }

  const createdDiff = left.createdAt.localeCompare(right.createdAt)
  if (createdDiff !== 0) {
    return createdDiff
  }

  const nameDiff = left.name.localeCompare(right.name)
  if (nameDiff !== 0) {
    return nameDiff
  }

  return left.id.localeCompare(right.id)
}

const createPreviewConfigId = (): string => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const normalizeLaunchCapability = (value: unknown, type: PreviewConfig['type']): PreviewLaunchCapability => {
  if (value === 'config-only') {
    return 'config-only'
  }

  if (value === 'inline-web') {
    return 'inline-web'
  }

  return type === 'backend' ? 'config-only' : 'inline-web'
}

const normalizeConfig = (value: unknown): PreviewConfig | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  if (
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.projectId !== 'string' ||
    typeof record.type !== 'string' ||
    typeof record.command !== 'string' ||
    !Array.isArray(record.args) ||
    typeof record.createdAt !== 'string' ||
    typeof record.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: record.id,
    name: record.name,
    projectId: record.projectId,
    type: record.type === 'backend' ? 'backend' : 'frontend',
    ownership: record.ownership === 'ai-managed' ? 'ai-managed' : 'manual',
    launchCapability: normalizeLaunchCapability(record.launchCapability, record.type === 'backend' ? 'backend' : 'frontend'),
    detectionKey: typeof record.detectionKey === 'string' ? record.detectionKey : null,
    detectionSignature: typeof record.detectionSignature === 'string' ? record.detectionSignature : null,
    detectionSource: typeof record.detectionSource === 'string' ? record.detectionSource : null,
    command: record.command,
    args: record.args.filter((item): item is string => typeof item === 'string'),
    cwd: typeof record.cwd === 'string' ? record.cwd : null,
    port: typeof record.port === 'number' ? record.port : null,
    env:
      record.env && typeof record.env === 'object'
        ? Object.fromEntries(
            Object.entries(record.env as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === 'string'
            )
          )
        : undefined,
    autoStart: typeof record.autoStart === 'boolean' ? record.autoStart : undefined,
    lastUsedAt: typeof record.lastUsedAt === 'string' ? record.lastUsedAt : null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  }
}

export class PreviewConfigService {
  private configPath: string
  private configs: Map<string, PreviewConfig> = new Map()

  constructor() {
    const userDataPath = app.getPath('userData')
    const configDir = join(userDataPath, 'preview-configs')
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true })
    }
    this.configPath = join(configDir, 'configs.json')
    this.loadConfigs()
  }

  private loadConfigs(): void {
    try {
      if (!existsSync(this.configPath)) {
        return
      }

      const data = readFileSync(this.configPath, 'utf-8')
      const parsed = JSON.parse(data) as Record<string, unknown>
      const nextConfigs = new Map<string, PreviewConfig>()

      for (const value of Object.values(parsed)) {
        const normalized = normalizeConfig(value)
        if (normalized) {
          nextConfigs.set(normalized.id, normalized)
        }
      }

      this.configs = nextConfigs
      this.normalizeLastUsedFlags()
    } catch (error) {
      console.error('Failed to load preview configs:', error)
    }
  }

  private saveConfigs(): void {
    try {
      const data = JSON.stringify(Object.fromEntries(this.configs), null, 2)
      writeFileSync(this.configPath, data, 'utf-8')
    } catch (error) {
      console.error('Failed to save preview configs:', error)
      throw error
    }
  }

  private clearProjectLastUsed(projectId: string, preserveId?: string): boolean {
    let changed = false

    for (const config of this.configs.values()) {
      if (config.projectId !== projectId || config.id === preserveId || !config.lastUsedAt) {
        continue
      }

      this.configs.set(config.id, {
        ...config,
        lastUsedAt: null
      })
      changed = true
    }

    return changed
  }

  private normalizeLastUsedFlags(): void {
    let changed = false
    const projectIds = new Set(Array.from(this.configs.values()).map((config) => config.projectId))

    for (const projectId of projectIds) {
      const configs = Array.from(this.configs.values())
        .filter((config) => config.projectId === projectId && config.lastUsedAt)
        .sort(comparePreviewConfigs)

      const [keep, ...rest] = configs
      if (!keep || rest.length === 0) {
        continue
      }

      for (const config of rest) {
        this.configs.set(config.id, {
          ...config,
          lastUsedAt: null
        })
        changed = true
      }
    }

    if (changed) {
      this.saveConfigs()
    }
  }

  private sortConfigs(configs: PreviewConfig[]): PreviewConfig[] {
    return [...configs].sort(comparePreviewConfigs)
  }

  getAllConfigs(): PreviewConfig[] {
    return this.sortConfigs(Array.from(this.configs.values()))
  }

  getConfigsByProject(projectId: string): PreviewConfig[] {
    return this.sortConfigs(
      Array.from(this.configs.values()).filter((config) => config.projectId === projectId)
    )
  }

  getConfig(id: string): PreviewConfig | undefined {
    return this.configs.get(id)
  }

  addConfig(config: CreatePreviewConfigInput): PreviewConfig {
    const timestamp = new Date().toISOString()
    const newConfig: PreviewConfig = {
      id: createPreviewConfigId(),
      name: config.name,
      projectId: config.projectId,
      type: config.type ?? 'frontend',
      ownership: config.ownership ?? 'manual',
      launchCapability: config.launchCapability ?? normalizeLaunchCapability(undefined, config.type ?? 'frontend'),
      detectionKey: config.detectionKey ?? null,
      detectionSignature: config.detectionSignature ?? null,
      detectionSource: config.detectionSource ?? null,
      command: config.command,
      args: config.args ?? [],
      cwd: config.cwd ?? null,
      port: config.port ?? null,
      env: config.env,
      autoStart: config.autoStart,
      lastUsedAt: config.lastUsedAt ?? null,
      createdAt: timestamp,
      updatedAt: timestamp
    }

    if (newConfig.lastUsedAt) {
      this.clearProjectLastUsed(newConfig.projectId, newConfig.id)
    }

    this.configs.set(newConfig.id, newConfig)
    this.saveConfigs()
    return newConfig
  }

  updateConfig(id: string, updates: UpdatePreviewConfigInput): PreviewConfig {
    const currentConfig = this.configs.get(id)
    if (!currentConfig) {
      throw new Error(`Config not found: ${id}`)
    }

    const nextLastUsedAt =
      updates.lastUsedAt === undefined ? currentConfig.lastUsedAt ?? null : updates.lastUsedAt

    if (nextLastUsedAt) {
      this.clearProjectLastUsed(currentConfig.projectId, id)
    }

    const updatedConfig: PreviewConfig = {
      ...currentConfig,
      ...updates,
      id,
      projectId: currentConfig.projectId,
      ownership: updates.ownership ?? currentConfig.ownership,
      launchCapability:
        updates.launchCapability ?? currentConfig.launchCapability,
      detectionKey:
        updates.detectionKey === undefined ? currentConfig.detectionKey ?? null : updates.detectionKey,
      detectionSignature:
        updates.detectionSignature === undefined
          ? currentConfig.detectionSignature ?? null
          : updates.detectionSignature,
      detectionSource:
        updates.detectionSource === undefined
          ? currentConfig.detectionSource ?? null
          : updates.detectionSource,
      args: updates.args ?? currentConfig.args,
      cwd: updates.cwd === undefined ? currentConfig.cwd ?? null : updates.cwd,
      port: updates.port === undefined ? currentConfig.port ?? null : updates.port,
      lastUsedAt: nextLastUsedAt,
      updatedAt: new Date().toISOString()
    }

    this.configs.set(id, updatedConfig)
    this.saveConfigs()
    return updatedConfig
  }

  deleteConfig(id: string): boolean {
    const deleted = this.configs.delete(id)
    if (deleted) {
      this.saveConfigs()
    }
    return deleted
  }
}
