export type TaskPromptTokenKind = 'skill' | 'mcp'
export type TaskPromptTokenSource = 'project' | 'global'

export interface TaskPromptTextNode {
  type: 'text'
  text: string
}

export interface TaskPromptTokenNode {
  type: 'token'
  tokenKind: TaskPromptTokenKind
  id: string
  name: string
  source: TaskPromptTokenSource
  toolId: string
}

export type TaskPromptNode = TaskPromptTextNode | TaskPromptTokenNode

export interface TaskPromptSlashItem {
  id: string
  tokenKind: TaskPromptTokenKind
  name: string
  description?: string
  source: TaskPromptTokenSource
  toolId: string
  group: 'skills' | 'mcp'
  searchText: string
}

const isNonEmptyString = (value: string | undefined | null): value is string =>
  typeof value === 'string' && value.trim().length > 0

export const createTaskPromptTextNode = (text = ''): TaskPromptTextNode => ({
  type: 'text',
  text
})

export const normalizeTaskPromptNodes = (nodes: TaskPromptNode[]): TaskPromptNode[] => {
  const normalized: TaskPromptNode[] = []

  for (const node of nodes) {
    if (node.type === 'text') {
      if (!node.text) {
        continue
      }

      const previous = normalized[normalized.length - 1]
      if (previous?.type === 'text') {
        previous.text += node.text
      } else {
        normalized.push({ ...node })
      }
      continue
    }

    normalized.push({ ...node })
  }

  return normalized
}

export const getTaskPromptVisibleText = (nodes: TaskPromptNode[]): string =>
  normalizeTaskPromptNodes(nodes)
    .filter((node): node is TaskPromptTextNode => node.type === 'text')
    .map((node) => node.text)
    .join('')

export const hasTaskPromptContent = (nodes: TaskPromptNode[]): boolean =>
  normalizeTaskPromptNodes(nodes).some((node) =>
    node.type === 'text' ? node.text.trim().length > 0 : true
  )

const getUniqueTokenNames = (nodes: TaskPromptNode[], tokenKind: TaskPromptTokenKind): string[] => {
  const seen = new Set<string>()
  const names: string[] = []

  for (const node of normalizeTaskPromptNodes(nodes)) {
    if (node.type !== 'token' || node.tokenKind !== tokenKind) {
      continue
    }

    const normalizedName = node.name.trim()
    if (!normalizedName || seen.has(normalizedName)) {
      continue
    }

    seen.add(normalizedName)
    names.push(normalizedName)
  }

  return names
}

const buildNamedSection = (title: string, names: string[]): string | null => {
  if (names.length === 0) {
    return null
  }

  return [title, ...names.map((name) => `- ${name}`)].join('\n')
}

export const compileTaskPrompt = (nodes: TaskPromptNode[]): string => {
  const normalizedNodes = normalizeTaskPromptNodes(nodes)
  const userText = getTaskPromptVisibleText(normalizedNodes).trim()
  const skillNames = getUniqueTokenNames(normalizedNodes, 'skill')
  const mcpNames = getUniqueTokenNames(normalizedNodes, 'mcp')

  const sections = [
    userText,
    buildNamedSection('Selected skills:', skillNames),
    buildNamedSection('Selected MCP servers:', mcpNames),
    skillNames.length > 0 || mcpNames.length > 0
      ? 'Use the selected skills and MCP servers if they are relevant and available in the current environment.'
      : null
  ].filter(isNonEmptyString)

  return sections.join('\n\n').trim()
}

export const replaceTaskPromptWithText = (text: string): TaskPromptNode[] => {
  if (!text) {
    return []
  }

  return [createTaskPromptTextNode(text)]
}
