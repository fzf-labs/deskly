import { mkdtempSync } from 'fs'
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

describe('PreviewConfigService', () => {
  const createService = () => new PreviewConfigService()

  beforeEach(() => {
    hoisted.userDataPath = mkdtempSync(join(tmpdir(), 'deskly-preview-config-'))
    vi.useFakeTimers()
  })

  it('sorts project configs by explicit lastUsedAt and clears sibling last-used flags', () => {
    const service = createService()

    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const webConfig = service.addConfig({
      projectId: 'project-1',
      name: 'Web',
      command: 'npm',
      args: ['run', 'dev'],
      port: 3000
    })

    vi.setSystemTime(new Date('2026-01-01T00:01:00Z'))
    const adminConfig = service.addConfig({
      projectId: 'project-1',
      name: 'Admin',
      command: 'npm',
      args: ['run', 'admin'],
      port: 3001
    })

    vi.setSystemTime(new Date('2026-01-01T00:02:00Z'))
    service.updateConfig(webConfig.id, { lastUsedAt: new Date().toISOString() })

    vi.setSystemTime(new Date('2026-01-01T00:03:00Z'))
    service.updateConfig(adminConfig.id, { lastUsedAt: new Date().toISOString() })

    const configs = service.getConfigsByProject('project-1')
    expect(configs.map((config) => config.id)).toEqual([adminConfig.id, webConfig.id])
    expect(service.getConfig(webConfig.id)?.lastUsedAt).toBeNull()
    expect(service.getConfig(adminConfig.id)?.lastUsedAt).toBe('2026-01-01T00:03:00.000Z')
  })

  it('falls back deterministically when the last-used config is deleted', () => {
    const service = createService()

    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const webConfig = service.addConfig({
      projectId: 'project-1',
      name: 'Web',
      command: 'npm',
      args: ['run', 'dev'],
      port: 3000
    })

    vi.setSystemTime(new Date('2026-01-01T00:01:00Z'))
    const adminConfig = service.addConfig({
      projectId: 'project-1',
      name: 'Admin',
      command: 'npm',
      args: ['run', 'admin'],
      port: 3001,
      lastUsedAt: '2026-01-01T00:01:00.000Z'
    })

    vi.setSystemTime(new Date('2026-01-01T00:02:00Z'))
    const docsConfig = service.addConfig({
      projectId: 'project-1',
      name: 'Docs',
      command: 'npm',
      args: ['run', 'docs'],
      port: 3002
    })

    expect(service.deleteConfig(adminConfig.id)).toBe(true)
    expect(service.getConfigsByProject('project-1').map((config) => config.id)).toEqual([
      webConfig.id,
      docsConfig.id
    ])
  })

  it('defaults manual configs to inline-web ownership metadata and reloads persisted values', () => {
    const service = createService()
    const created = service.addConfig({
      projectId: 'project-1',
      name: 'Web',
      command: 'npm',
      args: ['run', 'dev'],
      port: 3000
    })

    expect(created.ownership).toBe('manual')
    expect(created.launchCapability).toBe('inline-web')
    expect(created.detectionKey).toBeNull()
    expect(created.detectionSignature).toBeNull()
    expect(created.detectionSource).toBeNull()

    const reloaded = createService().getConfig(created.id)
    expect(reloaded).toEqual(
      expect.objectContaining({
        ownership: 'manual',
        launchCapability: 'inline-web',
        detectionKey: null,
        detectionSignature: null,
        detectionSource: null
      })
    )
  })
})
