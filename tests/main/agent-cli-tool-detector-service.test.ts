import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const tempDirs: string[] = []

const loadService = async ({
  homeDir,
  safeExecImpl
}: {
  homeDir: string
  safeExecImpl: (command: string, args: string[], execOptions?: { env?: NodeJS.ProcessEnv }) => Promise<{
    stdout: string
    stderr?: string
  }>
}) => {
  vi.resetModules()

  const safeExecFile = vi.fn(safeExecImpl)

  vi.doMock('os', async () => {
    const actual = await vi.importActual<typeof import('os')>('os')
    return {
      ...actual,
      homedir: () => homeDir
    }
  })
  vi.doMock('../../src/main/utils/safe-exec', () => ({
    safeExecFile
  }))

  const [{ AgentCLIToolDetectorService }, { AgentCLIToolConfigService }] = await Promise.all([
    import('../../src/main/services/AgentCLIToolDetectorService'),
    import('../../src/main/services/AgentCLIToolConfigService')
  ])

  return {
    service: new AgentCLIToolDetectorService(new AgentCLIToolConfigService()),
    safeExecFile
  }
}

afterEach(() => {
  vi.resetModules()
  vi.unmock('os')
  vi.unmock('../../src/main/utils/safe-exec')
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop()
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  }
})

describe('AgentCLIToolDetectorService', () => {
  it('reports config and executable state separately for command overrides', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'deskly-agent-cli-detector-'))
    tempDirs.push(homeDir)

    const codexConfigDir = join(homeDir, '.codex')
    mkdirSync(codexConfigDir, { recursive: true })
    writeFileSync(
      join(codexConfigDir, 'config.json'),
      JSON.stringify({
        base_command_override: 'npx -y "@openai/codex@latest"'
      })
    )

    const { service, safeExecFile } = await loadService({
      homeDir,
      safeExecImpl: async (command, args) => {
        const key = JSON.stringify([command, ...args])

        if (key === JSON.stringify(['/usr/bin/which', 'npx']) || key === JSON.stringify(['which', 'npx'])) {
          return { stdout: '/usr/local/bin/npx\n' }
        }

        if (
          key ===
            JSON.stringify(['/usr/local/bin/npx', '-y', '@openai/codex@latest', '--version']) ||
          key === JSON.stringify(['/usr/local/bin/npx', '-y', '"@openai/codex@latest"', '--version'])
        ) {
          return { stdout: 'codex 0.1.0\n' }
        }

        throw new Error(`Unexpected command: ${key}`)
      }
    })

    const detected = await service.detectTool('codex', { level: 'full', force: true })

    expect(detected).toEqual(
      expect.objectContaining({
        id: 'codex',
        configState: 'valid',
        configValid: true,
        executableState: 'resolved',
        installState: 'installed',
        installed: true,
        installPath: '/usr/local/bin/npx',
        executableCommand: 'npx -y "@openai/codex@latest"',
        version: 'codex 0.1.0'
      })
    )
    expect(safeExecFile).toHaveBeenCalled()
  })

  it('marks modern native config locations as valid config files', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'deskly-agent-cli-detector-modern-config-'))
    tempDirs.push(homeDir)

    const codexConfigDir = join(homeDir, '.codex')
    mkdirSync(codexConfigDir, { recursive: true })
    writeFileSync(join(codexConfigDir, 'config.toml'), 'model = "gpt-5.4"\n')

    const { service } = await loadService({
      homeDir,
      safeExecImpl: async (command, args) => {
        const key = JSON.stringify([command, ...args])

        if (key === JSON.stringify(['/usr/bin/which', 'codex']) || key === JSON.stringify(['which', 'codex'])) {
          return { stdout: '/opt/homebrew/bin/codex\n' }
        }

        if (key === JSON.stringify(['/opt/homebrew/bin/codex', '--version'])) {
          return { stdout: 'codex 0.1.0\n' }
        }

        throw new Error(`Unexpected command: ${key}`)
      }
    })

    const detected = await service.detectTool('codex', { level: 'full', force: true })

    expect(detected).toEqual(
      expect.objectContaining({
        id: 'codex',
        configState: 'valid',
        configValid: true,
        configPath: join(homeDir, '.codex', 'config.toml')
      })
    )
  })
})
