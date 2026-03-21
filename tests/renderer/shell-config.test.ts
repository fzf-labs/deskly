import { describe, expect, it } from 'vitest'

import {
  APP_SHELL_LEFT_PANEL_MAX_WIDTH,
  APP_SHELL_LEFT_PANEL_MIN_WIDTH,
  clampLeftPanelWidth,
  resolveAppShellConfig,
  type AppShellConfig
} from '../../src/renderer/src/components/layout/shell-config'

describe('resolveAppShellConfig', () => {
  const defaultConfig: AppShellConfig = {
    left: {
      content: 'workspace',
      visible: true,
      width: 320,
      variant: 'workspace'
    },
    right: {
      content: 'detail',
      visible: false,
      width: 480,
      variant: 'detail'
    }
  }

  it('falls back to default panels when no override is provided', () => {
    expect(resolveAppShellConfig(defaultConfig, {})).toEqual(defaultConfig)
  })

  it('allows overriding the left panel', () => {
    expect(
      resolveAppShellConfig(defaultConfig, {
        left: {
          content: 'settings',
          width: 272,
          variant: 'settings'
        }
      })
    ).toEqual({
      left: {
        content: 'settings',
        visible: true,
        width: 272,
        variant: 'settings'
      },
      right: defaultConfig.right
    })
  })

  it('allows overriding the right panel', () => {
    expect(
      resolveAppShellConfig(defaultConfig, {
        right: {
          content: 'custom-detail',
          visible: true,
          width: '40vw'
        }
      })
    ).toEqual({
      left: defaultConfig.left,
      right: {
        content: 'custom-detail',
        visible: true,
        width: '40vw',
        variant: 'detail'
      }
    })
  })

  it('restores the default configuration after overrides are cleared', () => {
    const overridden = resolveAppShellConfig(defaultConfig, {
      left: {
        content: 'settings',
        visible: true,
        width: 272,
        variant: 'settings'
      },
      right: {
        content: 'custom-detail',
        visible: true,
        width: '40vw'
      }
    })

    expect(resolveAppShellConfig(defaultConfig, {})).toEqual(defaultConfig)
    expect(overridden.left?.content).toBe('settings')
    expect(overridden.right?.content).toBe('custom-detail')
  })
})

describe('clampLeftPanelWidth', () => {
  it('clamps widths below the minimum', () => {
    expect(clampLeftPanelWidth(APP_SHELL_LEFT_PANEL_MIN_WIDTH - 40)).toBe(
      APP_SHELL_LEFT_PANEL_MIN_WIDTH
    )
  })

  it('clamps widths above the maximum', () => {
    expect(clampLeftPanelWidth(APP_SHELL_LEFT_PANEL_MAX_WIDTH + 40)).toBe(
      APP_SHELL_LEFT_PANEL_MAX_WIDTH
    )
  })

  it('keeps widths within range unchanged', () => {
    expect(clampLeftPanelWidth(360)).toBe(360)
  })
})
