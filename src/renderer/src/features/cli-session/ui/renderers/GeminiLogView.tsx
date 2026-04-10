import { useMemo, useState } from 'react'
import type { LogMsg } from '../../hooks'
import type { NormalizedEntry, NormalizedEntryType } from '../logTypes'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  Bot,
  ChevronDown,
  MessageSquare,
  Terminal,
  User,
  Wrench
} from 'lucide-react'

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function renderLogIcon(type: NormalizedEntryType): React.ReactNode {
  if (type === 'assistant_message') return <Bot className="size-4 text-blue-600" />
  if (type === 'user_message') return <User className="size-4 text-emerald-600" />
  if (type === 'tool_use' || type === 'command_run' || type === 'file_edit' || type === 'file_read') {
    return <Wrench className="size-4 text-violet-600" />
  }
  if (type === 'error') return <AlertCircle className="size-4 text-red-600" />
  if (type === 'tool_result') return <Terminal className="size-4 text-amber-600" />
  return <MessageSquare className="text-muted-foreground size-4" />
}

function entryTitle(entry: NormalizedEntry): string {
  if (entry.type === 'assistant_message') return 'Assistant'
  if (entry.type === 'user_message') return 'User'
  if (entry.type === 'error') return 'Error'
  if (entry.type === 'tool_result') return 'Tool result'
  if (entry.type === 'command_run') return 'Command'
  if (entry.type === 'file_edit') return 'File edit'
  if (entry.type === 'file_read') return 'File read'
  if (entry.type === 'tool_use') return entry.metadata?.toolName || 'Tool call'
  return 'System'
}

function previewText(text: string, maxLines = 3, maxChars = 220): { text: string; truncated: boolean } {
  const trimmed = text.trim()
  if (!trimmed) return { text: '', truncated: false }

  const lines = trimmed.split('\n')
  const limitedLines = lines.slice(0, maxLines)
  let preview = limitedLines.join('\n')
  let truncated = lines.length > maxLines

  if (preview.length > maxChars) {
    preview = `${preview.slice(0, maxChars - 1)}...`
    truncated = true
  } else if (truncated) {
    preview = `${preview}...`
  }

  return { text: preview, truncated }
}

function tryParseJson(value: string): unknown | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}

