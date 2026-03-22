import { EventEmitter } from 'events'
import * as os from 'os'
import { config } from '../config'
import { safeExecFile } from '../utils/safe-exec'
import {
  resolveSystemCliInstallMethods,
  SYSTEM_CLI_TOOLS,
  type SystemCliPlatform,
  type SystemCliToolDefinition,
  type SystemCliToolDetectionLevel,
  type SystemCliToolInfo
} from '../../shared/system-cli-tools'

const commandAllowlist = config.commandAllowlist

export interface SystemCliToolDetectOptions {
  level?: SystemCliToolDetectionLevel
  force?: boolean
}

export interface SystemCliToolRefreshOptions extends SystemCliToolDetectOptions {
  toolIds?: string[]
}

export class SystemCliToolService extends EventEmitter {
  private readonly fastTimeoutMs = config.cliToolDetection.fastTimeoutMs
  private readonly fullTimeoutMs = config.cliToolDetection.fullTimeoutMs
  private readonly fastCacheMs = config.cliToolDetection.fastCacheMs
  private readonly fullCacheMs = config.cliToolDetection.fullCacheMs
  private readonly inFlightDetections = new Map<string, Promise<SystemCliToolInfo | null>>()
  private tools: SystemCliToolInfo[] = []

  constructor() {
    super()
    const platform = this.resolvePlatform()
    this.tools = SYSTEM_CLI_TOOLS.map((tool) => this.createInitialTool(tool, platform))
  }

  init(): void {
    void this.refreshTools({ level: 'fast' }).catch((error) => {
      console.error('[SystemCliToolService] Failed to warm tool cache:', error)
    })
  }

  private resolvePlatform(): SystemCliPlatform {
    const platform = os.platform()
    if (platform === 'darwin' || platform === 'win32') {
      return platform
    }
    return 'linux'
  }

  private createInitialTool(
    definition: SystemCliToolDefinition,
    platform: SystemCliPlatform
  ): SystemCliToolInfo {
    return {
      ...definition,
      installMethods: resolveSystemCliInstallMethods(definition.installMethods, platform),
      platform,
      installState: 'unknown'
    }
  }

  private isToolFresh(tool: SystemCliToolInfo, level: SystemCliToolDetectionLevel): boolean {
    if (!tool.lastCheckedAt) return false

    const checkedAt = Date.parse(tool.lastCheckedAt)
    if (Number.isNaN(checkedAt)) return false

    const age = Date.now() - checkedAt
    if (level === 'full') {
      return tool.checkedLevel === 'full' && age <= this.fullCacheMs
    }
    if (tool.checkedLevel === 'full') {
      return age <= this.fullCacheMs
    }
    return age <= this.fastCacheMs
  }

  private updateTool(toolId: string, updates: Partial<SystemCliToolInfo>): SystemCliToolInfo | null {
    const index = this.tools.findIndex((tool) => tool.id === toolId)
    if (index === -1) return null

    const next = {
      ...this.tools[index],
      ...updates
    }
    this.tools[index] = next
    this.emit('updated', this.getSnapshot())
    return next
  }

  private async resolveInstallPath(tool: SystemCliToolInfo): Promise<string | undefined> {
    const lookupCommand = tool.platform === 'win32' ? 'where' : 'which'

    for (const binName of tool.binNames) {
      try {
        const { stdout } = await safeExecFile(lookupCommand, [binName], {
          allowlist: commandAllowlist,
          timeoutMs: this.fastTimeoutMs,
          label: 'SystemCliToolService'
        })

        const resolved = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line.length > 0)

        if (resolved) return resolved
      } catch {
        continue
      }
    }

    return undefined
  }

  private async resolveVersion(
    installPath: string
  ): Promise<string | undefined> {
    try {
      const { stdout, stderr } = await safeExecFile(installPath, ['--version'], {
        allowlist: commandAllowlist,
        timeoutMs: this.fullTimeoutMs,
        label: 'SystemCliToolService'
      })

      return `${stdout}\n${stderr}`
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0)
    } catch {
      return undefined
    }
  }

  async detectTool(
    toolId: string,
    options: SystemCliToolDetectOptions = {}
  ): Promise<SystemCliToolInfo | null> {
    const level = options.level ?? 'full'
    const tool = this.tools.find((entry) => entry.id === toolId)
    if (!tool) return null

    if (!options.force && this.isToolFresh(tool, level)) {
      return { ...tool }
    }

    const inFlight = this.inFlightDetections.get(toolId)
    if (inFlight) return inFlight

    const detectionPromise = this.runDetection(toolId, level)
    this.inFlightDetections.set(toolId, detectionPromise)

    try {
      return await detectionPromise
    } finally {
      this.inFlightDetections.delete(toolId)
    }
  }

  private async runDetection(
    toolId: string,
    level: SystemCliToolDetectionLevel
  ): Promise<SystemCliToolInfo | null> {
    const tool = this.tools.find((entry) => entry.id === toolId)
    if (!tool) return null

    const startedAt = Date.now()
    this.updateTool(toolId, {
      installState: 'checking',
      errorMessage: undefined
    })

    const installPath = await this.resolveInstallPath(tool)
    if (!installPath) {
      const updated = this.updateTool(toolId, {
        installed: false,
        installState: 'missing',
        installPath: undefined,
        version: undefined,
        checkedLevel: level,
        lastCheckedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        errorMessage: undefined
      })
      return updated ? { ...updated } : null
    }

    const version = level === 'full' ? await this.resolveVersion(installPath) : tool.version
    const updated = this.updateTool(toolId, {
      installed: true,
      installState: 'installed',
      installPath,
      version,
      checkedLevel: level,
      lastCheckedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      errorMessage: undefined
    })
    return updated ? { ...updated } : null
  }

  async detectAllTools(options: SystemCliToolDetectOptions = {}): Promise<SystemCliToolInfo[]> {
    const results = await Promise.all(this.tools.map((tool) => this.detectTool(tool.id, options)))
    return results.filter((tool): tool is SystemCliToolInfo => tool !== null)
  }

  async refreshTools(options: SystemCliToolRefreshOptions = {}): Promise<SystemCliToolInfo[]> {
    const toolIds = Array.isArray(options.toolIds) && options.toolIds.length > 0
      ? options.toolIds
      : this.tools.map((tool) => tool.id)

    await Promise.all(
      toolIds.map((toolId) =>
        this.detectTool(toolId, {
          level: options.level,
          force: options.force
        })
      )
    )

    return this.getSnapshot()
  }

  getSnapshot(): SystemCliToolInfo[] {
    return this.tools.map((tool) => ({ ...tool }))
  }

  getAllTools(): SystemCliToolInfo[] {
    return this.getSnapshot()
  }
}
