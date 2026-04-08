import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { basename, dirname, join, relative } from 'path'

import type {
  PreviewConfig,
  PreviewConfigSyncChange,
  PreviewConfigSyncResult,
  PreviewConfigType
} from '../../shared/contracts/preview'
import { PreviewConfigService } from './PreviewConfigService'

interface DetectionCandidate {
  name: string
  command: string
  args: string[]
  cwd: string | null
  port: number | null
  type: PreviewConfigType
  launchCapability: PreviewConfig['launchCapability']
  detectionKey: string
  detectionSignature: string
  detectionSource: string
}

interface PackageJsonManifest {
  name?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const MAX_SCAN_DEPTH = 4
const SKIP_DIRS = new Set([
  '.git',
  '.next',
  '.nuxt',
  '.output',
  '.turbo',
  '.vercel',
  'coverage',
  'dist',
  'build',
  'out',
  'node_modules'
])

const EXCLUDED_SCRIPT_NAME_RE =
  /(^|:)(build|check|clean|compile|coverage|format|install|lint|postinstall|preinstall|prepare|test|typecheck)$/i
const CANDIDATE_SCRIPT_NAME_RE =
  /(^|:)(api|app|backend|dev|docs|preview|serve|server|site|start|storybook|web|worker)$/i
const INLINE_WEB_SCRIPT_RE =
  /(astro|docusaurus|http-server|next(?:\s+dev|\s+start|\b)|ng\s+serve|nuxt|parcel|python\s+-m\s+http\.server|react-scripts\s+start|serve\s+-s|storybook|vite|vue-cli-service\s+serve|webpack(?:-dev-server)?\s+serve)/i
const BACKEND_HINT_RE = /(api|backend|server|worker)/i

const PORT_PATTERNS = [
  /(?:^|\s)(?:--port|-p)\s*=?\s*(\d{2,5})(?:\s|$)/i,
  /(?:^|\s)(?:PORT|VITE_PORT|NEXT_PORT|NUXT_PORT|ASTRO_PORT)\s*=\s*(\d{2,5})(?:\s|$)/i
] as const

const arrayEquals = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])

const normalizeWorkspacePath = (workspacePath: string): string => workspacePath.replace(/[\\/]+$/, '')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const getDependencies = (manifest: PackageJsonManifest): Record<string, string> => ({
  ...(manifest.dependencies ?? {}),
  ...(manifest.devDependencies ?? {})
})

const buildConfigSignature = ({
  command,
  args,
  cwd,
  port,
  launchCapability,
  type
}: Pick<DetectionCandidate, 'command' | 'args' | 'cwd' | 'port' | 'launchCapability' | 'type'>): string =>
  JSON.stringify({
    command,
    args,
    cwd: cwd ?? null,
    port: port ?? null,
    launchCapability,
    type
  })

const buildPreviewConfigSignature = (config: PreviewConfig): string =>
  buildConfigSignature({
    command: config.command,
    args: config.args,
    cwd: config.cwd ?? null,
    port: config.port ?? null,
    launchCapability: config.launchCapability,
    type: config.type
  })

const detectPackageManager = (directoryPath: string, workspacePath: string): string => {
  const searchRoots = [directoryPath, workspacePath]

  for (const root of searchRoots) {
    if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm'
    if (existsSync(join(root, 'yarn.lock'))) return 'yarn'
    if (existsSync(join(root, 'bun.lock')) || existsSync(join(root, 'bun.lockb'))) return 'bun'
    if (existsSync(join(root, 'package-lock.json')) || existsSync(join(root, 'npm-shrinkwrap.json'))) {
      return 'npm'
    }
  }

  return 'npm'
}

