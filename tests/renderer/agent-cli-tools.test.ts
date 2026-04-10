import { describe, expect, it } from 'vitest'

import {
  isCliToolInstalled,
  normalizeCliTool
} from '../../src/renderer/src/features/cli-tools/model/agent-cli-tools'

describe('agent cli tool normalization', () => {
  it('derives install state from executable state', () => {
    const tool = normalizeCliTool({
      id: 'codex',
      executableState: 'resolved',
      configState: 'missing'
    })

    expect(tool.installState).toBe('installed')
    expect(tool.installed).toBe(true)
    expect(tool.executableState).toBe('resolved')
    expect(tool.configState).toBe('missing')
    expect(isCliToolInstalled(tool)).toBe(true)
  })

  it('keeps unresolved executables out of the installed set even when config exists', () => {
    const tool = normalizeCliTool({
      id: 'codex',
      executableState: 'missing',
      configState: 'valid'
    })

    expect(tool.installState).toBe('missing')
    expect(tool.installed).toBe(false)
    expect(isCliToolInstalled(tool)).toBe(false)
  })
})