function summarizeParsedJson(value: unknown): string | null {
  if (Array.isArray(value)) {
    if (value.length === 0) return 'Returned empty list'
    return `Returned ${value.length} item${value.length === 1 ? '' : 's'}`
  }

  const record = asRecord(value)
  if (record) {
    const error = getString(record.error)
    if (error) return `Error: ${error}`
    const message =
      getString(record.message) ||
      getString(record.text) ||
      getString(record.summary) ||
      getString(record.content) ||
      getString(record.output)
    if (message) return message
    const keys = Object.keys(record)
    return keys.length > 0 ? `${keys.length} fields in result` : 'Returned empty object'
  }

  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function pickToolInputValue(input: RecordLike | null): string | undefined {
  if (!input) return undefined

  const byKey =
    getString(input.command) ||
    getString(input.path) ||
    getString(input.filePath) ||
    getString(input.file_path) ||
    getString(input.pattern) ||
    getString(input.query) ||
    getString(input.glob) ||
    getString(input.url)
  if (byKey) return byKey

  const firstString = Object.values(input).find((value) => typeof value === 'string' && value.trim())
  return typeof firstString === 'string' ? firstString : undefined
}

function buildSummary(entry: NormalizedEntry): {
  summary: string
  fullContent: string
  hasHiddenContent: boolean
} {
  const content = entry.content ?? ''
  const trimmed = content.trim()
  const preview = previewText(trimmed)

  const toolInput = asRecord(entry.metadata?.toolInput)
  const toolName = getString(entry.metadata?.toolName)
  const command = getString(toolInput?.command) || getString(entry.metadata?.command)
  const path =
    getString(toolInput?.path) ||
    getString(toolInput?.filePath) ||
    getString(toolInput?.file_path) ||
    getString(entry.metadata?.filePath)
  const inputValue = pickToolInputValue(toolInput)

  let summary = preview.text
  let hasHiddenContent = preview.truncated

  if (entry.type === 'command_run' && command) {
    summary = `$ ${command}`
    hasHiddenContent = hasHiddenContent || Boolean(trimmed)
  } else if ((entry.type === 'file_read' || entry.type === 'file_edit') && path) {
    summary = path
    hasHiddenContent = hasHiddenContent || Boolean(trimmed)
  } else if (entry.type === 'tool_use') {
    if (toolName && inputValue) {
      summary = `${toolName}: ${inputValue}`
      hasHiddenContent = hasHiddenContent || Boolean(trimmed)
    } else if (toolName) {
      summary = toolName
      hasHiddenContent = hasHiddenContent || Boolean(trimmed)
    }
  } else if (entry.type === 'tool_result') {
    const parsed = tryParseJson(trimmed)
    const parsedSummary = summarizeParsedJson(parsed)
    const failed = entry.metadata?.status === 'failed'
    if (parsedSummary) {
      summary = failed ? `Failed: ${parsedSummary}` : parsedSummary
    } else if (!trimmed) {
      summary = failed ? 'Tool failed (no output)' : 'Tool completed'
    }
    hasHiddenContent = hasHiddenContent || Boolean(trimmed)
  }

  if (!summary) {
    summary = entry.type === 'tool_result' ? 'Tool completed' : entryTitle(entry)
  }

  return {
    summary,
    fullContent: trimmed,
    hasHiddenContent
  }
}

function buildFacts(entry: NormalizedEntry): Array<{ label: string; value: string }> {
  const facts: Array<{ label: string; value: string }> = []
  const pushFact = (label: string, value: unknown) => {
    if (facts.length >= 6) return
    if (typeof value === 'string' && value.trim()) {
      facts.push({ label, value: value.trim() })
      return
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      facts.push({ label, value: String(value) })
    }
  }

  const toolInput = asRecord(entry.metadata?.toolInput)
  pushFact('Tool', entry.metadata?.toolName)
  pushFact('Status', entry.metadata?.status)
  pushFact('Exit', entry.metadata?.exitCode)
  pushFact('Path', toolInput?.path ?? toolInput?.filePath ?? toolInput?.file_path)
  pushFact('Pattern', toolInput?.pattern)
  pushFact('CWD', toolInput?.cwd)
  pushFact('Call ID', entry.metadata?.toolUseId)

  if (entry.type === 'tool_result') {
    const parsed = tryParseJson(entry.content)
    if (Array.isArray(parsed)) {
      pushFact('Items', parsed.length)
    }
  }

  return facts
}

function statusBadge(entry: NormalizedEntry): { label: string; tone: 'ok' | 'warn' | 'error' } | null {
  const status = getString(entry.metadata?.status)
  const exitCode = getNumber(entry.metadata?.exitCode)

  if (status === 'failed' || (typeof exitCode === 'number' && exitCode !== 0)) {
    return { label: 'ERROR', tone: 'error' }
  }
  if (status === 'success' || exitCode === 0) {
    return { label: 'OK', tone: 'ok' }
  }
  if (status === 'running') {
    return { label: 'RUNNING', tone: 'warn' }
  }
  if (status === 'pending') {
    return { label: 'PENDING', tone: 'warn' }
  }
  return null
}

function stripToolInput(metadata: NormalizedEntry['metadata']): RecordLike | null {
  if (!metadata) return null
  const next: RecordLike = {}
  Object.entries(metadata).forEach(([key, value]) => {
    if (key === 'toolInput' || value === undefined) return
    next[key] = value
  })
  return Object.keys(next).length > 0 ? next : null
}

type GeminiProcessKind = 'command' | 'file_read' | 'file_edit' | 'tool'

type GeminiTimelineItem =
  | { id: string; type: 'user_bubble'; entry: NormalizedEntry }
  | { id: string; type: 'answer_block'; entries: NormalizedEntry[]; content: string }
  | {
      id: string
      type: 'process_block'
      entry: NormalizedEntry
      relatedResult?: NormalizedEntry
      kind: GeminiProcessKind
    }
  | { id: string; type: 'error_block'; entry: NormalizedEntry }
  | { id: string; type: 'status_block'; entry: NormalizedEntry }

function appendAnswerContent(current: string, next: string): string {
  if (!current) return next
  if (!next) return current
  const separator = current.endsWith('\n') || next.startsWith('\n') ? '' : '\n\n'
  return `${current}${separator}${next}`
}

function processKindFromEntry(entry: NormalizedEntry): GeminiProcessKind {
  if (entry.type === 'command_run') return 'command'
  if (entry.type === 'file_read') return 'file_read'
  if (entry.type === 'file_edit') return 'file_edit'

  const toolName = getString(entry.metadata?.toolName)?.toLowerCase() || ''
  if (toolName.includes('read') || toolName.includes('open')) return 'file_read'
  if (toolName.includes('write') || toolName.includes('edit') || toolName.includes('patch')) return 'file_edit'
  if (toolName.includes('bash') || toolName.includes('shell') || toolName.includes('command')) return 'command'
  return 'tool'
}

function buildResultQueues(entries: NormalizedEntry[]): Map<string, NormalizedEntry[]> {
  const resultQueues = new Map<string, NormalizedEntry[]>()
  entries.forEach((entry) => {
    if (entry.type !== 'tool_result') return
    const toolUseId = getString(entry.metadata?.toolUseId)
    if (!toolUseId) return
    const queue = resultQueues.get(toolUseId) ?? []
    queue.push(entry)
    resultQueues.set(toolUseId, queue)
  })
  return resultQueues
}

function consumePairedResult(
  entry: NormalizedEntry,
  entries: NormalizedEntry[],
  index: number,
  resultQueues: Map<string, NormalizedEntry[]>,
  consumedResultIds: Set<string>
): NormalizedEntry | undefined {
  const toolUseId = getString(entry.metadata?.toolUseId)
  if (toolUseId) {
    const queue = resultQueues.get(toolUseId)
    const next = queue?.shift()
    if (next) {
      consumedResultIds.add(next.id)
      return next
    }
  }

  const adjacent = entries[index + 1]
  if (adjacent && adjacent.type === 'tool_result' && !consumedResultIds.has(adjacent.id)) {
    consumedResultIds.add(adjacent.id)
    return adjacent
  }

  return undefined
}

function processTitle(kind: GeminiProcessKind, entry: NormalizedEntry): string {
  if (kind === 'command') return '执行命令'
  if (kind === 'file_read') return '读取文件'
  if (kind === 'file_edit') return '编辑文件'
  if (entry.type === 'tool_result') return '工具结果'
  return '工具调用'
}

function processSummary(entry: NormalizedEntry, relatedResult?: NormalizedEntry): string {
  const summary = buildSummary(relatedResult ?? entry).summary
  if (entry.type === 'command_run' && summary.startsWith('$ ')) {
    return summary.slice(2)
  }
  return summary
}

export function buildGeminiTimelineItems(entries: NormalizedEntry[]): GeminiTimelineItem[] {
  const items: GeminiTimelineItem[] = []
  const assistantBuffer: NormalizedEntry[] = []
  const resultQueues = buildResultQueues(entries)
  const consumedResultIds = new Set<string>()

  const flushAssistantBuffer = () => {
    if (assistantBuffer.length === 0) return
    let content = ''
    assistantBuffer.forEach((entry) => {
      content = appendAnswerContent(content, entry.content)
    })
    if (content.trim()) {
      items.push({
        id: `gemini-answer-${assistantBuffer[0]?.id ?? items.length}`,
        type: 'answer_block',
        entries: [...assistantBuffer],
        content
      })
    }
    assistantBuffer.length = 0
  }

  entries.forEach((entry, index) => {
    if (entry.type === 'user_message') {
      flushAssistantBuffer()
      items.push({ id: `gemini-user-${entry.id}`, type: 'user_bubble', entry })
      return
    }

    if (entry.type === 'assistant_message') {
      assistantBuffer.push(entry)
      return
    }

    if (entry.type === 'tool_result' && consumedResultIds.has(entry.id)) {
      return
    }

    flushAssistantBuffer()

    if (entry.type === 'error') {
      items.push({ id: `gemini-error-${entry.id}`, type: 'error_block', entry })
      return
    }

    if (entry.type === 'system_message') {
      items.push({ id: `gemini-status-${entry.id}`, type: 'status_block', entry })
      return
    }

    if (
      entry.type === 'tool_use' ||
      entry.type === 'tool_result' ||
      entry.type === 'command_run' ||
      entry.type === 'file_read' ||
      entry.type === 'file_edit'
    ) {
      items.push({
        id: `gemini-process-${entry.id}`,
        type: 'process_block',
        entry,
        relatedResult:
          entry.type === 'tool_result'
            ? undefined
            : consumePairedResult(entry, entries, index, resultQueues, consumedResultIds),
        kind: processKindFromEntry(entry)
      })
      return
    }

    items.push({ id: `gemini-status-fallback-${entry.id}`, type: 'status_block', entry })
  })

  flushAssistantBuffer()
  return items
}

function UserBubble({ entry }: { entry: NormalizedEntry }): React.ReactNode {
  return (
    <div className="flex justify-end">
      <div className="max-w-[76%] min-w-0 rounded-[10px] border border-border/50 bg-accent px-3.5 py-2.5 text-foreground">
        <div className="mb-1 text-right text-[11px] text-muted-foreground">{formatTime(entry.timestamp)}</div>
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{entry.content}</p>
      </div>
    </div>
  )
}

function AnswerBlock({ content }: { content: string }): React.ReactNode {
  return (
    <div className="w-full border-l border-border/30 bg-transparent px-3 py-0.5">
      <div className="min-w-0 whitespace-pre-wrap break-words text-sm leading-7 text-foreground">{content}</div>
    </div>
  )
}

function DetailPanel({ label, entry }: { label: string; entry: NormalizedEntry }): React.ReactNode {
  const facts = useMemo(() => buildFacts(entry), [entry])
  const { fullContent, hasHiddenContent } = useMemo(() => buildSummary(entry), [entry])
  const rawToolInput = useMemo(() => asRecord(entry.metadata?.toolInput), [entry.metadata])
  const rawMetadata = useMemo(() => stripToolInput(entry.metadata), [entry.metadata])

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{formatTime(entry.timestamp)}</span>
      </div>

      {facts.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {facts.map((fact) => (
            <span
              key={`${label}-${fact.label}-${fact.value}`}
              className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {fact.label}: {fact.value}
            </span>
          ))}
        </div>
      )}

      {rawToolInput && Object.keys(rawToolInput).length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Input</div>
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-[6px] bg-muted/25 p-2.5 text-xs leading-6 text-foreground">
            {stringify(rawToolInput)}
          </pre>
        </div>
      )}

      {hasHiddenContent && fullContent && (
        <div className="mb-3">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Output</div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-[6px] bg-muted/25 p-2.5 text-xs leading-6 text-foreground">
            {fullContent}
          </pre>
        </div>
      )}

      {rawMetadata && Object.keys(rawMetadata).length > 0 && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Metadata</div>
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-[6px] bg-muted/25 p-2.5 text-xs leading-6 text-muted-foreground">
            {stringify(rawMetadata)}
          </pre>
        </div>
      )}
    </div>
  )
}

