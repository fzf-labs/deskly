import { useState } from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { AgentMessage } from '@features/cli-session'

interface ToolExecutionItemProps {
  message: AgentMessage
  result?: AgentMessage
  isLast: boolean
  isFirst?: boolean
  searchQuery?: string
}

function getToolDisplayName(toolName: string): string {
  switch (toolName) {
    case 'Bash':
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'Grep':
    case 'Glob':
    case 'WebFetch':
    case 'WebSearch':
    case 'TodoWrite':
    case 'Task':
    case 'LSP':
      return toolName
    default:
      return toolName
  }
}

function getFullParamString(
  toolName: string,
  input: Record<string, unknown> | undefined
): string {
  if (!input) return ''

  switch (toolName) {
    case 'Bash':
      return (input.command as string) || ''
    case 'Read':
    case 'Write':
    case 'Edit':
      return (input.file_path as string) || ''
    case 'Grep':
    case 'Glob':
      return (input.pattern as string) || ''
    case 'WebFetch':
      return (input.url as string) || ''
    case 'WebSearch':
      return (input.query as string) || ''
    case 'Task':
      return (input.description as string) || ''
    default:
      return ''
  }
}

function getTruncatedParam(param: string, maxLen = 60): string {
  if (param.length <= maxLen) return param
  return `${param.slice(0, maxLen)}...`
}

function isExpectedWarning(toolName: string, output: string): boolean {
  const lowerOutput = output.toLowerCase()

  if (
    toolName === 'Read' &&
    (lowerOutput.includes('file does not exist') ||
      lowerOutput.includes('no such file') ||
      lowerOutput.includes('file not found'))
  ) {
    return true
  }

  if (
    (toolName === 'Grep' || toolName === 'Glob') &&
    (lowerOutput.includes('no matches') || lowerOutput.includes('no files found'))
  ) {
    return true
  }

  return false
}

function getResultInfo(
  toolName: string,
  result?: AgentMessage
): { hasContent: boolean; summary: string; isWarning: boolean } {
  if (!result) {
    return { hasContent: false, summary: 'Running...', isWarning: false }
  }

  let output = result.output || result.content || ''
  const toolUseErrorMatch = output.match(/<tool_use_error>([\s\S]*?)<\/tool_use_error>/)
  if (toolUseErrorMatch) {
    output = toolUseErrorMatch[1].trim()
  }

  const isError =
    result.isError || output.toLowerCase().includes('error') || Boolean(toolUseErrorMatch)
  const isWarning = isExpectedWarning(toolName, output)

  if (isError) {
    const firstLine = output.split('\n').find((line) => line.trim()) || output
    const truncated = firstLine.length > 80 ? `${firstLine.slice(0, 80)}...` : firstLine
    return {
      hasContent: true,
      summary: truncated || 'Error occurred',
      isWarning
    }
  }

  if (!output || output.trim() === '') {
    return { hasContent: false, summary: '(No content)', isWarning: false }
  }

  const lines = output.split('\n').filter((line) => line.trim())
  const lineCount = lines.length

  switch (toolName) {
    case 'Bash':
      if (lineCount === 0) return { hasContent: false, summary: '(No output)', isWarning: false }
      if (lineCount === 1) {
        return { hasContent: true, summary: lines[0].slice(0, 80), isWarning: false }
      }
      return { hasContent: true, summary: `${lineCount} lines of output`, isWarning: false }
    case 'Read':
      return { hasContent: true, summary: `Read ${lineCount} lines`, isWarning: false }
    case 'Write':
      return { hasContent: true, summary: 'File created successfully', isWarning: false }
    case 'Edit':
      return { hasContent: true, summary: 'File modified successfully', isWarning: false }
    case 'Grep':
      if (lineCount === 0) {
        return { hasContent: false, summary: 'No matches found', isWarning: false }
      }
      return { hasContent: true, summary: `Found matches in ${lineCount} files`, isWarning: false }
    case 'Glob':
      if (lineCount === 0) {
        return { hasContent: false, summary: 'No files found', isWarning: false }
      }
      return { hasContent: true, summary: `Found ${lineCount} files`, isWarning: false }
    case 'WebFetch':
      return { hasContent: true, summary: `Fetched ${output.length} characters`, isWarning: false }
    case 'WebSearch':
      return { hasContent: true, summary: 'Search completed', isWarning: false }
    case 'TodoWrite':
      return { hasContent: true, summary: 'Todo list updated', isWarning: false }
    case 'Task':
      return { hasContent: true, summary: 'Subtask finished', isWarning: false }
    default:
      return { hasContent: true, summary: 'Done', isWarning: false }
  }
}

export function ToolExecutionItem({
  message,
  result,
  isLast,
  isFirst = false,
  searchQuery
}: ToolExecutionItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (message.type !== 'tool_use' || !message.name) {
    return null
  }

  const toolName = message.name
  const toolParam = getFullParamString(toolName, message.input as Record<string, unknown> | undefined)
  const resultInfo = getResultInfo(toolName, result)
  const hasBody = Boolean(toolParam || result?.output || result?.content || result?.message)

  const bodyText = result?.output || result?.content || result?.message || ''
  const highlightedBody =
    searchQuery && bodyText
      ? bodyText.replaceAll(searchQuery, `<<__deskly_search__${searchQuery}__deskly_search__>>`)
      : bodyText

  return (
    <div
      className={cn(
        'border-border/40 relative border-l pl-4',
        isFirst && 'pt-2',
        !isLast && 'pb-3'
      )}
    >
      <div className="bg-background absolute left-[-5px] top-3 size-2 rounded-full border" />
      <button
        type="button"
        onClick={() => hasBody && setIsExpanded((prev) => !prev)}
        className={cn(
          'w-full rounded-lg text-left',
          hasBody && 'hover:bg-accent/40 cursor-pointer transition-colors'
        )}
      >
        <div className="flex items-start gap-3 rounded-lg px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="text-foreground flex items-center gap-2 text-sm font-medium">
              <span>{getToolDisplayName(toolName)}</span>
              {result?.isError && !resultInfo.isWarning && (
                <X className="text-destructive size-3.5" />
              )}
            </div>
            {toolParam && (
              <div className="text-muted-foreground mt-0.5 truncate text-xs">
                {getTruncatedParam(toolParam)}
              </div>
            )}
            <div
              className={cn(
                'mt-1 text-xs',
                result?.isError && !resultInfo.isWarning
                  ? 'text-destructive'
                  : resultInfo.isWarning
                    ? 'text-amber-600'
                    : 'text-muted-foreground'
              )}
            >
              {resultInfo.summary}
            </div>
          </div>
        </div>
      </button>

      {hasBody && isExpanded && (
        <div className="bg-muted/20 border-border/40 mt-2 overflow-hidden rounded-lg border">
          {toolParam && (
            <div className="border-border/40 border-b px-3 py-2">
              <div className="text-muted-foreground mb-1 text-[11px] font-medium uppercase tracking-wide">
                Input
              </div>
              <pre className="text-foreground overflow-x-auto whitespace-pre-wrap text-xs">
                {toolParam}
              </pre>
            </div>
          )}
          {bodyText && (
            <div className="px-3 py-2">
              <div className="text-muted-foreground mb-1 text-[11px] font-medium uppercase tracking-wide">
                Output
              </div>
              <pre className="text-foreground overflow-x-auto whitespace-pre-wrap text-xs">
                {highlightedBody}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
