import { afterEach, describe, expect, it, vi } from 'vitest'

const loadModule = async (options?: {
  safeExecImpl?: (command: string, args: string[], execOptions?: { env?: NodeJS.ProcessEnv }) => Promise<{
    stdout: string
    stderr?: string
  }>
  shellPath?: string | null
}) => {
  vi.resetModules()

  const safeExecFile = vi.fn(
    options?.safeExecImpl ??
      (async () => ({
        stdout: '',
        stderr: ''
      }))
  )

  const execFile = vi.fn((command, args, execOptions, callback) => {
    const cb = typeof execOptions === 'function' ? execOptions : callback
    cb?.(null, options?.shellPath ?? '', '')
    return {} as never
  })
  ;(execFile as unknown as Record<symbol, unknown>)[Symbol.for('nodejs.util.promisify.custom')] =
    vi.fn(async () => ({
      stdout: options?.shellPath ?? '',
      stderr: ''
    }))

  vi.doMock('../../src/main/utils/safe-exec', () => ({
    safeExecFile
  }))
  vi.doMock('child_process', async () => {
    const actual = await vi.importActual<typeof import('child_process')>('child_process')
    return {
      ...actual,
      execFile
    }
  })

  const mod = await import('../../src/main/utils/command-resolution')

  return {
    ...mod,
    safeExecFile,
    execFile
  }
}

afterEach(() => {
  vi.resetModules()
  vi.unmock('../../src/main/utils/safe-exec')
  vi.unmock('child_process')
})

describe('command resolution', () => {
  it('parses command overrides with quoted arguments', async () => {
    const { parseCommandString } = await loadModule()

    expect(parseCommandString('npx -y "@openai/codex@latest"')).toEqual([
      'npx',
      '-y',
      '@openai/codex@latest'
    ])
  })

  it('prepends command override args when normalizing a process spec', async () => {
    const { normalizeProcessCommandSpec } = await loadModule({
      safeExecImpl: async (command, args) => {
        const key = JSON.stringify([command, ...args])
        if (key === JSON.stringify(['/usr/bin/which', 'npx']) || key === JSON.stringify(['which', 'npx'])) {
          return { stdout: '/usr/local/bin/npx\n' }
        }
        throw new Error(`Unexpected lookup: ${key}`)
      }
    })

    const normalized = await normalizeProcessCommandSpec(
      {
        command: 'npx -y "@openai/codex@latest"',
        args: ['exec', '--json'],
        cwd: '/tmp/workdir',
        env: { PATH: '/usr/bin:/bin' }
      },
      {
        allowlist: ['which', 'npx']
      }
    )

    expect(normalized.command).toBe('/usr/local/bin/npx')
    expect(normalized.args).toEqual(['-y', '@openai/codex@latest', 'exec', '--json'])
  })

  it('refreshes PATH from the login shell when the current app PATH cannot resolve the executable', async () => {
    const { resolveCommand, safeExecFile } = await loadModule({
      shellPath: '/usr/bin:/bin:/opt/homebrew/bin',
      safeExecImpl: async (command, args, execOptions) => {
        const key = JSON.stringify([command, ...args])
        const currentPath = execOptions?.env?.PATH ?? ''

        if (
          (key === JSON.stringify(['/usr/bin/which', 'codex']) || key === JSON.stringify(['which', 'codex'])) &&
          currentPath.includes('/opt/homebrew/bin')
        ) {
          return { stdout: '/opt/homebrew/bin/codex\n' }
        }

        if (key === JSON.stringify(['/usr/bin/which', 'codex']) || key === JSON.stringify(['which', 'codex'])) {
          return { stdout: '' }
        }

        throw new Error(`Unexpected lookup: ${key}`)
      }
    })

    const resolved = await resolveCommand('codex', {
      env: { PATH: '/usr/bin:/bin' },
      allowlist: ['which', 'codex']
    })

    expect(resolved.source).toBe('shell-path')
    expect(resolved.executablePath).toBe('/opt/homebrew/bin/codex')
    expect(resolved.env.PATH).toContain('/opt/homebrew/bin')
    expect(safeExecFile).toHaveBeenCalledTimes(2)
  })
})