function processTone(kind: GeminiProcessKind): { border: string; icon: string; gradient: string } {
  if (kind === 'command') {
    return {
      border: 'border-emerald-500/25 hover:border-emerald-500/40',
      icon: 'text-emerald-700',
      gradient: 'from-muted/45 to-emerald-100/70'
    }
  }
  if (kind === 'file_read') {
    return {
      border: 'border-slate-400/30 hover:border-slate-500/45',
      icon: 'text-slate-600',
      gradient: 'from-muted/45 to-slate-100/80'
    }
  }
  if (kind === 'file_edit') {
    return {
      border: 'border-sky-500/25 hover:border-sky-500/40',
      icon: 'text-sky-700',
      gradient: 'from-muted/45 to-sky-100/80'
    }
  }
  return {
    border: 'border-violet-500/25 hover:border-violet-500/40',
    icon: 'text-violet-700',
    gradient: 'from-muted/45 to-violet-100/80'
  }
}

function ProcessBlock({
  item
}: {
  item: Extract<GeminiTimelineItem, { type: 'process_block' }>
}): React.ReactNode {
  const [expanded, setExpanded] = useState(false)
  const tone = processTone(item.kind)
  const badge = statusBadge(item.relatedResult ?? item.entry)
  const summary = processSummary(item.entry, item.relatedResult)

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          'group relative flex w-full items-center justify-between overflow-hidden rounded-[4px] border border-l-[4px] px-2.5 py-1 text-left text-[13px]',
          tone.border
        )}
      >
        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 w-full rounded-r-[4px] bg-gradient-to-r opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100',
            tone.gradient
          )}
        />
        <div className="relative z-10 flex min-w-0 items-center overflow-hidden">
          <span className={tone.icon}>{renderLogIcon(item.entry.type)}</span>
          <div className="ml-1 text-foreground">{processTitle(item.kind, item.entry)}</div>
          {summary ? (
            <span className="ml-1 flex-1 overflow-hidden text-muted-foreground">
              <div className="truncate">{summary}</div>
            </span>
          ) : null}
          {badge && (
            <span
              className={cn(
                'ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                badge.tone === 'ok' && 'bg-emerald-500/10 text-emerald-700',
                badge.tone === 'warn' && 'bg-amber-500/10 text-amber-700',
                badge.tone === 'error' && 'bg-red-500/10 text-red-600'
              )}
            >
              {badge.label}
            </span>
          )}
        </div>
        <div className="relative z-10 ml-2 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100">
          <ChevronDown className={cn('h-[14px] w-[14px] transition-transform duration-200', expanded && 'rotate-180')} />
        </div>
      </button>

      {expanded && (
        <div className="mt-2 space-y-3 rounded-[8px] border border-border/45 bg-background/50 p-3">
          <DetailPanel label={processTitle(item.kind, item.entry)} entry={item.entry} />
          {item.relatedResult && (
            <div className="border-t border-border/45 pt-3">
              <DetailPanel label="结果" entry={item.relatedResult} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ErrorBlock({ entry }: { entry: NormalizedEntry }): React.ReactNode {
  const [expanded, setExpanded] = useState(false)
  const summary = previewText(entry.content, 1, 160).text || '展开查看错误详情'

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="group relative flex w-full items-center justify-between overflow-hidden rounded-[4px] border border-red-500/20 border-l-[4px] px-2.5 py-1 text-left text-[13px] hover:border-red-500/35 hover:bg-red-500/5"
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 w-full rounded-r-[4px] bg-gradient-to-r from-red-500/5 to-red-500/10 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100" />
        <div className="relative z-10 flex min-w-0 items-center overflow-hidden">
          <AlertCircle className="h-[14px] w-[14px] shrink-0 text-red-600" />
          <div className="ml-1 text-foreground">错误信息</div>
          <span className="ml-1 flex-1 overflow-hidden text-muted-foreground">
            <div className="truncate">{summary}</div>
          </span>
        </div>
        <div className="relative z-10 ml-2 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          <ChevronDown className={cn('h-[14px] w-[14px] transition-transform duration-200', expanded && 'rotate-180')} />
        </div>
      </button>

      {expanded && (
        <div className="mt-2 rounded-[8px] border border-red-500/20 bg-red-500/5 p-3">
          <div className="mb-2 text-[11px] text-muted-foreground">{formatTime(entry.timestamp)}</div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-red-700">
            {entry.content}
          </pre>
        </div>
      )}
    </div>
  )
}

function StatusBlock({ entry }: { entry: NormalizedEntry }): React.ReactNode {
  const summary = buildSummary(entry).summary || entry.content

  return (
    <div className="w-full px-0.5 py-0.5">
      <div className="flex min-w-0 items-center overflow-hidden text-[12px] text-muted-foreground">
        <MessageSquare className="h-[14px] w-[14px] shrink-0" />
        <div className="ml-1 shrink-0">系统状态</div>
        {summary ? (
          <span className="ml-1 flex-1 overflow-hidden">
            <div className="truncate">{summary}</div>
          </span>
        ) : null}
      </div>
    </div>
  )
}

function CliToolTimeline({ items }: { items: GeminiTimelineItem[] }): React.ReactNode {
  if (items.length === 0) {
    return <div className="px-3 py-2 text-xs text-muted-foreground">No logs yet.</div>
  }

  return (
    <div className="w-full space-y-2">
      {items.map((item) => {
        if (item.type === 'user_bubble') {
          return <UserBubble key={item.id} entry={item.entry} />
        }
        if (item.type === 'answer_block') {
          return <AnswerBlock key={item.id} content={item.content} />
        }
        if (item.type === 'process_block') {
          return <ProcessBlock key={item.id} item={item} />
        }
        if (item.type === 'error_block') {
          return <ErrorBlock key={item.id} entry={item.entry} />
        }
        return <StatusBlock key={item.id} entry={item.entry} />
      })}
    </div>
  )
}

type RecordLike = Record<string, unknown>

type RawParser = (
  line: string,
  fallbackTimestamp: number | undefined,
  idBase: string
) => NormalizedEntry | NormalizedEntry[] | null

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && !Number.isNaN(value) ? value : undefined
}

function asRecord(value: unknown): RecordLike | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordLike) : null
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === undefined || value === null) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function makeId(base: string, suffix: string | number): string {
  return `${base}-${suffix}`
}

