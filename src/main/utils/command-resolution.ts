import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { safeExecFile } from './safe-exec'

const execFileAsync = promisify(execFile)

const DEFAULT_LOOKUP_TIMEOUT_MS = 1500
const SHELL_PATH_TIMEOUT_MS = 5000

export type CommandResolutionSource = 'direct-path' | 'path' | 'shell-path'

export interface ResolvedCommand {
  executablePath: string
  args: string[]
  env: NodeJS.ProcessEnv
  source: CommandResolutionSource
}

export class CommandResolutionError extends Error {
  kind: 'parse' | 'not-found'

  constructor(message: string, kind: 'parse' | 'not-found' = 'parse') {
    super(message)
    this.name = 'CommandResolutionError'
    this.kind = kind
  }
}

let cachedShellPathPromise: Promise<string | null> | null = null

const dedupe = <T>(values: T[]): T[] => {
  const seen = new Set<T>()
  return values.filter((value) => {
    if (seen.has(value)) {
      return false
    }
    seen.add(value)
    return true
  })
}

const getPathKey = (env: NodeJS.ProcessEnv): string =>
  Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH'

const mergePathValues = (primary: string, secondary: string, delimiter: string): string => {
  const merged = new Set(
    [...primary.split(delimiter), ...secondary.split(delimiter)].map((entry) => entry.trim()).filter(Boolean)
  )
  return Array.from(merged).join(delimiter)
}

const expandHomeDir = (value: string): string => {
  if (value === '~') {
    return os.homedir()
  }

  if (value.startsWith(`~${path.sep}`) || value.startsWith('~/')) {
    return path.join(os.homedir(), value.slice(2))
  }

  return value
}

const hasPathSeparator = (value: string): boolean => value.includes('/') || value.includes('\\')

const resolveDirectExecutablePath = (command: string): string | undefined => {
  const expanded = expandHomeDir(command)

  if (!path.isAbsolute(expanded) && !hasPathSeparator(expanded)) {
    return undefined
  }

  const candidate = path.isAbsolute(expanded) ? expanded : path.resolve(expanded)
  return fs.existsSync(candidate) ? candidate : undefined
}

const getLookupCommand = (): string => {
  if (os.platform() === 'win32') {
    return 'where'
  }

  return fs.existsSync('/usr/bin/which') ? '/usr/bin/which' : 'which'
}

const buildMergedEnv = (env: NodeJS.ProcessEnv, freshPath: string): NodeJS.ProcessEnv => {
  const pathKey = getPathKey(env)
  const delimiter = os.platform() === 'win32' ? ';' : ':'
  const currentPath = env[pathKey] ?? ''
  const mergedPath = mergePathValues(currentPath, freshPath, delimiter)

  return {
    ...env,
    [pathKey]: mergedPath
  }
}

const persistRefreshedProcessPath = (freshPath: string): void => {
  const pathKey = getPathKey(process.env)
  const delimiter = os.platform() === 'win32' ? ';' : ':'
  const currentPath = process.env[pathKey] ?? ''
  process.env[pathKey] = mergePathValues(currentPath, freshPath, delimiter)
}

const lookupExecutablePath = async (
  command: string,
  env: NodeJS.ProcessEnv,
  allowlist: ReadonlySet<string> | string[],
  timeoutMs: number
): Promise<string | undefined> => {
  try {
    const { stdout } = await safeExecFile(getLookupCommand(), [command], {
      env,
      allowlist,
      timeoutMs,
      label: 'CommandResolution'
    })

    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0)
  } catch {
    return undefined
  }
}

const runShellForPath = async (shellPath: string): Promise<string | null> => {
  if (!path.isAbsolute(shellPath) || !fs.existsSync(shellPath)) {
    return null
  }

  const shellName = path.basename(shellPath)
  const args =
    shellName === 'zsh' || shellName === 'bash'
      ? ['-ilc', 'printf %s "$PATH"']
      : ['-c', 'printf %s "$PATH"']

  try {
    const { stdout } = await execFileAsync(shellPath, args, {
      env: { ...process.env, TERM: 'dumb' },
      timeout: SHELL_PATH_TIMEOUT_MS,
      windowsHide: true,
      encoding: 'utf8'
    })
    const nextPath = stdout.trim()
    return nextPath.length > 0 ? nextPath : null
  } catch {
    return null
  }
}

