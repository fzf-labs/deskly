import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { EventEmitter } from 'events'
import { safeExecFile } from '../utils/safe-exec'
import { config } from '../config'
import { AgentCLIToolConfigService } from './AgentCLIToolConfigService'
import {
  type CommandResolutionSource,
  CommandResolutionError,
  type ResolvedCommand,
  resolveCommand
} from '../utils/command-resolution'

const cliToolAllowlist = config.commandAllowlist

export type CLIToolInstallState = 'unknown' | 'checking' | 'installed' | 'missing' | 'error'
export type CLIToolConfigState = 'unknown' | 'valid' | 'missing'
export type CLIToolExecutableState = 'unknown' | 'checking' | 'resolved' | 'missing' | 'error'
export type CLIToolDetectionLevel = 'fast' | 'full'

export interface CLIToolDetectOptions {
  level?: CLIToolDetectionLevel
  force?: boolean
}

export interface CLIToolRefreshOptions extends CLIToolDetectOptions {
  toolIds?: string[]
}

export interface CLIToolInfo {
  id: string
  name: string
  command: string
  displayName: string
  description: string
  installed?: boolean
  version?: string
  installPath?: string
  configValid?: boolean
  configPath?: string
  detectionCommand: string
  installState: CLIToolInstallState
  configState: CLIToolConfigState
  executableState: CLIToolExecutableState
  executableSource?: CommandResolutionSource
  executableCommand?: string
  checkedLevel?: CLIToolDetectionLevel
  lastCheckedAt?: string
  latencyMs?: number
  errorMessage?: string
}

export class AgentCLIToolDetectorService extends EventEmitter {
  private readonly configService: AgentCLIToolConfigService

  private readonly inFlightDetections = new Map<string, Promise<CLIToolInfo | null>>()

  private readonly fastTimeoutMs = config.cliToolDetection.fastTimeoutMs

  private readonly fullTimeoutMs = config.cliToolDetection.fullTimeoutMs

  private readonly fastCacheMs = config.cliToolDetection.fastCacheMs

  private readonly fullCacheMs = config.cliToolDetection.fullCacheMs

  private tools: CLIToolInfo[] = [
    {
      id: 'claude-code',
      name: 'claude-code',
      command: 'claude',
      displayName: 'Claude Code',
      description: 'Anthropic 官方 CLI 工具',
      detectionCommand: 'claude --version',
      installState: 'unknown',
      configState: 'unknown',
      executableState: 'unknown'
    },
    {
      id: 'codex',
      name: 'codex',
      command: 'codex',
      displayName: 'Codex',
      description: 'OpenAI Codex CLI 工具',
      detectionCommand: 'codex --version',
      installState: 'unknown',
      configState: 'unknown',
      executableState: 'unknown'
    },
    {
      id: 'gemini-cli',
      name: 'gemini-cli',
      command: 'gemini',
      displayName: 'Gemini CLI',
      description: 'Google Gemini CLI 工具',
      detectionCommand: 'gemini --version',
      installState: 'unknown',
      configState: 'unknown',
      executableState: 'unknown'
    },
    {
      id: 'opencode',
      name: 'opencode',
      command: 'opencode',
      displayName: 'OpenCode',
      description: 'OpenCode CLI 工具',
      detectionCommand: 'opencode --version',
      installState: 'unknown',
      configState: 'unknown',
      executableState: 'unknown'
    },
    {
      id: 'cursor-agent',
      name: 'cursor-agent',
      command: 'cursor-agent',
      displayName: 'Cursor Agent',
      description: 'Cursor AI Agent CLI 工具',
      detectionCommand: 'cursor-agent --version',
      installState: 'unknown',
      configState: 'unknown',
      executableState: 'unknown'
    }
  ]

  constructor(configService: AgentCLIToolConfigService = new AgentCLIToolConfigService()) {
    super()
    this.configService = configService
    this.tools = this.tools.map((tool) => ({
      ...tool,
      ...this.getConfigDetails(tool.id)
    }))
  }

  init(): void {
    void this.refreshTools({ level: 'fast' }).catch((error) => {
      console.error('[AgentCLIToolDetectorService] Failed to warm tool cache:', error)
    })
  }

  async detectTool(toolId: string, options: CLIToolDetectOptions = {}): Promise<CLIToolInfo | null> {
    const level = options.level ?? 'full'
    const tool = this.tools.find((t) => t.id === toolId)
    if (!tool) return null

    if (!options.force && this.isToolFresh(tool, level)) {
      return { ...tool }
    }

    const inFlight = this.inFlightDetections.get(toolId)
    if (inFlight) {
      return inFlight
    }

    const detectionPromise = this.runDetection(toolId, level)
    this.inFlightDetections.set(toolId, detectionPromise)

    try {
      return await detectionPromise
    } finally {
      this.inFlightDetections.delete(toolId)
    }
  }

