import { describe, expect, it } from 'vitest'

import type { PreviewConfig } from '../../src/shared/contracts/preview'
import {
  canOpenInlinePreview,
  formatCommandLine,
  getPreviewInstanceId,
  resolvePreviewWorkingDir,
  resolveSelectedPreviewConfigId,
  selectDefaultPreviewConfig,
  summarizePreviewSyncResult,
  splitCommandLine
} from '../../src/renderer/src/features/task-detail/model/preview'

const createConfig = (overrides: Partial<PreviewConfig> = {}): PreviewConfig => ({
  id: 'config-1',
  name: 'Web',
  projectId: 'project-1',
  type: 'frontend',
  ownership: 'manual',
  launchCapability: 'inline-web',
  detectionKey: null,
  detectionSignature: null,
  detectionSource: null,
  command: 'npm',
  args: ['run', 'dev'],
  cwd: '/workspace',
  port: 3000,
  lastUsedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides
})

describe('task-detail preview model helpers', () => {
  it('builds a stable project-scoped preview instance id', () => {
    expect(getPreviewInstanceId('project-123')).toBe('task-detail-preview:project-123')
  })

  it('selects the first config but still requires manual start when it is marked as last used', () => {
    const webConfig = createConfig({
      id: 'web',
      lastUsedAt: '2026-01-01T00:10:00.000Z'
    })
    const adminConfig = createConfig({
      id: 'admin',
      name: 'Admin',
      port: 3001,
      lastUsedAt: null
    })

    expect(selectDefaultPreviewConfig([webConfig, adminConfig])).toEqual({
      config: webConfig,
      shouldAutoStart: false
    })
  })

  it('falls back to the first config without auto-start when nothing is marked last used', () => {
    const webConfig = createConfig({ id: 'web', lastUsedAt: null })
    const adminConfig = createConfig({ id: 'admin', name: 'Admin', port: 3001, lastUsedAt: null })

    expect(selectDefaultPreviewConfig([webConfig, adminConfig])).toEqual({
      config: webConfig,
      shouldAutoStart: false
    })
  })

  it('selects a config-only last-used entry without auto-starting it', () => {
    const configOnly = createConfig({
      id: 'server',
      name: 'API',
      type: 'backend',
      launchCapability: 'config-only',
      port: null,
      lastUsedAt: '2026-01-01T00:10:00.000Z'
    })

    expect(selectDefaultPreviewConfig([configOnly])).toEqual({
      config: configOnly,
      shouldAutoStart: false
    })
  })

  it('prefers an explicit selected config when configs are reloaded after switching', () => {
    const webConfig = createConfig({ id: 'web', lastUsedAt: null })
    const adminConfig = createConfig({
      id: 'admin',
      name: 'Admin',
      port: 3001,
      lastUsedAt: '2026-01-01T00:10:00.000Z'
    })

    expect(resolveSelectedPreviewConfigId([adminConfig, webConfig], 'web', 'admin')).toBe('admin')
  })

  it('falls back to the current selection when the preferred config is unavailable', () => {
    const webConfig = createConfig({ id: 'web', lastUsedAt: null })
    const adminConfig = createConfig({
      id: 'admin',
      name: 'Admin',
      port: 3001,
      lastUsedAt: '2026-01-01T00:10:00.000Z'
    })

    expect(resolveSelectedPreviewConfigId([adminConfig, webConfig], 'web', 'missing')).toBe('web')
    expect(resolveSelectedPreviewConfigId([adminConfig, webConfig], 'missing', 'missing')).toBe(
      'admin'
    )
  })

  it('splits quoted command lines into command and args', () => {
    expect(splitCommandLine('npm run preview -- --host "0.0.0.0"')).toEqual([
      'npm',
      'run',
      'preview',
      '--',
      '--host',
      '0.0.0.0'
    ])
  })

  it('formats command lines with quoting for spaced arguments', () => {
    expect(formatCommandLine('npm', ['run', 'preview site'])).toBe('npm run \"preview site\"')
  })

  it('resolves preview cwd from config first and falls back to the task workspace', () => {
    expect(resolvePreviewWorkingDir('/custom/app', '/workspace')).toBe('/custom/app')
    expect(resolvePreviewWorkingDir('', '/workspace')).toBe('/workspace')
    expect(resolvePreviewWorkingDir(undefined, null)).toBeUndefined()
  })

  it('opens inline preview only for inline-web configs with a port', () => {
    expect(canOpenInlinePreview(createConfig())).toBe(true)
    expect(canOpenInlinePreview(createConfig({ port: null }))).toBe(false)
    expect(
      canOpenInlinePreview(
        createConfig({
          type: 'backend',
          launchCapability: 'config-only',
          port: 3000
        })
      )
    ).toBe(false)
  })

  it('summarizes preview sync counts for renderer notices', () => {
    expect(
      summarizePreviewSyncResult({
        workspacePath: '/workspace',
        configs: [],
        added: [
          {
            id: '1',
            name: 'Web',
            ownership: 'ai-managed',
            launchCapability: 'inline-web',
            reason: 'added'
          }
        ],
        updated: [
          {
            id: '2',
            name: 'API',
            ownership: 'ai-managed',
            launchCapability: 'config-only',
            reason: 'updated'
          }
        ],
        deleted: [],
        skipped: [
          {
            id: null,
            name: 'Workspace',
            ownership: 'ai-managed',
            launchCapability: 'config-only',
            reason: 'skipped'
          }
        ]
      })
    ).toEqual({
      added: 1,
      updated: 1,
      deleted: 0,
      skipped: 1
    })
  })
})
