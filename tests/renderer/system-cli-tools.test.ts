import { describe, expect, it } from 'vitest'

import {
  filterRecommendedSystemCliTools,
  getSystemCliDocsUrl,
  getSystemCliInstalledSources,
  getSystemCliPrimarySupportedSource,
  getSystemCliSupportedSources
} from '../../src/renderer/src/features/cli-tools'
import {
  DEFAULT_RECOMMENDED_SYSTEM_CLI_TOOL_IDS,
  SYSTEM_CLI_INSTALLED_SOURCES,
  SYSTEM_CLI_PACKAGE_MANAGERS,
  SYSTEM_CLI_TOOLS,
  type SystemCliToolInfo
} from '../../src/shared/system-cli-tools'

const jqDefinition = SYSTEM_CLI_TOOLS.find((tool) => tool.id === 'jq')

if (!jqDefinition) {
  throw new Error('jq definition is required for system CLI tool tests')
}

const createTool = (overrides: Partial<SystemCliToolInfo> = {}): SystemCliToolInfo => ({
  ...jqDefinition,
  platform: 'darwin',
  installState: 'missing',
  ...overrides
})

describe('system CLI tool model helpers', () => {
  it('returns PATH/System as the only installed source for system-detected tools', () => {
    const tool = createTool({
      installed: true,
      installState: 'installed',
      installedVia: 'system',
      installPath: '/usr/bin/jq'
    })

    expect(getSystemCliInstalledSources(tool)).toEqual(['system'])
    expect(getSystemCliSupportedSources(tool)).toEqual(['brew'])
  })

  it('falls back to supported sources when an installed tool has no explicit installed source', () => {
    const tool = createTool({
      installed: true,
      installState: 'installed'
    })

    expect(getSystemCliInstalledSources(tool)).toEqual(['brew'])
  })

  it('keeps PATH/System out of recommended install sources and constants', () => {
    const tool = createTool()

    expect(getSystemCliSupportedSources(tool)).toEqual(['brew'])
    expect(getSystemCliPrimarySupportedSource(tool)).toBe('brew')
    expect(SYSTEM_CLI_PACKAGE_MANAGERS).toEqual(expect.not.arrayContaining(['system']))
    expect(SYSTEM_CLI_INSTALLED_SOURCES).toEqual(expect.arrayContaining(['system']))
  })

  it('falls back to the tool documentation URL when installed via PATH/System', () => {
    const tool = createTool({
      installed: true,
      installState: 'installed',
      installedVia: 'system'
    })

    expect(getSystemCliDocsUrl(tool)).toBe(jqDefinition.docsUrl)
  })

  it('filters recommended tools using the fixed curated catalog and keeps installed items', () => {
    const ffmpegDefinition = SYSTEM_CLI_TOOLS.find((tool) => tool.id === 'ffmpeg')
    if (!ffmpegDefinition) {
      throw new Error('ffmpeg definition is required for recommendation catalog tests')
    }

    const ffmpegTool: SystemCliToolInfo = {
      ...ffmpegDefinition,
      platform: 'darwin',
      installState: 'missing',
      installed: false
    }
    const jqInstalled = createTool({
      installed: true,
      installState: 'installed',
      installedVia: 'system'
    })
    const unknownTool: SystemCliToolInfo = {
      ...ffmpegTool,
      id: 'brew:unknown',
      displayName: 'unknown',
      command: 'unknown',
      binNames: ['unknown'],
      installed: true,
      installState: 'installed'
    }

    expect(DEFAULT_RECOMMENDED_SYSTEM_CLI_TOOL_IDS).toEqual(
      expect.arrayContaining(['ffmpeg', 'jq'])
    )
    expect(filterRecommendedSystemCliTools([ffmpegTool, jqInstalled, unknownTool])).toEqual([
      expect.objectContaining({ id: 'ffmpeg', installed: false }),
      expect.objectContaining({ id: 'jq', installed: true })
    ])
  })

  it('uses the first supported package manager as the primary recommended source', () => {
    const ytDlpDefinition = SYSTEM_CLI_TOOLS.find((tool) => tool.id === 'yt-dlp')
    if (!ytDlpDefinition) {
      throw new Error('yt-dlp definition is required for primary source tests')
    }

    const ytDlpTool: SystemCliToolInfo = {
      ...ytDlpDefinition,
      platform: 'darwin',
      installState: 'missing',
      installed: false
    }

    expect(getSystemCliSupportedSources(ytDlpTool)).toEqual(['brew', 'pipx'])
    expect(getSystemCliPrimarySupportedSource(ytDlpTool)).toBe('brew')
  })
})
