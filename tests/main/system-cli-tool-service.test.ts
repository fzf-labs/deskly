import { afterEach, describe, expect, it, vi } from 'vitest'

type MockExecResponse = {
  stdout: string
  stderr?: string
}

const buildDarwinPackageResponses = (formulae: Array<{ name: string; version?: string }> = []) => ({
  ['["brew","info","--json=v2","--installed"]']: {
    stdout: JSON.stringify({
      formulae: Array.isArray(formulae)
        ? formulae.map((formula) => ({
            name: formula.name,
            installed: formula.version ? [{ version: formula.version }] : []
          }))
        : []
    })
  },
  ['["pipx","list","--json"]']: { stdout: JSON.stringify({ venvs: {} }) },
  ['["npm","-g","ls","--depth=0","--json","--silent"]']: {
    stdout: JSON.stringify({ dependencies: {} })
  },
  ['["npm","root","-g"]']: { stdout: '/usr/local/lib/node_modules\n' },
  ['["cargo","install","--list"]']: { stdout: '' }
})

const loadSystemCliToolService = async ({
  platform,
  responses
}: {
  platform: NodeJS.Platform
  responses: Record<string, MockExecResponse>
}) => {
  vi.resetModules()

  const safeExecFile = vi.fn(async (command: string, args: string[]) => {
    const key = JSON.stringify([command, ...args])
    const matched = responses[key]

    if (matched) {
      return {
        stdout: matched.stdout,
        stderr: matched.stderr ?? ''
      }
    }

    if (command === 'which' || command === 'where') {
      return { stdout: '', stderr: '' }
    }

    if (args.length === 1 && args[0] === '--version') {
      return { stdout: '', stderr: '' }
    }

    throw new Error(`Unexpected command: ${key}`)
  })

  vi.doMock('os', async () => {
    const actual = await vi.importActual<typeof import('os')>('os')
    return {
      ...actual,
      platform: () => platform,
      arch: () => 'arm64',
      homedir: () => '/Users/test'
    }
  })

  vi.doMock('../../src/main/utils/safe-exec', () => ({
    safeExecFile
  }))

  const mod = await import('../../src/main/services/SystemCliToolService')

  return {
    SystemCliToolService: mod.SystemCliToolService,
    safeExecFile
  }
}

afterEach(() => {
  vi.resetModules()
  vi.unmock('os')
  vi.unmock('../../src/main/utils/safe-exec')
})

describe('SystemCliToolService', () => {
  it('marks a known darwin tool as installed via PATH/System when only the binary is available', async () => {
    const { SystemCliToolService } = await loadSystemCliToolService({
      platform: 'darwin',
      responses: {
        ...buildDarwinPackageResponses([]),
        ['["which","jq"]']: { stdout: '/usr/bin/jq\n' },
        ['["/usr/bin/jq","--version"]']: { stdout: 'jq-1.7.1-apple\n' }
      }
    })

    const service = new SystemCliToolService()
    const jq = await service.detectTool('jq', { level: 'full', force: true })
    const snapshot = service.getSnapshot()

    expect(jq).toEqual(
      expect.objectContaining({
        id: 'jq',
        installed: true,
        installedVia: 'system',
        installState: 'installed',
        installPath: '/usr/bin/jq',
        version: 'jq-1.7.1-apple'
      })
    )
    expect(snapshot.filter((tool) => tool.id === 'jq')).toHaveLength(1)
    expect(snapshot.some((tool) => tool.id === 'brew:jq')).toBe(false)
    expect(snapshot.filter((tool) => tool.installState === 'missing').map((tool) => tool.id)).not.toContain('jq')
  })

  it('keeps known darwin tools on their stable definition id when installed via brew', async () => {
    const { SystemCliToolService } = await loadSystemCliToolService({
      platform: 'darwin',
      responses: {
        ...buildDarwinPackageResponses([{ name: 'jq', version: '1.7.1' }]),
        ['["which","jq"]']: { stdout: '/opt/homebrew/bin/jq\n' },
        ['["/opt/homebrew/bin/jq","--version"]']: { stdout: 'jq-1.7.1\n' }
      }
    })

    const service = new SystemCliToolService()
    const tools = await service.refreshTools({ level: 'full', force: true })
    const jqEntries = tools.filter((tool) => tool.id === 'jq')

    expect(jqEntries).toHaveLength(1)
    expect(jqEntries[0]).toEqual(
      expect.objectContaining({
        installed: true,
        installedVia: 'brew',
        installState: 'installed',
        installPath: '/opt/homebrew/bin/jq',
        version: 'jq-1.7.1'
      })
    )
    expect(tools.some((tool) => tool.id === 'brew:jq')).toBe(false)
  })

  it('keeps unknown darwin packages as additional installed entries', async () => {
    const { SystemCliToolService } = await loadSystemCliToolService({
      platform: 'darwin',
      responses: {
        ...buildDarwinPackageResponses([{ name: 'mysterytool', version: '1.0.0' }]),
        ['["which","mysterytool"]']: { stdout: '/opt/homebrew/bin/mysterytool\n' },
        ['["/opt/homebrew/bin/mysterytool","--version"]']: { stdout: 'mysterytool 1.0.0\n' }
      }
    })

    const service = new SystemCliToolService()
    const tools = await service.refreshTools({ level: 'full', force: true })

    expect(tools).toContainEqual(
      expect.objectContaining({
        id: 'brew:mysterytool',
        displayName: 'mysterytool',
        installed: true,
        installedVia: 'brew',
        installState: 'installed',
        installPath: '/opt/homebrew/bin/mysterytool',
        version: 'mysterytool 1.0.0'
      })
    )
  })

  it('keeps non-darwin detection behavior unchanged for installedVia', async () => {
    const { SystemCliToolService } = await loadSystemCliToolService({
      platform: 'linux',
      responses: {
        ['["which","jq"]']: { stdout: '/usr/bin/jq\n' },
        ['["/usr/bin/jq","--version"]']: { stdout: 'jq-1.7\n' }
      }
    })

    const service = new SystemCliToolService()
    const jq = await service.detectTool('jq', { level: 'full', force: true })

    expect(jq).toEqual(
      expect.objectContaining({
        id: 'jq',
        installed: true,
        installedVia: undefined,
        installState: 'installed',
        installPath: '/usr/bin/jq',
        version: 'jq-1.7'
      })
    )
  })
})
