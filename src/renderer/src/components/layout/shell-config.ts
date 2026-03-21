import type { ReactNode } from 'react'

export type ShellPanelVariant = 'workspace' | 'settings' | 'detail'

export const APP_SHELL_LEFT_PANEL_WIDTH = 320
export const APP_SHELL_LEFT_PANEL_MIN_WIDTH = 240
export const APP_SHELL_LEFT_PANEL_MAX_WIDTH = 420

export interface AppShellPanelSpec {
  content?: ReactNode
  visible?: boolean
  width?: string | number
  variant?: ShellPanelVariant
}

export interface AppShellConfig {
  left?: AppShellPanelSpec
  right?: AppShellPanelSpec
}

export function clampLeftPanelWidth(width: number) {
  return Math.min(APP_SHELL_LEFT_PANEL_MAX_WIDTH, Math.max(APP_SHELL_LEFT_PANEL_MIN_WIDTH, width))
}

function mergePanelSpec(
  baseSpec?: AppShellPanelSpec,
  overrideSpec?: AppShellPanelSpec
): AppShellPanelSpec | undefined {
  if (!baseSpec && !overrideSpec) return undefined
  if (!baseSpec) return overrideSpec
  if (!overrideSpec) return baseSpec
  return { ...baseSpec, ...overrideSpec }
}

export function resolveAppShellConfig(
  defaultConfig: AppShellConfig,
  overrideConfig: AppShellConfig
): AppShellConfig {
  return {
    left: mergePanelSpec(defaultConfig.left, overrideConfig.left),
    right: mergePanelSpec(defaultConfig.right, overrideConfig.right)
  }
}
