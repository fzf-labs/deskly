import type { Settings as SettingsType } from '@/data/settings'

export type { SettingsType }

export type SettingsCategory =
  | 'account'
  | 'general'
  | 'projects'
  | 'sound'
  | 'notification'
  | 'editor'
  | 'cliTools'
  | 'cli'
  | 'git'
  | 'pipelineTemplates'
  | 'mcp'
  | 'skills'
  | 'connector'
  | 'data'
  | 'about'

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  'account',
  'general',
  'projects',
  'sound',
  'notification',
  'editor',
  'cliTools',
  'cli',
  'git',
  'pipelineTemplates',
  'mcp',
  'skills',
  'data',
  'about'
]

export function isSettingsCategory(
  value: string | null | undefined
): value is SettingsCategory {
  if (!value) {
    return false
  }

  return SETTINGS_CATEGORIES.includes(value as SettingsCategory)
}

export function buildSettingsRoute(category?: SettingsCategory): string {
  if (!category || category === 'account') {
    return '/settings'
  }

  const searchParams = new URLSearchParams({ tab: category })
  return `/settings?${searchParams.toString()}`
}

export const PROJECT_SETTINGS_ROUTE = buildSettingsRoute('projects')

export interface SettingsTabProps {
  settings: SettingsType
  onSettingsChange: (settings: SettingsType) => void
}

export interface MCPServerStdio {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface MCPServerHttp {
  url: string
  headers?: Record<string, string>
}

export type MCPServerConfig = MCPServerStdio | MCPServerHttp

export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>
}

export interface MCPServerUI {
  id: string
  name: string
  type: 'stdio' | 'http' | 'sse'
  enabled: boolean
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  autoExecute?: boolean
  source?: string
}

export interface SkillFile {
  name: string
  path: string
  isDir: boolean
  children?: SkillFile[]
}

export interface SkillInfo {
  id: string
  name: string
  description?: string
  source: string
  path: string
  files: SkillFile[]
  enabled: boolean
}

export type MCPSubTab = 'settings' | string
export type SkillsSubTab = 'settings' | string