  private async runDetection(toolId: string, level: CLIToolDetectionLevel): Promise<CLIToolInfo | null> {
    const tool = this.tools.find((entry) => entry.id === toolId)
    if (!tool) return null

    const startedAt = Date.now()
    this.updateTool(toolId, {
      installState: 'checking',
      executableState: 'checking',
      errorMessage: undefined
    })

    const configDetails = this.getConfigDetails(toolId)
    const executableCommand = this.getExecutableCommand(tool)

    try {
      const resolvedExecutable = await resolveCommand(executableCommand, {
        allowlist: cliToolAllowlist,
        timeoutMs: this.fastTimeoutMs
      })

      const version = level === 'full' ? await this.resolveVersion(resolvedExecutable) : tool.version

      const updated = this.updateTool(toolId, {
        installed: true,
        installState: 'installed',
        executableState: 'resolved',
        executableSource: resolvedExecutable.source,
        executableCommand,
        version,
        installPath: resolvedExecutable.executablePath,
        checkedLevel: level,
        lastCheckedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        errorMessage: undefined,
        ...configDetails
      })

      return updated ? { ...updated } : null
    } catch (error) {
      const missingExecutable =
        error instanceof CommandResolutionError && error.kind === 'not-found'
      const updated = this.updateTool(toolId, {
        installed: false,
        installState: missingExecutable ? 'missing' : 'error',
        executableState: missingExecutable ? 'missing' : 'error',
        executableSource: undefined,
        executableCommand,
        version: undefined,
        installPath: undefined,
        checkedLevel: level,
        lastCheckedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        errorMessage: error instanceof Error ? error.message : String(error),
        ...configDetails
      })

      return updated ? { ...updated } : null
    }
  }

  private isToolFresh(tool: CLIToolInfo, level: CLIToolDetectionLevel): boolean {
    if (!tool.lastCheckedAt) {
      return false
    }

    const checkedAt = Date.parse(tool.lastCheckedAt)
    if (Number.isNaN(checkedAt)) {
      return false
    }

    const age = Date.now() - checkedAt

    if (level === 'full') {
      return tool.checkedLevel === 'full' && age <= this.fullCacheMs
    }

    if (tool.checkedLevel === 'full') {
      return age <= this.fullCacheMs
    }

    return age <= this.fastCacheMs
  }

  private updateTool(toolId: string, updates: Partial<CLIToolInfo>): CLIToolInfo | null {
    const index = this.tools.findIndex((tool) => tool.id === toolId)
    if (index === -1) {
      return null
    }

    const next = {
      ...this.tools[index],
      ...updates
    }
    this.tools[index] = next
    this.emit('updated', this.getSnapshot())
    return next
  }

  private async resolveVersion(resolvedExecutable: ResolvedCommand): Promise<string | undefined> {
    try {
      const { stdout } = await safeExecFile(
        resolvedExecutable.executablePath,
        [...resolvedExecutable.args, '--version'],
        {
          env: resolvedExecutable.env,
          allowlist: cliToolAllowlist,
          timeoutMs: this.fullTimeoutMs,
          label: 'AgentCLIToolDetectorService'
        }
      )

      return stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0)
    } catch {
      return undefined
    }
  }

  private getExecutableCommand(tool: Pick<CLIToolInfo, 'id' | 'command'>): string {
    const toolConfig = this.configService.getConfig(tool.id)
    const configuredCommand =
      typeof toolConfig.base_command_override === 'string' && toolConfig.base_command_override.trim()
        ? toolConfig.base_command_override.trim()
        : typeof toolConfig.executablePath === 'string' && toolConfig.executablePath.trim()
          ? toolConfig.executablePath.trim()
          : tool.command

    if (tool.id === 'claude-code' && configuredCommand === 'claude') {
      return path.join(os.homedir(), '.local', 'bin', 'claude')
    }

    return configuredCommand
  }

  private getConfigDetails(toolId: string): Pick<CLIToolInfo, 'configPath' | 'configValid' | 'configState'> {
    const candidatePaths = this.configService.getConfigCandidatePaths(toolId)
    const configPath = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath)) ?? candidatePaths[0]
    const exists = candidatePaths.some((candidatePath) => fs.existsSync(candidatePath))

    return {
      configPath,
      configValid: exists,
      configState: exists ? 'valid' : 'missing'
    }
  }

  async detectAllTools(options: CLIToolDetectOptions = {}): Promise<CLIToolInfo[]> {
    const results = await Promise.all(this.tools.map((tool) => this.detectTool(tool.id, options)))
    return results.filter((tool): tool is CLIToolInfo => tool !== null)
  }

  async refreshTools(options: CLIToolRefreshOptions = {}): Promise<CLIToolInfo[]> {
    const level = options.level ?? 'fast'
    const requestedIds = Array.isArray(options.toolIds)
      ? options.toolIds.filter((toolId): toolId is string => typeof toolId === 'string' && toolId.length > 0)
      : this.tools.map((tool) => tool.id)

    await Promise.all(
      requestedIds.map((toolId) =>
        this.detectTool(toolId, {
          level,
          force: options.force
        })
      )
    )

    return this.getSnapshot()
  }

  getSnapshot(): CLIToolInfo[] {
    return this.tools.map((tool) => ({ ...tool }))
  }

  getAllTools(): CLIToolInfo[] {
    return this.getSnapshot()
  }

  getTool(toolId: string): CLIToolInfo | undefined {
    const tool = this.tools.find((t) => t.id === toolId)
    return tool ? { ...tool } : undefined
  }
}
