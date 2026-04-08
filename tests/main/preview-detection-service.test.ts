import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  userDataPath: ''
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => hoisted.userDataPath)
  }
}))

import { PreviewConfigService } from '../../src/main/services/PreviewConfigService'
import { PreviewDetectionService } from '../../src/main/services/PreviewDetectionService'

const createWorkspace = () => mkdtempSync(join(tmpdir(), 'deskly-preview-detect-workspace-'))

const writePackageJson = (workspacePath: string, value: unknown): void => {
  writeFileSync(join(workspacePath, 'package.json'), JSON.stringify(value, null, 2))
}

describe('PreviewDetectionService', () => {
  beforeEach(() => {
    hoisted.userDataPath = mkdtempSync(join(tmpdir(), 'deskly-preview-detect-config-'))
  })

  it('detects inline-web and config-only scripts and persists AI-managed configs', () => {
    const workspacePath = createWorkspace()
    writePackageJson(workspacePath, {
      name: '@repo/app',
      scripts: {
        dev: 'vite',
        'start:api': 'node server.js',
        lint: 'eslint .'
      },
      devDependencies: {
        vite: '^5.0.0'
      }
    })

    const configService = new PreviewConfigService()
    const detectionService = new PreviewDetectionService(configService)
    const result = detectionService.detectAndSync('project-1', workspacePath)

    expect(result.added).toHaveLength(2)
    expect(result.updated).toHaveLength(0)
    expect(result.deleted).toHaveLength(0)

    const webConfig = result.configs.find((config) => config.detectionKey === '.#dev')
    const apiConfig = result.configs.find((config) => config.detectionKey === '.#start:api')

    expect(webConfig).toEqual(
      expect.objectContaining({
        ownership: 'ai-managed',
        launchCapability: 'inline-web',
        command: 'npm',
        args: ['run', 'dev'],
        port: 5173
      })
    )
    expect(apiConfig).toEqual(
      expect.objectContaining({
        ownership: 'ai-managed',
        launchCapability: 'config-only',
        command: 'npm',
        args: ['run', 'start:api'],
        port: null
      })
    )
  })

  it('keeps exact manual duplicates and removes matching AI-managed duplicates', () => {
    const workspacePath = createWorkspace()
    writePackageJson(workspacePath, {
      name: 'web-app',
      scripts: {
        dev: 'vite'
      },
      devDependencies: {
        vite: '^5.0.0'
      }
    })

    const configService = new PreviewConfigService()
    const detectionService = new PreviewDetectionService(configService)
    const firstResult = detectionService.detectAndSync('project-1', workspacePath)
    const aiConfig = firstResult.configs[0]
    configService.updateConfig(aiConfig.id, {
      lastUsedAt: '2026-01-01T00:10:00.000Z'
    })

    const manualConfig = configService.addConfig({
      projectId: 'project-1',
      name: 'My Dev Server',
      command: 'npm',
      args: ['run', 'dev'],
      port: 5173
    })

    const secondResult = detectionService.detectAndSync('project-1', workspacePath)
    const finalConfigs = configService.getConfigsByProject('project-1')

    expect(secondResult.deleted).toEqual([
      expect.objectContaining({
        id: aiConfig.id,
        ownership: 'ai-managed'
      })
    ])
    expect(secondResult.skipped).toEqual([
      expect.objectContaining({
        id: manualConfig.id,
        ownership: 'manual'
      })
    ])
    expect(finalConfigs).toHaveLength(1)
    expect(finalConfigs[0]).toEqual(
      expect.objectContaining({
        id: manualConfig.id,
        ownership: 'manual',
        lastUsedAt: '2026-01-01T00:10:00.000Z'
      })
    )
  })

  it('removes stale AI-managed configs that disappear from the project scan', () => {
    const workspacePath = createWorkspace()
    writePackageJson(workspacePath, {
      name: 'workspace',
      scripts: {
        dev: 'vite'
      },
      devDependencies: {
        vite: '^5.0.0'
      }
    })

    const configService = new PreviewConfigService()
    const detectionService = new PreviewDetectionService(configService)
    detectionService.detectAndSync('project-1', workspacePath)

    writePackageJson(workspacePath, {
      name: 'workspace',
      scripts: {
        lint: 'eslint .'
      }
    })

    const nextResult = detectionService.detectAndSync('project-1', workspacePath)

    expect(nextResult.deleted).toEqual([
      expect.objectContaining({
        ownership: 'ai-managed',
        detectionKey: '.#dev'
      })
    ])
    expect(configService.getConfigsByProject('project-1')).toHaveLength(0)
    expect(nextResult.skipped[0]?.reason).toContain('No supported preview scripts')
  })

  it('detects nested package scripts from the authoritative workspace root', () => {
    const workspacePath = createWorkspace()
    const packagePath = join(workspacePath, 'apps', 'web')
    mkdirSync(packagePath, { recursive: true })
    writeFileSync(join(workspacePath, 'pnpm-lock.yaml'), '')
    writePackageJson(workspacePath, {
      name: 'workspace',
      scripts: {
        lint: 'pnpm lint'
      }
    })
    writePackageJson(packagePath, {
      name: '@repo/web',
      scripts: {
        dev: 'vite --port 4300'
      },
      devDependencies: {
        vite: '^5.0.0'
      }
    })

    const configService = new PreviewConfigService()
    const detectionService = new PreviewDetectionService(configService)
    const result = detectionService.detectAndSync('project-1', workspacePath)

    expect(result.configs).toEqual([
      expect.objectContaining({
        command: 'pnpm',
        args: ['run', 'dev'],
        cwd: packagePath,
        port: 4300,
        detectionKey: 'apps/web#dev'
      })
    ])
  })
})