const extractPort = (
  scriptName: string,
  scriptCommand: string,
  dependencies: Record<string, string>
): number | null => {
  for (const pattern of PORT_PATTERNS) {
    const match = scriptCommand.match(pattern)
    const parsed = match?.[1] ? Number(match[1]) : NaN
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }

  const normalizedCommand = scriptCommand.toLowerCase()
  const normalizedScriptName = scriptName.toLowerCase()

  if (normalizedScriptName.includes('storybook') || normalizedCommand.includes('storybook')) return 6006
  if (normalizedCommand.includes('astro')) return 4321
  if (normalizedCommand.includes('ng serve')) return 4200
  if (normalizedCommand.includes('parcel')) return 1234
  if (normalizedCommand.includes('vue-cli-service serve') || normalizedCommand.includes('webpack serve')) {
    return 8080
  }
  if (normalizedCommand.includes('http-server')) return 8080
  if (normalizedCommand.includes('python -m http.server')) {
    const explicitPort = normalizedCommand.match(/http\.server\s+(\d{2,5})/)
    return explicitPort?.[1] ? Number(explicitPort[1]) : 8000
  }
  if (
    normalizedCommand.includes('next') ||
    normalizedCommand.includes('react-scripts start') ||
    normalizedCommand.includes('nuxt') ||
    normalizedCommand.includes('docusaurus')
  ) {
    return 3000
  }
  if ('vite' in dependencies || normalizedCommand.includes('vite')) return 5173

  return null
}

const inferLaunchCapability = (
  scriptName: string,
  scriptCommand: string,
  dependencies: Record<string, string>
): PreviewConfig['launchCapability'] => {
  const normalizedScriptName = scriptName.toLowerCase()
  if (
    INLINE_WEB_SCRIPT_RE.test(scriptCommand) ||
    /(docs|preview|site|storybook|web)$/.test(normalizedScriptName) ||
    ((/^dev$/.test(normalizedScriptName) || /^start$/.test(normalizedScriptName) || /^serve$/.test(normalizedScriptName)) &&
      ['astro', 'next', 'nuxt', 'react-scripts', 'vite'].some((dependency) => dependency in dependencies))
  ) {
    return 'inline-web'
  }

  return 'config-only'
}

const inferPreviewType = (
  launchCapability: PreviewConfig['launchCapability'],
  scriptName: string,
  scriptCommand: string
): PreviewConfigType => {
  if (launchCapability === 'inline-web') {
    return 'frontend'
  }

  return BACKEND_HINT_RE.test(`${scriptName} ${scriptCommand}`) ? 'backend' : 'frontend'
}

