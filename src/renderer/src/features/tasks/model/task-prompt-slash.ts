import {
  CLI_SKILL_DIRECTORIES,
  loadSkillsFromDirectory,
  resolvePath
} from '@features/skills'
import {
  buildMcpServersFromConfig,
  extractMcpServers,
  getProjectMcpConfigPath,
  parseTomlMcpServers,
  type MCPServerRecord
} from '@features/settings'

import type { TaskPromptSlashItem, TaskPromptTokenKind, TaskPromptTokenSource } from './task-prompt'

type ConfigCandidate = { path: string; format: 'json' | 'toml' }

const CLI_GLOBAL_MCP_CONFIGS: Record<string, string[]> = {
  'cursor-agent': ['~/.cursor/mcp.json', '~/.cursor/agent-config.json'],
  codex: ['~/.codex/config.toml', '~/.codex/config.json'],
  'gemini-cli': ['~/.gemini/settings.json', '~/.gemini/config.json'],
  opencode: ['~/.opencode/config.json'],
  'claude-code': ['~/.claude.json', '~/.config/claude/config.json']
}

const joinPath = (basePath: string, segment: string) =>
  `${basePath.replace(/[\\/]+$/, '')}/${segment.replace(/^[\\/]+/, '')}`

const getConfigCandidates = (paths: string[]): ConfigCandidate[] =>
  paths.map((path) => ({
    path,
    format: path.endsWith('.toml') ? 'toml' : 'json'
  }))

const buildSearchText = (
  tokenKind: TaskPromptTokenKind,
  name: string,
  source: TaskPromptTokenSource,
  description?: string,
  extra?: Array<string | undefined>
) =>
  [tokenKind, name, source, description, ...(extra ?? [])]
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .join(' ')
    .toLowerCase()

const readMcpConfigFile = async (
  candidate: ConfigCandidate
): Promise<{ exists: boolean; servers: MCPServerRecord }> => {
  const resolvedPath = await resolvePath(candidate.path)
  if (!resolvedPath || !window.api?.fs?.exists || !window.api?.fs?.readTextFile) {
    return { exists: false, servers: {} }
  }

  const parseContent = (content: string) => {
    if (candidate.format === 'toml') {
      return parseTomlMcpServers(content)
    }

    try {
      return extractMcpServers(JSON.parse(content) as unknown)
    } catch {
      return {}
    }
  }

  try {
    const exists = await window.api.fs.exists(resolvedPath)
    if (!exists) {
      return { exists: false, servers: {} }
    }

    const content = await window.api.fs.readTextFile(resolvedPath)
    return {
      exists: true,
      servers: parseContent(content)
    }
  } catch {
    return { exists: false, servers: {} }
  }
}

const loadMcpItems = async (
  toolId: string,
  source: TaskPromptTokenSource,
  projectPath?: string
): Promise<TaskPromptSlashItem[]> => {
  const candidates =
    source === 'project'
      ? projectPath
        ? getConfigCandidates([getProjectMcpConfigPath(projectPath, toolId)])
        : []
      : getConfigCandidates(CLI_GLOBAL_MCP_CONFIGS[toolId] || [])

  if (candidates.length === 0) {
    return []
  }

  const combined: MCPServerRecord = {}
  for (const candidate of candidates) {
    const result = await readMcpConfigFile(candidate)
    Object.assign(combined, result.servers || {})
  }

  return buildMcpServersFromConfig(combined, source)
    .map((server) => ({
      id: `mcp:${toolId}:${source}:${server.name}`,
      tokenKind: 'mcp' as const,
      name: server.name,
      description:
        server.type === 'stdio'
          ? [server.command, ...(server.args ?? [])].filter(Boolean).join(' ')
          : server.url,
      source,
      toolId,
      group: 'mcp' as const,
      searchText: buildSearchText('mcp', server.name, source, undefined, [
        server.type,
        server.command,
        server.url
      ])
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

const loadSkillItems = async (
  toolId: string,
  source: TaskPromptTokenSource,
  projectPath?: string
): Promise<TaskPromptSlashItem[]> => {
  const relativeDirectory = CLI_SKILL_DIRECTORIES[toolId]
  if (!relativeDirectory) {
    return []
  }

  const directoryPath =
    source === 'project'
      ? projectPath
        ? joinPath(projectPath, relativeDirectory)
        : ''
      : `~/${relativeDirectory}`

  if (!directoryPath) {
    return []
  }

  const skills = await loadSkillsFromDirectory(directoryPath, source)

  return skills
    .map((skill) => ({
      id: `skill:${toolId}:${source}:${skill.name}`,
      tokenKind: 'skill' as const,
      name: skill.name,
      description: skill.description,
      source,
      toolId,
      group: 'skills' as const,
      searchText: buildSearchText('skill', skill.name, source, skill.description)
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export const loadTaskPromptSlashItems = async (input: {
  toolId: string
  projectPath?: string
}): Promise<TaskPromptSlashItem[]> => {
  const { toolId, projectPath } = input
  if (!toolId) {
    return []
  }

  const [projectSkills, globalSkills, projectMcp, globalMcp] = await Promise.all([
    loadSkillItems(toolId, 'project', projectPath),
    loadSkillItems(toolId, 'global', projectPath),
    loadMcpItems(toolId, 'project', projectPath),
    loadMcpItems(toolId, 'global', projectPath)
  ])

  const orderedItems = [...projectSkills, ...globalSkills, ...projectMcp, ...globalMcp]
  const seen = new Set<string>()

  return orderedItems.filter((item) => {
    const key = `${item.tokenKind}:${item.toolId}:${item.name}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}
