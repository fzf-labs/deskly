import {
  getArtifactTypeFromExt,
  hasValidSearchResults,
  type Artifact
} from '@features/artifacts'
import type { AgentMessage } from '@features/cli-session'

const FILE_PATH_PATTERNS = [
  /`([^`]+\.(?:pptx|xlsx|docx|pdf))`/gi,
  /(\/[^\s"'`\n]+\.(?:pptx|xlsx|docx|pdf))/gi,
  /(\/[^\s"'\n]*[\u4e00-\u9fff][^\s"'\n]*\.(?:pptx|xlsx|docx|pdf))/gi
]

export const extractFilePaths = (text: string): string[] => {
  const results: string[] = []

  for (const pattern of FILE_PATH_PATTERNS) {
    pattern.lastIndex = 0
    const matches = text.matchAll(pattern)

    for (const match of matches) {
      const filePath = match[1] || match[0]
      if (filePath) {
        results.push(filePath)
      }
    }
  }

  return results
}

export const hasFilePathMatch = (text: string): boolean =>
  FILE_PATH_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0
    return pattern.test(text)
  })

export const extractArtifactsFromMessages = (messages: AgentMessage[]): Artifact[] => {
  const extractedArtifacts: Artifact[] = []
  const seenPaths = new Set<string>()

  messages.forEach((msg) => {
    if (msg.type === 'tool_use' && msg.name === 'Write') {
      const input = msg.input as Record<string, unknown> | undefined
      const filePath = input?.file_path as string | undefined
      const content = input?.content as string | undefined

      if (filePath && !seenPaths.has(filePath)) {
        seenPaths.add(filePath)
        const filename = filePath.split('/').pop() || filePath
        const ext = filename.split('.').pop()?.toLowerCase()

        extractedArtifacts.push({
          id: filePath,
          name: filename,
          type: getArtifactTypeFromExt(ext),
          content,
          path: filePath
        })
      }
    }

    if (msg.type === 'tool_use' && msg.name === 'WebSearch') {
      const input = msg.input as Record<string, unknown> | undefined
      const query = input?.query as string | undefined
      const toolUseId = msg.id

      if (!query) {
        return
      }

      let output = ''
      if (toolUseId) {
        const resultMsg = messages.find(
          (message) => message.type === 'tool_result' && message.toolUseId === toolUseId
        )
        output = resultMsg?.output || ''
      }

      if (!output) {
        const msgIndex = messages.indexOf(msg)
        for (let index = msgIndex + 1; index < messages.length; index += 1) {
          if (messages[index].type === 'tool_result') {
            output = messages[index].output || ''
            break
          }

          if (messages[index].type === 'tool_use') {
            break
          }
        }
      }

      const artifactId = `websearch-${query}`
      if (!seenPaths.has(artifactId) && output && hasValidSearchResults(output)) {
        seenPaths.add(artifactId)
        extractedArtifacts.push({
          id: artifactId,
          name: `Search: ${query.slice(0, 50)}${query.length > 50 ? '...' : ''}`,
          type: 'websearch',
          content: output
        })
      }
    }
  })

  messages.forEach((msg) => {
    const textToSearch =
      msg.type === 'tool_result' ? msg.output : msg.type === 'text' ? msg.content : null

    if (!textToSearch) {
      return
    }

    const filePaths = extractFilePaths(textToSearch)
    for (const filePath of filePaths) {
      if (filePath && !seenPaths.has(filePath)) {
        seenPaths.add(filePath)
        const filename = filePath.split('/').pop() || filePath
        const ext = filename.split('.').pop()?.toLowerCase()
        extractedArtifacts.push({
          id: filePath,
          name: filename,
          type: getArtifactTypeFromExt(ext),
          path: filePath
        })
      }
    }
  })

  return extractedArtifacts
}

export const shouldRefreshWorkspaceForMessages = (messages: AgentMessage[]): boolean => {
  for (const msg of messages) {
    if (msg.type === 'tool_use' && msg.name === 'Write') {
      return true
    }

    const textToSearch =
      msg.type === 'tool_result' ? msg.output : msg.type === 'text' ? msg.content : null
    if (textToSearch && hasFilePathMatch(textToSearch)) {
      return true
    }
  }

  return false
}