const formatNamePart = (value: string): string =>
  value
    .split(/[:/_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const buildDisplayName = (
  manifestName: string | undefined,
  scriptName: string,
  directoryPath: string,
  workspacePath: string
): string => {
  const relativeDirectory = relative(workspacePath, directoryPath)
  if (!relativeDirectory) {
    return formatNamePart(scriptName)
  }

  const packageLabel =
    manifestName?.trim() ||
    (relativeDirectory ? relativeDirectory.split(/[\\/]/).filter(Boolean).at(-1) : basename(workspacePath)) ||
    'Project'

  return `${formatNamePart(packageLabel.replace(/^@/, '').replace(/\//g, ' '))} · ${formatNamePart(scriptName)}`
}

const buildChange = (
  configLike: Pick<PreviewConfig, 'id' | 'name' | 'ownership' | 'launchCapability' | 'detectionKey'>,
  reason: string
): PreviewConfigSyncChange => ({
  id: configLike.id,
  name: configLike.name,
  ownership: configLike.ownership,
  launchCapability: configLike.launchCapability,
  detectionKey: configLike.detectionKey ?? null,
  reason
})

const isEquivalentConfig = (config: PreviewConfig, candidate: DetectionCandidate): boolean =>
  config.name === candidate.name &&
  config.type === candidate.type &&
  config.launchCapability === candidate.launchCapability &&
  config.command === candidate.command &&
  arrayEquals(config.args, candidate.args) &&
  (config.cwd ?? null) === (candidate.cwd ?? null) &&
  (config.port ?? null) === (candidate.port ?? null) &&
  (config.detectionKey ?? null) === candidate.detectionKey &&
  (config.detectionSignature ?? null) === candidate.detectionSignature &&
  (config.detectionSource ?? null) === candidate.detectionSource

export class PreviewDetectionService {
  constructor(private readonly previewConfigService: PreviewConfigService) {}

  detectAndSync(projectId: string, workspacePath: string): PreviewConfigSyncResult {
    const normalizedWorkspacePath = normalizeWorkspacePath(workspacePath.trim())
    if (!projectId.trim()) {
      throw new Error('Project ID is required for AI preview detection.')
    }
    if (!normalizedWorkspacePath) {
      throw new Error('Project workspace path is required for AI preview detection.')
    }
    if (!existsSync(normalizedWorkspacePath) || !statSync(normalizedWorkspacePath).isDirectory()) {
      throw new Error(`Project workspace path does not exist: ${normalizedWorkspacePath}`)
    }

    const candidates = this.scanWorkspace(normalizedWorkspacePath)
    const existingConfigs = this.previewConfigService.getConfigsByProject(projectId)
    const manualConfigs = existingConfigs.filter((config) => config.ownership === 'manual')
    const aiManagedConfigs = existingConfigs.filter((config) => config.ownership === 'ai-managed')
    const aiManagedByKey = new Map(
      aiManagedConfigs
        .filter((config): config is PreviewConfig & { detectionKey: string } => Boolean(config.detectionKey))
        .map((config) => [config.detectionKey, config] as const)
    )

    const result: PreviewConfigSyncResult = {
      workspacePath: normalizedWorkspacePath,
      configs: [],
      added: [],
      updated: [],
      deleted: [],
      skipped: []
    }

    const seenDetectionKeys = new Set<string>()
    const deletedIds = new Set<string>()

    for (const candidate of candidates) {
      seenDetectionKeys.add(candidate.detectionKey)

      const manualDuplicate = manualConfigs.find(
        (config) => buildPreviewConfigSignature(config) === candidate.detectionSignature
      )
      const existingAiManaged = aiManagedByKey.get(candidate.detectionKey)

      if (manualDuplicate) {
        if (existingAiManaged && !deletedIds.has(existingAiManaged.id)) {
          if (existingAiManaged.lastUsedAt && !manualDuplicate.lastUsedAt) {
            this.previewConfigService.updateConfig(manualDuplicate.id, {
              lastUsedAt: existingAiManaged.lastUsedAt
            })
          }
          this.previewConfigService.deleteConfig(existingAiManaged.id)
          deletedIds.add(existingAiManaged.id)
          result.deleted.push(
            buildChange(
              existingAiManaged,
              'Removed the AI-managed duplicate because an identical manual config already exists.'
            )
          )
        }

        result.skipped.push(
          buildChange(
            manualDuplicate,
            'Kept the matching manual config and skipped creating a duplicate AI-managed config.'
          )
        )
        continue
      }

      if (existingAiManaged && !deletedIds.has(existingAiManaged.id)) {
        if (isEquivalentConfig(existingAiManaged, candidate)) {
          result.skipped.push(buildChange(existingAiManaged, 'No preview config changes were detected.'))
          continue
        }

        const updatedConfig = this.previewConfigService.updateConfig(existingAiManaged.id, {
          name: candidate.name,
          type: candidate.type,
          ownership: 'ai-managed',
          launchCapability: candidate.launchCapability,
          detectionKey: candidate.detectionKey,
          detectionSignature: candidate.detectionSignature,
          detectionSource: candidate.detectionSource,
          command: candidate.command,
          args: candidate.args,
          cwd: candidate.cwd,
          port: candidate.port
        })
        result.updated.push(
          buildChange(updatedConfig, 'Updated the AI-managed preview config from the latest project scan.')
        )
        continue
      }

      const createdConfig = this.previewConfigService.addConfig({
        projectId,
        name: candidate.name,
        type: candidate.type,
        ownership: 'ai-managed',
        launchCapability: candidate.launchCapability,
        detectionKey: candidate.detectionKey,
        detectionSignature: candidate.detectionSignature,
        detectionSource: candidate.detectionSource,
        command: candidate.command,
        args: candidate.args,
        cwd: candidate.cwd,
        port: candidate.port
      })
      result.added.push(
        buildChange(createdConfig, 'Added a new AI-managed preview config from the project scan.')
      )
    }

    for (const config of aiManagedConfigs) {
      if (deletedIds.has(config.id) || !config.detectionKey) {
        continue
      }
      if (seenDetectionKeys.has(config.detectionKey)) {
        continue
      }

      this.previewConfigService.deleteConfig(config.id)
      result.deleted.push(
        buildChange(config, 'Removed the stale AI-managed preview config because it is no longer detected.')
      )
    }

    if (candidates.length === 0) {
      result.skipped.push({
        id: null,
        name: basename(normalizedWorkspacePath),
        ownership: 'ai-managed',
        launchCapability: 'config-only',
        detectionKey: null,
        reason: 'No supported preview scripts were detected in this project workspace.'
      })
    }

    result.configs = this.previewConfigService.getConfigsByProject(projectId)
    return result
  }

  private scanWorkspace(workspacePath: string): DetectionCandidate[] {
    const candidates: DetectionCandidate[] = []
    const seenKeys = new Set<string>()

    for (const packageJsonPath of this.findPackageJsonPaths(workspacePath)) {
      const directoryPath = dirname(packageJsonPath)
      const manifest = this.readPackageJson(packageJsonPath)
      const scripts = manifest.scripts ?? {}
      const dependencies = getDependencies(manifest)
      const packageManager = detectPackageManager(directoryPath, workspacePath)
      const relativeDirectory = relative(workspacePath, directoryPath) || '.'
      const detectionSource = relativeDirectory === '.' ? 'package.json' : `${relativeDirectory}/package.json`

      for (const [scriptName, rawScript] of Object.entries(scripts)) {
        const scriptCommand = rawScript.trim()
        if (!scriptCommand || EXCLUDED_SCRIPT_NAME_RE.test(scriptName)) {
          continue
        }
        if (!CANDIDATE_SCRIPT_NAME_RE.test(scriptName) && !INLINE_WEB_SCRIPT_RE.test(scriptCommand)) {
          continue
        }

        const detectionKey = `${relativeDirectory}#${scriptName}`
        if (seenKeys.has(detectionKey)) {
          continue
        }
        seenKeys.add(detectionKey)

        const launchCapability = inferLaunchCapability(scriptName, scriptCommand, dependencies)
        const candidate: DetectionCandidate = {
          name: buildDisplayName(manifest.name, scriptName, directoryPath, workspacePath),
          command: packageManager,
          args: ['run', scriptName],
          cwd: directoryPath === workspacePath ? null : directoryPath,
          port:
            launchCapability === 'inline-web'
              ? extractPort(scriptName, scriptCommand, dependencies)
              : null,
          type: inferPreviewType(launchCapability, scriptName, scriptCommand),
          launchCapability,
          detectionKey,
          detectionSignature: '',
          detectionSource
        }
        candidate.detectionSignature = buildConfigSignature(candidate)
        candidates.push(candidate)
      }
    }

    return candidates.sort((left, right) => left.detectionKey.localeCompare(right.detectionKey))
  }

  private findPackageJsonPaths(workspacePath: string): string[] {
    const packageJsonPaths: string[] = []
    const queue: Array<{ directoryPath: string; depth: number }> = [{
      directoryPath: workspacePath,
      depth: 0
    }]

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) {
        continue
      }

      const packageJsonPath = join(current.directoryPath, 'package.json')
      if (existsSync(packageJsonPath)) {
        packageJsonPaths.push(packageJsonPath)
      }

      if (current.depth >= MAX_SCAN_DEPTH) {
        continue
      }

      for (const entry of readdirSync(current.directoryPath, { withFileTypes: true })) {
        if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) {
          continue
        }

        queue.push({
          directoryPath: join(current.directoryPath, entry.name),
          depth: current.depth + 1
        })
      }
    }

    return packageJsonPaths.sort()
  }

  private readPackageJson(packageJsonPath: string): PackageJsonManifest {
    try {
      const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as unknown
      if (!isRecord(parsed)) {
        return {}
      }

      return {
        name: typeof parsed.name === 'string' ? parsed.name : undefined,
        scripts: isRecord(parsed.scripts)
          ? Object.fromEntries(
              Object.entries(parsed.scripts).filter(
                (entry): entry is [string, string] => typeof entry[1] === 'string'
              )
            )
          : undefined,
        dependencies: isRecord(parsed.dependencies)
          ? Object.fromEntries(
              Object.entries(parsed.dependencies).filter(
                (entry): entry is [string, string] => typeof entry[1] === 'string'
              )
            )
          : undefined,
        devDependencies: isRecord(parsed.devDependencies)
          ? Object.fromEntries(
              Object.entries(parsed.devDependencies).filter(
                (entry): entry is [string, string] => typeof entry[1] === 'string'
              )
            )
          : undefined
      }
    } catch {
      return {}
    }
  }
}
