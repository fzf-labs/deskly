import { EventEmitter } from 'events'
import * as os from 'os'
import { config } from '../config'
import { safeExecFile } from '../utils/safe-exec'
import {
  resolveSystemCliInstallMethods,
  SYSTEM_CLI_TOOLS,
  SYSTEM_CLI_PACKAGE_MANAGERS,
  type LocalizedText,
  type SystemCliPackageManager,
  type SystemCliToolCategory,
  type SystemCliPlatform,
  type SystemCliToolDefinition,
  type SystemCliToolDetectionLevel,
  type SystemCliToolInstallMethod,
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

interface SystemCliPackageSnapshot {
  brew: Set<string>
  pipx: Set<string>
  npm: Set<string>
  cargo: Set<string>
  metadata: Record<SystemCliPackageManager, Map<string, SystemCliPackageMeta>>
  checkedLevel: SystemCliToolDetectionLevel
  lastCheckedAt: string
}

interface SystemCliPackageMeta {
  version?: string
  installPath?: string
}

const PACKAGE_MANAGER_DOCS: Record<SystemCliPackageManager, string> = {
  brew: 'https://brew.sh',
  pipx: 'https://pipx.pypa.io',
  npm: 'https://docs.npmjs.com/cli/v10/commands/npm-install',
  cargo: 'https://doc.rust-lang.org/cargo/commands/cargo-install.html'
}

export class SystemCliToolService extends EventEmitter {
  private readonly fastTimeoutMs = config.cliToolDetection.fastTimeoutMs
  private readonly fullTimeoutMs = config.cliToolDetection.fullTimeoutMs
  private readonly fastCacheMs = config.cliToolDetection.fastCacheMs
  private readonly fullCacheMs = config.cliToolDetection.fullCacheMs
  private readonly inFlightDetections = new Map<string, Promise<SystemCliToolInfo | null>>()
  private inFlightPackageSnapshot: Promise<SystemCliPackageSnapshot> | null = null
  private packageSnapshot: SystemCliPackageSnapshot | null = null
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

  private createText(zh: string, en: string): LocalizedText {
    return { zh, en }
  }

  private createEmptyMetadata(): Record<SystemCliPackageManager, Map<string, SystemCliPackageMeta>> {
    return {
      brew: new Map<string, SystemCliPackageMeta>(),
      pipx: new Map<string, SystemCliPackageMeta>(),
      npm: new Map<string, SystemCliPackageMeta>(),
      cargo: new Map<string, SystemCliPackageMeta>()
    }
  }

  private getPackageKey(manager: SystemCliPackageManager, packageName: string): string {
    return `${manager}:${packageName}`.toLowerCase()
  }

  private getPackageCategory(definition?: SystemCliToolDefinition): SystemCliToolCategory {
    return definition?.category ?? 'data'
  }

  private getGenericInstallMethods(
    manager: SystemCliPackageManager,
    packageName: string
  ): SystemCliToolInstallMethod[] {
    switch (manager) {
      case 'brew':
        return [{ label: 'Homebrew', command: `brew install ${packageName}`, platforms: ['darwin'] }]
      case 'pipx':
        return [{ label: 'pipx', command: `pipx install ${packageName}`, platforms: ['darwin'] }]
      case 'npm':
        return [{ label: 'npm', command: `npm install -g ${packageName}`, platforms: ['darwin'] }]
      case 'cargo':
        return [{ label: 'cargo', command: `cargo install ${packageName}`, platforms: ['darwin'] }]
    }
  }

  private findDefinitionForPackage(
    manager: SystemCliPackageManager,
    packageName: string
  ): SystemCliToolDefinition | undefined {
    return SYSTEM_CLI_TOOLS.find((definition) =>
      definition.packageSources?.some(
        (source) => source.manager === manager && source.packages.includes(packageName)
      )
    )
  }

  private createInstalledToolFromPackage(
    manager: SystemCliPackageManager,
    packageName: string,
    platform: SystemCliPlatform,
    checkedLevel: SystemCliToolDetectionLevel,
    lastCheckedAt: string,
    packageMeta?: SystemCliPackageMeta
  ): SystemCliToolInfo {
    const definition = this.findDefinitionForPackage(manager, packageName)

    return {
      id: this.getPackageKey(manager, packageName),
      command: packageName,
      binNames: [packageName],
      displayName: packageName,
      category: this.getPackageCategory(definition),
      summary: this.createText('', ''),
      detailIntro: this.createText(
        `这是一个通过 ${manager} 检测到的已安装软件包，当前按照软件包本身的信息展示。`,
        `This installed package was detected via ${manager} and is shown using package-level metadata.`
      ),
      useCases: [],
      guideSteps: [],
      examplePrompts: [],
      packageSources: [{ manager, packages: [packageName] }],
      installMethods: this.getGenericInstallMethods(manager, packageName),
      docsUrl: PACKAGE_MANAGER_DOCS[manager],
      platform,
      installed: true,
      installedVia: manager,
      installState: 'installed',
      version: packageMeta?.version,
      installPath: packageMeta?.installPath,
      checkedLevel,
      lastCheckedAt
    }
  }

  private createRecommendedTool(
    definition: SystemCliToolDefinition,
    platform: SystemCliPlatform,
    checkedLevel: SystemCliToolDetectionLevel,
    lastCheckedAt: string
  ): SystemCliToolInfo {
    const base = this.createInitialTool(definition, platform)
    return {
      ...base,
      installed: false,
      installedVia: undefined,
      installState: 'missing',
      installPath: undefined,
      version: undefined,
      checkedLevel,
      lastCheckedAt,
      errorMessage: undefined
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

  private isPackageSnapshotFresh(level: SystemCliToolDetectionLevel): boolean {
    if (!this.packageSnapshot) return false

    const checkedAt = Date.parse(this.packageSnapshot.lastCheckedAt)
    if (Number.isNaN(checkedAt)) return false

    const age = Date.now() - checkedAt
    if (level === 'full') {
      return this.packageSnapshot.checkedLevel === 'full' && age <= this.fullCacheMs
    }

    if (this.packageSnapshot.checkedLevel === 'full') {
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

  private createEmptyPackageSnapshot(
    level: SystemCliToolDetectionLevel
  ): SystemCliPackageSnapshot {
    return {
      brew: new Set<string>(),
      pipx: new Set<string>(),
      npm: new Set<string>(),
      cargo: new Set<string>(),
      metadata: this.createEmptyMetadata(),
      checkedLevel: level,
      lastCheckedAt: new Date().toISOString()
    }
  }

  private async listBrewPackages(timeoutMs: number): Promise<{
    packages: Set<string>
    metadata: Map<string, SystemCliPackageMeta>
  }> {
    try {
      const { stdout } = await safeExecFile('brew', ['info', '--json=v2', '--installed'], {
        allowlist: commandAllowlist,
        timeoutMs,
        label: 'SystemCliToolService',
        maxBuffer: 8 * 1024 * 1024
      })

      const parsed = JSON.parse(stdout) as {
        formulae?: Array<{
          name?: string
          installed?: Array<{ version?: string }>
        }>
      }
      const packages = new Set<string>()
      const metadata = new Map<string, SystemCliPackageMeta>()
      const brewCellar = os.arch() === 'arm64' ? '/opt/homebrew/Cellar' : '/usr/local/Cellar'

      for (const formula of parsed.formulae ?? []) {
        const packageName = formula.name?.trim()
        if (!packageName) continue

        packages.add(packageName)
        const version = formula.installed?.[0]?.version?.trim()
        metadata.set(packageName, {
          version,
          installPath: version ? `${brewCellar}/${packageName}/${version}` : undefined
        })
      }

      return { packages, metadata }
    } catch {
      return {
        packages: new Set<string>(),
        metadata: new Map<string, SystemCliPackageMeta>()
      }
    }
  }

  private async listPipxPackages(timeoutMs: number): Promise<{
    packages: Set<string>
    metadata: Map<string, SystemCliPackageMeta>
  }> {
    try {
      const { stdout } = await safeExecFile('pipx', ['list', '--json'], {
        allowlist: commandAllowlist,
        timeoutMs,
        label: 'SystemCliToolService',
        maxBuffer: 4 * 1024 * 1024
      })

      const parsed = JSON.parse(stdout) as {
        venvs?: Record<string, { metadata?: { main_package?: { package_version?: string } } }>
      }
      const packages = new Set<string>()
      const metadata = new Map<string, SystemCliPackageMeta>()
      const pipxVenvRoot = `${os.homedir()}/.local/pipx/venvs`

      for (const [packageName, venv] of Object.entries(parsed.venvs ?? {})) {
        packages.add(packageName)
        metadata.set(packageName, {
          version: venv.metadata?.main_package?.package_version,
          installPath: `${pipxVenvRoot}/${packageName}`
        })
      }

      return { packages, metadata }
    } catch {
      return {
        packages: new Set<string>(),
        metadata: new Map<string, SystemCliPackageMeta>()
      }
    }
  }

  private async listNpmPackages(timeoutMs: number): Promise<{
    packages: Set<string>
    metadata: Map<string, SystemCliPackageMeta>
  }> {
    try {
      const [{ stdout }, rootResult] = await Promise.all([
        safeExecFile('npm', ['-g', 'ls', '--depth=0', '--json', '--silent'], {
          allowlist: commandAllowlist,
          timeoutMs,
          label: 'SystemCliToolService',
          maxBuffer: 1024 * 1024
        }),
        safeExecFile('npm', ['root', '-g'], {
          allowlist: commandAllowlist,
          timeoutMs,
          label: 'SystemCliToolService'
        }).catch(() => ({ stdout: '', stderr: '' }))
      ])

      const parsed = JSON.parse(stdout) as {
        dependencies?: Record<string, { version?: string }>
      }
      const packages = new Set<string>()
      const metadata = new Map<string, SystemCliPackageMeta>()
      const npmRoot = rootResult.stdout.trim()

      for (const [packageName, dependency] of Object.entries(parsed.dependencies ?? {})) {
        packages.add(packageName)
        metadata.set(packageName, {
          version: dependency?.version,
          installPath: npmRoot ? `${npmRoot}/${packageName}` : undefined
        })
      }

      return { packages, metadata }
    } catch {
      return {
        packages: new Set<string>(),
        metadata: new Map<string, SystemCliPackageMeta>()
      }
    }
  }

  private async listCargoPackages(timeoutMs: number): Promise<{
    packages: Set<string>
    metadata: Map<string, SystemCliPackageMeta>
  }> {
    try {
      const { stdout } = await safeExecFile('cargo', ['install', '--list'], {
        allowlist: commandAllowlist,
        timeoutMs,
        label: 'SystemCliToolService',
        maxBuffer: 1024 * 1024
      })

      const packages = new Set<string>()
      const metadata = new Map<string, SystemCliPackageMeta>()
      const cargoBinPath = `${os.homedir()}/.cargo/bin`

      for (const line of stdout.split(/\r?\n/).map((entry) => entry.trim())) {
        const match = line.match(/^([A-Za-z0-9._-]+)\s+v([^:]+):$/)
        if (!match) continue

        const [, packageName, version] = match
        packages.add(packageName)
        metadata.set(packageName, {
          version,
          installPath: cargoBinPath
        })
      }

      return { packages, metadata }
    } catch {
      return {
        packages: new Set<string>(),
        metadata: new Map<string, SystemCliPackageMeta>()
      }
    }
  }

  private async loadPackageSnapshot(
    level: SystemCliToolDetectionLevel
  ): Promise<SystemCliPackageSnapshot> {
    if (this.resolvePlatform() !== 'darwin') {
      const snapshot = this.createEmptyPackageSnapshot(level)
      this.packageSnapshot = snapshot
      return snapshot
    }

    const timeoutMs = Math.max(level === 'full' ? this.fullTimeoutMs * 4 : this.fullTimeoutMs * 2, 4000)
    const [brewResult, pipxResult, npmResult, cargoResult] = await Promise.all([
      this.listBrewPackages(timeoutMs),
      this.listPipxPackages(timeoutMs),
      this.listNpmPackages(timeoutMs),
      this.listCargoPackages(timeoutMs)
    ])

    const snapshot = {
      brew: brewResult.packages,
      pipx: pipxResult.packages,
      npm: npmResult.packages,
      cargo: cargoResult.packages,
      metadata: {
        brew: brewResult.metadata,
        pipx: pipxResult.metadata,
        npm: npmResult.metadata,
        cargo: cargoResult.metadata
      },
      checkedLevel: level,
      lastCheckedAt: new Date().toISOString()
    }
    this.packageSnapshot = snapshot
    return snapshot
  }

  private async getPackageSnapshot(
    level: SystemCliToolDetectionLevel,
    force = false
  ): Promise<SystemCliPackageSnapshot> {
    if (!force && this.isPackageSnapshotFresh(level) && this.packageSnapshot) {
      return this.packageSnapshot
    }

    if (this.inFlightPackageSnapshot) {
      return this.inFlightPackageSnapshot
    }

    const snapshotPromise = this.loadPackageSnapshot(level)
    this.inFlightPackageSnapshot = snapshotPromise

    try {
      return await snapshotPromise
    } finally {
      this.inFlightPackageSnapshot = null
    }
  }

  private detectInstalledViaPackages(
    tool: SystemCliToolInfo,
    snapshot: SystemCliPackageSnapshot
  ): SystemCliPackageManager | null {
    for (const source of tool.packageSources ?? []) {
      const installedPackages = snapshot[source.manager]
      if (source.packages.some((pkg) => installedPackages.has(pkg))) {
        return source.manager
      }
    }

    return null
  }

  private getInstalledPackageMeta(
    tool: Pick<SystemCliToolDefinition, 'packageSources'>,
    manager: SystemCliPackageManager,
    snapshot: SystemCliPackageSnapshot
  ): SystemCliPackageMeta | undefined {
    const matchedSource = tool.packageSources?.find(
      (source) =>
        source.manager === manager &&
        source.packages.some((packageName) => snapshot[manager].has(packageName))
    )
    const matchedPackageName = matchedSource?.packages.find((packageName) =>
      snapshot[manager].has(packageName)
    )

    return matchedPackageName ? snapshot.metadata[manager].get(matchedPackageName) : undefined
  }

  private async enrichInstalledTool(
    tool: SystemCliToolInfo,
    level: SystemCliToolDetectionLevel,
    startedAt: number,
    resolvedInstallPath?: string
  ): Promise<SystemCliToolInfo> {
    const detectedInstallPath = resolvedInstallPath ?? (await this.resolveInstallPath(tool))
    const installPath = detectedInstallPath ?? tool.installPath
    const version = level === 'full' && detectedInstallPath
      ? (await this.resolveVersion(detectedInstallPath)) ?? tool.version
      : tool.version

    return {
      ...tool,
      installPath,
      version,
      latencyMs: Date.now() - startedAt
    }
  }

  private async buildDarwinKnownTool(
    definition: SystemCliToolDefinition,
    snapshot: SystemCliPackageSnapshot,
    level: SystemCliToolDetectionLevel,
    platform: SystemCliPlatform,
    lastCheckedAt: string
  ): Promise<SystemCliToolInfo> {
    const base = this.createInitialTool(definition, platform)
    const startedAt = Date.now()
    const installedVia = this.detectInstalledViaPackages(base, snapshot)

    if (installedVia) {
      const packageMeta = this.getInstalledPackageMeta(base, installedVia, snapshot)
      const installedTool: SystemCliToolInfo = {
        ...base,
        installed: true,
        installedVia,
        installState: 'installed',
        installPath: packageMeta?.installPath,
        version: packageMeta?.version,
        checkedLevel: level,
        lastCheckedAt,
        errorMessage: undefined
      }

      return this.enrichInstalledTool(installedTool, level, startedAt).catch(() => ({
        ...installedTool,
        latencyMs: Date.now() - startedAt
      }))
    }

    const installPath = await this.resolveInstallPath(base)
    if (!installPath) {
      return {
        ...this.createRecommendedTool(definition, platform, level, lastCheckedAt),
        latencyMs: Date.now() - startedAt
      }
    }

    const installedTool: SystemCliToolInfo = {
      ...base,
      installed: true,
      installedVia: 'system',
      installState: 'installed',
      installPath,
      version: undefined,
      checkedLevel: level,
      lastCheckedAt,
      errorMessage: undefined
    }

    return this.enrichInstalledTool(installedTool, level, startedAt, installPath).catch(() => ({
      ...installedTool,
      latencyMs: Date.now() - startedAt
    }))
  }

  private async rebuildDarwinTools(
    level: SystemCliToolDetectionLevel,
    force = false
  ): Promise<SystemCliToolInfo[]> {
    const platform = this.resolvePlatform()
    const snapshot = await this.getPackageSnapshot(level, force)
    const lastCheckedAt = snapshot.lastCheckedAt
    const definitionEntries = await Promise.all(
      SYSTEM_CLI_TOOLS.map((definition) =>
        this.buildDarwinKnownTool(definition, snapshot, level, platform, lastCheckedAt)
      )
    )

    const installedEntries = SYSTEM_CLI_PACKAGE_MANAGERS.flatMap((manager) =>
      Array.from(snapshot[manager])
        .filter((packageName) => !this.findDefinitionForPackage(manager, packageName))
        .sort((left, right) => left.localeCompare(right))
        .map((packageName) =>
          this.createInstalledToolFromPackage(
            manager,
            packageName,
            platform,
            level,
            lastCheckedAt,
            snapshot.metadata[manager].get(packageName)
          )
        )
    )

    const enrichedInstalledEntries = await Promise.all(
      installedEntries.map((tool) =>
        this.enrichInstalledTool(tool, level, Date.now()).catch(() => tool)
      )
    )

    this.tools = [...definitionEntries, ...enrichedInstalledEntries]
    this.emit('updated', this.getSnapshot())
    return this.getSnapshot()
  }

  async detectTool(
    toolId: string,
    options: SystemCliToolDetectOptions = {}
  ): Promise<SystemCliToolInfo | null> {
    const level = options.level ?? 'full'

    if (this.resolvePlatform() === 'darwin') {
      const existing = this.tools.find((entry) => entry.id === toolId)
      if (existing && !options.force && this.isToolFresh(existing, level)) {
        return { ...existing }
      }

      const tools = await this.rebuildDarwinTools(level, Boolean(options.force))
      return tools.find((entry) => entry.id === toolId) ?? null
    }

    const tool = this.tools.find((entry) => entry.id === toolId)
    if (!tool) return null

    if (!options.force && this.isToolFresh(tool, level)) {
      return { ...tool }
    }

    const inFlight = this.inFlightDetections.get(toolId)
    if (inFlight) return inFlight

    const detectionPromise = this.runDetection(toolId, level, Boolean(options.force))
    this.inFlightDetections.set(toolId, detectionPromise)

    try {
      return await detectionPromise
    } finally {
      this.inFlightDetections.delete(toolId)
    }
  }

  private async runDetection(
    toolId: string,
    level: SystemCliToolDetectionLevel,
    force = false
  ): Promise<SystemCliToolInfo | null> {
    const tool = this.tools.find((entry) => entry.id === toolId)
    if (!tool) return null

    const startedAt = Date.now()
    this.updateTool(toolId, {
      installState: 'checking',
      errorMessage: undefined
    })

    if (tool.platform === 'darwin') {
      const packageSnapshot = await this.getPackageSnapshot(level, force)
      const installedVia = this.detectInstalledViaPackages(tool, packageSnapshot)

      if (!installedVia) {
        const updated = this.updateTool(toolId, {
          installed: false,
          installedVia: undefined,
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

      const installPath = await this.resolveInstallPath(tool)
      const version = level === 'full' && installPath ? await this.resolveVersion(installPath) : tool.version
      const updated = this.updateTool(toolId, {
        installed: true,
        installedVia,
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

    const installPath = await this.resolveInstallPath(tool)
    if (!installPath) {
      const updated = this.updateTool(toolId, {
        installed: false,
        installedVia: undefined,
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
      installedVia: undefined,
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
    if (this.resolvePlatform() === 'darwin') {
      return this.rebuildDarwinTools(options.level ?? 'full', Boolean(options.force))
    }

    const results = await Promise.all(this.tools.map((tool) => this.detectTool(tool.id, options)))
    return results.filter((tool): tool is SystemCliToolInfo => tool !== null)
  }

  async refreshTools(options: SystemCliToolRefreshOptions = {}): Promise<SystemCliToolInfo[]> {
    if (this.resolvePlatform() === 'darwin') {
      return this.rebuildDarwinTools(options.level ?? 'fast', Boolean(options.force))
    }

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