const loadShellPath = async (): Promise<string | null> => {
  if (os.platform() === 'win32') {
    return null
  }

  const shellCandidates = dedupe(
    [process.env.SHELL, '/bin/zsh', '/bin/bash', '/bin/sh'].filter(
      (value): value is string => typeof value === 'string' && value.length > 0
    )
  )

  let mergedPath = ''
  for (const shellPath of shellCandidates) {
    const shellResolvedPath = await runShellForPath(shellPath)
    if (!shellResolvedPath) {
      continue
    }

    mergedPath = mergedPath
      ? mergePathValues(mergedPath, shellResolvedPath, ':')
      : shellResolvedPath
  }

  return mergedPath || null
}

const getRefreshedShellPath = async (): Promise<string | null> => {
  if (!cachedShellPathPromise) {
    cachedShellPathPromise = loadShellPath()
  }

  return cachedShellPathPromise
}

export const parseCommandString = (input: string): string[] => {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new CommandResolutionError('Command cannot be empty.', 'parse')
  }

  const parts: string[] = []
  let current = ''
  let inSingle = false
  let inDouble = false
  let escaping = false

  for (const char of trimmed) {
    if (escaping) {
      current += char
      escaping = false
      continue
    }

    if (char === '\\' && !inSingle) {
      escaping = true
      continue
    }

    if (char === "'" && !inDouble) {
      inSingle = !inSingle
      continue
    }

    if (char === '"' && !inSingle) {
      inDouble = !inDouble
      continue
    }

    if (!inSingle && !inDouble && /\s/.test(char)) {
      if (current) {
        parts.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (escaping || inSingle || inDouble) {
    throw new CommandResolutionError(`Unable to parse command: ${input}`, 'parse')
  }

  if (current) {
    parts.push(current)
  }

  if (parts.length === 0) {
    throw new CommandResolutionError('Command cannot be empty.', 'parse')
  }

  return parts
}

export const resolveCommand = async (
  commandText: string,
  options: {
    env?: NodeJS.ProcessEnv
    allowlist: ReadonlySet<string> | string[]
    timeoutMs?: number
  }
): Promise<ResolvedCommand> => {
  const [command, ...args] = parseCommandString(commandText)
  const env = { ...(options.env ?? process.env) }
  const timeoutMs = options.timeoutMs ?? DEFAULT_LOOKUP_TIMEOUT_MS
  const directPath = resolveDirectExecutablePath(command)

  if (directPath) {
    return {
      executablePath: directPath,
      args,
      env,
      source: 'direct-path'
    }
  }

  const currentPathMatch = await lookupExecutablePath(command, env, options.allowlist, timeoutMs)
  if (currentPathMatch) {
    return {
      executablePath: currentPathMatch,
      args,
      env,
      source: 'path'
    }
  }

  const shellPath = await getRefreshedShellPath()
  if (shellPath) {
    persistRefreshedProcessPath(shellPath)
    const refreshedEnv = buildMergedEnv(env, shellPath)
    const refreshedPathMatch = await lookupExecutablePath(
      command,
      refreshedEnv,
      options.allowlist,
      timeoutMs
    )

    if (refreshedPathMatch) {
      return {
        executablePath: refreshedPathMatch,
        args,
        env: refreshedEnv,
        source: 'shell-path'
      }
    }
  }

  throw new CommandResolutionError(`Executable not found for command: ${commandText}`, 'not-found')
}

export const normalizeProcessCommandSpec = async <T extends {
  command: string
  args: string[]
  env?: NodeJS.ProcessEnv
}>(
  spec: T,
  options: {
    allowlist: ReadonlySet<string> | string[]
    timeoutMs?: number
  }
): Promise<T> => {
  const resolved = await resolveCommand(spec.command, {
    env: spec.env,
    allowlist: options.allowlist,
    timeoutMs: options.timeoutMs
  })

  return {
    ...spec,
    command: resolved.executablePath,
    args: [...resolved.args, ...spec.args],
    env: resolved.env
  }
}