function createEntry(
  type: NormalizedEntryType,
  content: string,
  timestamp: number,
  id: string,
  metadata?: NormalizedEntry['metadata']
): NormalizedEntry {
  return {
    id,
    type,
    timestamp,
    content,
    metadata
  }
}

function parseGeminiLine(
  line: string,
  fallbackTimestamp: number | undefined,
  idBase: string
): NormalizedEntry | null {
  try {
    const msg = JSON.parse(line) as RecordLike
    const timestamp = fallbackTimestamp ?? Date.now()
    const role = getString(msg.role)
    const content = getString(msg.text) || getString(msg.content) || ''
    if (role === 'model' || role === 'assistant') {
      return createEntry('assistant_message', content, timestamp, makeId(idBase, 'assistant'))
    }
    if (role === 'user') {
      return createEntry('user_message', content, timestamp, makeId(idBase, 'user'))
    }
    return null
  } catch {
    return createEntry('system_message', line, Date.now(), makeId(idBase, 'raw'))
  }
}

function normalizeEntryFromLog(entry: NormalizedEntry, msg: LogMsg, index: number): NormalizedEntry {
  const id = entry.id || msg.id || `normalized-${index}`
  const timestamp =
    typeof entry.timestamp === 'number'
      ? entry.timestamp
      : msg.timestamp ?? Date.now()
  if (id === entry.id && timestamp === entry.timestamp) return entry
  return {
    ...entry,
    id,
    timestamp
  }
}

function parseLogsWithParser(logs: LogMsg[], parser: RawParser | null): NormalizedEntry[] {
  const entries: NormalizedEntry[] = []

  logs.forEach((msg, msgIndex) => {
    if (msg.type === 'normalized' && msg.entry) {
      const entry = normalizeEntryFromLog(msg.entry, msg, msgIndex)
      entries.push(entry)
      return
    }

    if (msg.type === 'finished') {
      const exitCode = msg.exit_code
      const content =
        typeof exitCode === 'number'
          ? `Process exited with code ${exitCode}`
          : 'Process finished'
      entries.push(
        createEntry(
          'system_message',
          content,
          msg.timestamp ?? Date.now(),
          msg.id ?? `finished-${msgIndex}`,
          { exitCode }
        )
      )
      return
    }

    const content = msg.content
    if (!content) return
    const trimmed = content.trim()
    if (!trimmed) return
    const timestamp = msg.timestamp ?? Date.now()
    const idBase = msg.id ?? `${msg.type}-${msgIndex}`

    if (msg.type === 'stderr') {
      entries.push(
        createEntry('error', trimmed, timestamp, `${idBase}-stderr`)
      )
      return
    }

    if (msg.type !== 'stdout') return

    const parsed = parser ? parser(trimmed, msg.timestamp, idBase) : null
    if (parsed) {
      const parsedEntries = Array.isArray(parsed) ? parsed : [parsed]
      parsedEntries.forEach((entry) => {
        entries.push(entry)
      })
      return
    }

    entries.push(
      createEntry('system_message', trimmed, timestamp, `${idBase}-stdout`)
    )
  })

  return entries
}

export function parseGeminiLogs(logs: LogMsg[]): NormalizedEntry[] {
  return parseLogsWithParser(logs, parseGeminiLine)
}

export function GeminiLogView({ logs }: { logs: LogMsg[] }): React.ReactNode {
  const entries = useMemo(() => parseGeminiLogs(logs), [logs])
  const items = useMemo(() => buildGeminiTimelineItems(entries), [entries])
  return <CliToolTimeline items={items} />
}
