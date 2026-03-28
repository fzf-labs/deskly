import type { LogMsg } from '../../hooks'
import type { NormalizedEntry, NormalizedEntryType } from '../logTypes'

type RecordLike = Record<string, unknown>

export interface CodexUserTurn {
  id: string
  kind: 'user'
  timestamp: number
  entry: NormalizedEntry
}

export interface CodexAssistantTurn {
  id: string
  kind: 'assistant'
  timestamp: number
  entries: NormalizedEntry[]
  body: string
  narrativeEntries: NormalizedEntry[]
  processEntries: NormalizedEntry[]
  completed: boolean
  hasErrors: boolean
}

export type CodexConversationTurn = CodexUserTurn | CodexAssistantTurn

export type CodexProcessItemKind =
  | 'thinking_collapsible'
  | 'command_collapsible'
  | 'file_read_collapsible'
  | 'file_edit_collapsible'
  | 'file_create_collapsible'
  | 'system_status'
  | 'unknown_collapsible'

export interface CodexUserBubbleItem {
  id: string
  type: 'user_bubble'
  timestamp: number
  entry: NormalizedEntry
}

export interface CodexAnswerMarkdownBlock {
  id: string
  type: 'assistant_block'
  kind: 'answer_markdown'
  timestamp: number
  content: string
  entries: NormalizedEntry[]
}

export interface CodexProcessBlock {
  id: string
  type: 'assistant_block'
  kind: CodexProcessItemKind
  timestamp: number
  title: string
  summary: string
  entry: NormalizedEntry
  relatedResult?: NormalizedEntry
}

export interface CodexErrorBlock {
  id: string
  type: 'assistant_block'
  kind: 'error_block'
  timestamp: number
  entry: NormalizedEntry
}

export type CodexTimelineItem =
  | CodexUserBubbleItem
  | CodexAnswerMarkdownBlock
  | CodexProcessBlock
  | CodexErrorBlock

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

export function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && !Number.isNaN(value) ? value : undefined
}

export function asRecord(value: unknown): RecordLike | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordLike) : null
}

function isRecord(value: unknown): value is RecordLike {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function makeId(base: string, suffix: string | number): string {
  return `${base}-${suffix}`
}

export function stringify(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === undefined || value === null) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function stringifyContent(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => stringifyContent(item))
      .filter((part): part is string => Boolean(part))
    return parts.length > 0 ? parts.join('') : undefined
  }
  if (typeof value === 'object') {
    const record = value as RecordLike
    const text = getString(record.text) || getString(record.content) || getString(record.message)
    if (text) return text
    const nested = record.error ?? record.warning
    const nestedRecord = asRecord(nested)
    const nestedText = getString(nested) || (nestedRecord ? getString(nestedRecord.message) : undefined)
    if (nestedText) return nestedText
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
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

function withCodexEventType(
  metadata: NormalizedEntry['metadata'] | undefined,
  codexEventType: string | undefined
): NormalizedEntry['metadata'] | undefined {
  if (!codexEventType) return metadata
  return {
    ...(metadata ?? {}),
    codexEventType
  }
}

function withCodexMetadata(
  metadata: NormalizedEntry['metadata'] | undefined,
  extra: Record<string, unknown>
): NormalizedEntry['metadata'] | undefined {
  const next = {
    ...(metadata ?? {}),
    ...extra
  }
  return Object.keys(next).length > 0 ? next : undefined
}

function extractCodexContent(msg: RecordLike): string | undefined {
  const direct = pickCodexContent(msg)
  if (direct) return direct

  const params = asRecord(msg.params)
  if (params) {
    const fromParams = pickCodexContent(params)
    if (fromParams) return fromParams
    const paramsEvent = asRecord(params.event)
    if (paramsEvent) {
      const fromEvent = pickCodexContent(paramsEvent)
      if (fromEvent) return fromEvent
    }
  }

  const result = asRecord(msg.result)
  if (result) {
    const fromResult = pickCodexContent(result)
    if (fromResult) return fromResult
  }

  return undefined
}

function pickCodexContent(record: RecordLike): string | undefined {
  const direct = stringifyContent(record.message ?? record.text ?? record.delta ?? record.content)
  if (direct) return direct
  const errorText = stringifyContent(record.error)
  if (errorText) return errorText
  const warningText = stringifyContent(record.warning)
  if (warningText) return warningText
  return undefined
}

function formatTypeLabel(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function formatCommand(command: unknown): string | undefined {
  if (Array.isArray(command)) {
    return command.map((part) => String(part)).join(' ')
  }
  if (typeof command === 'string') return command
  return undefined
}

function formatPatchApplyBegin(msg: RecordLike): string {
  const changes = asRecord(msg.changes)
  const fileCount = changes ? Object.keys(changes).length : 0
  const suffix = fileCount > 0 ? ` (${fileCount} file${fileCount === 1 ? '' : 's'})` : ''
  return `Applying patch${suffix}`
}

function formatPatchApplyEnd(msg: RecordLike): string {
  const success = msg.success === true
  const detail = getString(msg.stdout) || getString(msg.stderr)
  if (detail) {
    return success ? `Patch applied: ${detail}` : `Patch failed: ${detail}`
  }
  return success ? 'Patch applied' : 'Patch failed'
}

function formatThreadStarted(msg: RecordLike): string {
  const threadId = getString(msg.thread_id) || getString(msg.threadId)
  return threadId ? `Thread started: ${threadId}` : 'Thread started'
}

function formatTurnCompleted(msg: RecordLike): string {
  const usage = asRecord(msg.usage)
  if (!usage) return 'Turn completed'
  const inputTokens = getNumber(usage.input_tokens)
  const cachedInputTokens = getNumber(usage.cached_input_tokens)
  const outputTokens = getNumber(usage.output_tokens)
  const parts = [
    inputTokens !== undefined ? `in ${inputTokens}` : null,
    cachedInputTokens !== undefined ? `cached ${cachedInputTokens}` : null,
    outputTokens !== undefined ? `out ${outputTokens}` : null
  ].filter(Boolean)
  if (parts.length === 0) return 'Turn completed'
  return `Turn completed (${parts.join(', ')})`
}

function createCodexCommandBegin(msg: RecordLike, timestamp: number, idBase: string): NormalizedEntry | null {
  const callId = getString(msg.call_id)
  const command = formatCommand(msg.command)
  const cwd = getString(msg.cwd)
  if (!command) return null
  return {
    id: idBase,
    type: 'command_run',
    timestamp,
    content: command,
    metadata: {
      toolName: 'execute',
      toolInput: { command, cwd },
      toolUseId: callId,
      status: 'running',
      codexEventType: 'exec_command_begin'
    }
  }
}

function createCodexCommandEnd(msg: RecordLike, timestamp: number, idBase: string): NormalizedEntry | null {
  const callId = getString(msg.call_id)
  const exitCode = getNumber(msg.exit_code)
  const output =
    getString(msg.aggregated_output) ||
    getString(msg.formatted_output) ||
    [getString(msg.stdout), getString(msg.stderr)].filter(Boolean).join('\n')
  if (!output && exitCode === undefined) return null
  return {
    id: idBase,
    type: 'tool_result',
    timestamp,
    content: output || '',
    metadata: {
      toolUseId: callId,
      status: exitCode === 0 ? 'success' : 'failed',
      exitCode,
      codexEventType: 'exec_command_end'
    }
  }
}

function createCodexCommandEntry(
  item: RecordLike,
  timestamp: number,
  flags: { isStarted: boolean; isCompleted: boolean },
  idBase: string
): NormalizedEntry | null {
  const command = getString(item.command) || getString(item.cmd) || getString(item.command_text)
  const toolUseId = getString(item.id) || getString(item.command_id)
  const status = getString(item.status)?.toLowerCase()
  const exitCode = getNumber(item.exit_code)
  const output = stringifyContent(item.aggregated_output) || stringifyContent(item.output) || ''

  if (!command && !output && exitCode === undefined) return null

  const isStarted = flags.isStarted || status === 'in_progress' || status === 'running'
  const isCompleted = flags.isCompleted || status === 'completed' || exitCode !== undefined

  if (isStarted) {
    return {
      id: idBase,
      type: 'command_run',
      timestamp,
      content: command || 'Command',
      metadata: {
        toolName: 'execute',
        toolInput: command ? { command } : undefined,
        toolUseId,
        status: 'running',
        codexEventType: 'item_started'
      }
    }
  }

  if (isCompleted) {
    return {
      id: idBase,
      type: 'tool_result',
      timestamp,
      content: output,
      metadata: {
        toolUseId,
        status: exitCode === 0 ? 'success' : 'failed',
        exitCode,
        codexEventType: 'item_completed'
      }
    }
  }

  return null
}

function createCodexToolUseFromItem(
  item: RecordLike,
  timestamp: number,
  idBase: string
): NormalizedEntry | null {
  const toolCall = asRecord(item.tool_call)
  const toolName = getString(item.tool_name) || getString(item.name) || getString(toolCall?.name)
  const toolInput = asRecord(item.input) || asRecord(toolCall?.input)
  const toolUseId =
    getString(item.tool_call_id) ||
    getString(item.id) ||
    getString(toolCall?.id)

  if (!toolName && !toolInput) return null

  return {
    id: idBase,
    type: 'tool_use',
    timestamp,
    content: toolInput ? JSON.stringify(toolInput) : toolName || 'tool',
    metadata: {
      toolName: toolName || 'tool',
      toolInput: toolInput ?? undefined,
      toolUseId,
      codexEventType: 'item_started'
    }
  }
}

function extractTodoListItems(item: RecordLike): Array<{ text: string; completed: boolean }> {
  const rawItems = Array.isArray(item.items) ? item.items : []
  return rawItems
    .map((raw) => {
      const record = asRecord(raw)
      if (!record) return null
      const text = getString(record.text) || getString(record.content) || getString(record.label)
      if (!text) return null
      return {
        text,
        completed: record.completed === true
      }
    })
    .filter((entry): entry is { text: string; completed: boolean } => Boolean(entry))
}

function shortenFilePath(path: string): string {
  const segments = path.split(/[\\/]+/).filter(Boolean)
  if (segments.length <= 4) return segments.join('/')
  return segments.slice(-4).join('/')
}

function formatFileChangeKind(kind: string | undefined): string {
  const normalized = kind?.toLowerCase()
  if (normalized === 'add' || normalized === 'create') return '新增'
  if (normalized === 'delete' || normalized === 'remove') return '删除'
  if (normalized === 'rename') return '重命名'
  if (normalized === 'move') return '移动'
  if (normalized === 'update' || normalized === 'modify' || normalized === 'edit') return '修改'
  return '变更'
}

type CodexFileChange = {
  path: string
  kind?: string
}

function extractFileChanges(item: RecordLike): CodexFileChange[] {
  const rawChanges = Array.isArray(item.changes) ? item.changes : []
  const changes: CodexFileChange[] = []

  rawChanges.forEach((raw) => {
    const record = asRecord(raw)
    if (!record) return

    const path = getString(record.path)
    if (!path) return

    changes.push({
      path,
      kind: getString(record.kind)
    })
  })

  return changes
}

function getCodexFileChanges(entry: NormalizedEntry): CodexFileChange[] {
  const rawChanges = Array.isArray(entry.metadata?.codexChanges) ? entry.metadata?.codexChanges : []
  const changes: CodexFileChange[] = []

  rawChanges.forEach((raw) => {
    const record = asRecord(raw)
    const path = getString(record?.path)
    if (!path) return

    changes.push({
      path,
      kind: getString(record?.kind)
    })
  })

  return changes
}

function inferFileChangeProcessKind(entry: NormalizedEntry): CodexProcessItemKind {
  const changes = getCodexFileChanges(entry)
  if (changes.length === 0) return 'file_edit_collapsible'

  const createKinds = new Set(['add', 'create'])
  const isCreateOnly = changes.every((change) => createKinds.has(change.kind?.toLowerCase() || ''))
  return isCreateOnly ? 'file_create_collapsible' : 'file_edit_collapsible'
}

function createCodexTodoListEntry(
  item: RecordLike,
  timestamp: number,
  normalizedType: string | undefined,
  idBase: string
): NormalizedEntry {
  const todoItems = extractTodoListItems(item)
  const completedCount = todoItems.filter((entry) => entry.completed).length
  const totalCount = todoItems.length
  const isCompleted = normalizedType?.endsWith('_completed') ?? false
  const progressText = totalCount > 0 ? ` (${completedCount}/${totalCount})` : ''

  return {
    id: idBase,
    type: 'system_message',
    timestamp,
    content: `${isCompleted ? 'Todo list completed' : 'Todo list updated'}${progressText}`,
    metadata: {
      codexCardType: 'todo_list',
      codexItemId: getString(item.id),
      codexItemType: 'todo_list',
      todoItems,
      todoCompletedCount: completedCount,
      todoTotalCount: totalCount,
      status: isCompleted ? 'success' : 'running'
    }
  }
}

function createCodexFileChangeEntry(
  item: RecordLike,
  timestamp: number,
  normalizedType: string | undefined,
  idBase: string
): NormalizedEntry | null {
  const changes = extractFileChanges(item)
  if (changes.length === 0) return null

  const isCompleted = normalizedType?.endsWith('_completed') ?? false
  const heading = isCompleted ? '文件变更' : '文件变更中'
  const lines = changes.map((change) => `- ${formatFileChangeKind(change.kind)} \`${shortenFilePath(change.path)}\``)
  const firstLine = lines[0]
  if (!firstLine) return null

  return {
    id: idBase,
    type: 'system_message',
    timestamp,
    content: lines.length === 1 ? `${heading} · ${firstLine.slice(2)}` : `${heading} (${lines.length})\n${lines.join('\n')}`,
    metadata: {
      codexCardType: 'file_change',
      codexItemId: getString(item.id),
      codexItemType: 'file_change',
      codexChanges: changes,
      status: isCompleted ? 'success' : 'running'
    }
  }
}

function extractCodexItem(msg: RecordLike): RecordLike | null {
  const direct = asRecord(msg.item)
  if (direct) return direct
  const params = asRecord(msg.params)
  if (params) {
    const nested = asRecord(params.item)
    if (nested) return nested
  }
  const result = asRecord(msg.result)
  if (result) {
    const nested = asRecord(result.item)
    if (nested) return nested
  }
  return null
}

function parseCodexItemEvent(
  msg: RecordLike,
  timestamp: number,
  normalizedType: string | undefined,
  idBase: string
): NormalizedEntry | null {
  const item = extractCodexItem(msg)
  if (!item) return null

  const rawItemType = getString(item.type) || getString(item.kind)
  const itemType = rawItemType ? rawItemType.toLowerCase() : undefined
  const isStarted = normalizedType?.endsWith('_started') ?? false
  const isCompleted = normalizedType?.endsWith('_completed') ?? false

  if (itemType && itemType.includes('reasoning')) {
    const text = stringifyContent(item.text ?? item.content ?? item.message ?? item.summary ?? item.output ?? item.result)
    if (!text) return null
    return createEntry(
      'system_message',
      text,
      timestamp,
      idBase,
      withCodexMetadata(
        withCodexEventType({ codexItemType: itemType }, normalizedType),
        { codexBlockType: 'thinking' }
      )
    )
  }

  if (itemType && (itemType.includes('command') || itemType.includes('exec'))) {
    return createCodexCommandEntry(item, timestamp, { isStarted, isCompleted }, idBase)
  }

  if (itemType && itemType.includes('tool')) {
    return createCodexToolUseFromItem(item, timestamp, idBase)
  }

  if (itemType === 'todo_list') {
    return createCodexTodoListEntry(item, timestamp, normalizedType, idBase)
  }

  if (itemType === 'file_change') {
    return createCodexFileChangeEntry(item, timestamp, normalizedType, idBase)
  }

  const text = stringifyContent(item.text ?? item.content ?? item.message ?? item.output ?? item.result)
  if (!text) return null

  if (itemType && (itemType.includes('agent') || itemType.includes('assistant'))) {
    return createEntry(
      'assistant_message',
      text,
      timestamp,
      idBase,
      withCodexEventType({ codexItemType: itemType }, normalizedType)
    )
  }

  if (itemType && itemType.includes('user')) {
    return createEntry(
      'user_message',
      text,
      timestamp,
      idBase,
      withCodexEventType({ codexItemType: itemType }, normalizedType)
    )
  }

  return createEntry(
    'system_message',
    text,
    timestamp,
    idBase,
    withCodexEventType({ codexItemType: itemType }, normalizedType)
  )
}

function parseCodexEventArrayFrom(
  record: RecordLike,
  idBase: string,
  fallbackTimestamp: number | undefined
): NormalizedEntry[] | null {
  const candidates = [record.events, record.initial_messages, record.messages]
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    const entries: NormalizedEntry[] = []
    candidate.forEach((item, index) => {
      if (!isRecord(item)) return
      const parsed = parseCodexMessage(item, makeId(idBase, `evt-${index}`), fallbackTimestamp)
      if (parsed) {
        if (Array.isArray(parsed)) {
          entries.push(...parsed)
        } else {
          entries.push(parsed)
        }
      }
    })
    if (entries.length > 0) return entries
  }
  return null
}

function parseCodexMessage(
  msg: RecordLike,
  idBase: string,
  fallbackTimestamp: number | undefined
): NormalizedEntry | NormalizedEntry[] | null {
  const nested = parseCodexEventArrayFrom(msg, idBase, fallbackTimestamp)
  if (nested) return nested

  const params = asRecord(msg.params)
  if (params) {
    const fromParams = parseCodexEventArrayFrom(params, makeId(idBase, 'params'), fallbackTimestamp)
    if (fromParams) return fromParams
  }

  const result = asRecord(msg.result)
  if (result) {
    const fromResult = parseCodexEventArrayFrom(result, makeId(idBase, 'result'), fallbackTimestamp)
    if (fromResult) return fromResult
  }

  const timestamp = fallbackTimestamp ?? Date.now()
  const rawType = getString(msg.type) || getString(msg.event) || getString(msg.method)
  const normalizedType = rawType ? rawType.toLowerCase().replace(/\./g, '_') : undefined
  const content = extractCodexContent(msg)

  if (normalizedType) {
    if (normalizedType.includes('reasoning')) {
      if (!content) return null
      return createEntry(
        'system_message',
        content,
        timestamp,
        makeId(idBase, 'thinking'),
        withCodexMetadata(
          normalizedType ? { codexEventType: normalizedType } : undefined,
          { codexBlockType: 'thinking' }
        )
      )
    }

    if (normalizedType === 'exec_command_begin') {
      return createCodexCommandBegin(msg, timestamp, makeId(idBase, 'exec-begin'))
    }

    if (normalizedType === 'exec_command_end') {
      return createCodexCommandEnd(msg, timestamp, makeId(idBase, 'exec-end'))
    }

    if (normalizedType === 'patch_apply_begin') {
      return createEntry(
        'system_message',
        formatPatchApplyBegin(msg),
        timestamp,
        makeId(idBase, 'patch-begin'),
        { codexEventType: 'patch_begin' }
      )
    }

    if (normalizedType === 'patch_apply_end') {
      return createEntry(
        'system_message',
        formatPatchApplyEnd(msg),
        timestamp,
        makeId(idBase, 'patch-end'),
        { codexEventType: 'patch_end', success: msg.success === true }
      )
    }

    if (normalizedType.startsWith('item_')) {
      const itemEntry = parseCodexItemEvent(msg, timestamp, normalizedType, makeId(idBase, 'item'))
      if (itemEntry) return itemEntry
      return null
    }

    if (normalizedType === 'thread_started') {
      return createEntry(
        'system_message',
        formatThreadStarted(msg),
        timestamp,
        makeId(idBase, 'thread'),
        { codexEventType: 'thread_started' }
      )
    }

    if (normalizedType === 'turn_started') {
      return createEntry(
        'system_message',
        'Turn started',
        timestamp,
        makeId(idBase, 'turn-start'),
        { codexEventType: 'turn_started' }
      )
    }

    if (normalizedType === 'turn_completed') {
      return createEntry(
        'system_message',
        formatTurnCompleted(msg),
        timestamp,
        makeId(idBase, 'turn-end'),
        { codexEventType: 'turn_completed' }
      )
    }

    if (
      normalizedType === 'agent_message' ||
      normalizedType === 'agent_message_delta' ||
      normalizedType === 'assistant_message' ||
      normalizedType === 'message' ||
      normalizedType === 'response'
    ) {
      if (!content) return null
      return createEntry(
        'assistant_message',
        content,
        timestamp,
        makeId(idBase, 'assistant'),
        { codexEventType: normalizedType }
      )
    }

    if (normalizedType === 'user_message' || normalizedType === 'user') {
      if (!content) return null
      return createEntry(
        'user_message',
        content,
        timestamp,
        makeId(idBase, 'user'),
        { codexEventType: normalizedType }
      )
    }

    if (normalizedType.includes('error')) {
      return createEntry(
        'error',
        content || rawType || normalizedType,
        timestamp,
        makeId(idBase, 'error'),
        { codexEventType: normalizedType }
      )
    }

    if (normalizedType.includes('warning')) {
      return createEntry(
        'system_message',
        content || rawType || normalizedType,
        timestamp,
        makeId(idBase, 'warning'),
        { codexEventType: normalizedType }
      )
    }

    if (normalizedType === 'task_started' || normalizedType === 'task_complete') {
      return createEntry(
        'system_message',
        formatTypeLabel(rawType ?? normalizedType),
        timestamp,
        makeId(idBase, 'task'),
        { codexEventType: normalizedType }
      )
    }
  }

  if (content) {
    return createEntry(
      'system_message',
      content,
      timestamp,
      makeId(idBase, 'system'),
      normalizedType ? { codexEventType: normalizedType } : undefined
    )
  }

  if (rawType) {
    return createEntry(
      'system_message',
      rawType,
      timestamp,
      makeId(idBase, 'system'),
      normalizedType ? { codexEventType: normalizedType } : undefined
    )
  }

  return null
}

function parseCodexLine(
  line: string,
  fallbackTimestamp: number | undefined,
  idBase: string
): NormalizedEntry | NormalizedEntry[] | null {
  try {
    const msg = JSON.parse(line) as unknown
    if (!msg || typeof msg !== 'object') {
      return createEntry('system_message', line, Date.now(), makeId(idBase, 'raw'))
    }
    return parseCodexMessage(msg as RecordLike, idBase, fallbackTimestamp)
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

type RawParser = (
  line: string,
  fallbackTimestamp: number | undefined,
  idBase: string
) => NormalizedEntry | NormalizedEntry[] | null

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
      entries.push(createEntry('error', trimmed, timestamp, `${idBase}-stderr`))
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

    entries.push(createEntry('system_message', trimmed, timestamp, `${idBase}-stdout`))
  })

  return entries
}

export function parseCodexLogs(logs: LogMsg[]): NormalizedEntry[] {
  return parseLogsWithParser(logs, parseCodexLine)
}

export function previewText(text: string, maxLines = 3, maxChars = 220): { text: string; truncated: boolean } {
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

export function buildSummary(entry: NormalizedEntry): {
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

export function buildFacts(entry: NormalizedEntry): Array<{ label: string; value: string }> {
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

export function statusBadge(entry: NormalizedEntry): { label: string; tone: 'ok' | 'warn' | 'error' } | null {
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

export function entryTitle(entry: NormalizedEntry): string {
  if (entry.type === 'assistant_message') return 'Assistant'
  if (entry.type === 'user_message') return 'User'
  if (entry.type === 'error') return 'Error'
  if (entry.type === 'tool_result') return 'Tool result'
  if (entry.type === 'command_run') return 'Command'
  if (entry.type === 'file_edit') return 'File edit'
  if (entry.type === 'file_read') return 'File read'
  if (entry.type === 'tool_use') return getString(entry.metadata?.toolName) || 'Tool call'
  return 'System'
}

export function stripToolInput(metadata: NormalizedEntry['metadata']): RecordLike | null {
  if (!metadata) return null
  const next: RecordLike = {}
  Object.entries(metadata).forEach(([key, value]) => {
    if (key === 'toolInput' || value === undefined) return
    next[key] = value
  })
  return Object.keys(next).length > 0 ? next : null
}

function isNarrativeSystemEntry(entry: NormalizedEntry): boolean {
  if (entry.type !== 'system_message') return false
  const eventType = getString(entry.metadata?.codexEventType)
  if (eventType) {
    if (
      eventType === 'thread_started' ||
      eventType === 'turn_started' ||
      eventType === 'turn_completed' ||
      eventType === 'patch_begin' ||
      eventType === 'patch_end' ||
      eventType === 'task_started' ||
      eventType === 'task_complete'
    ) {
      return false
    }
  }
  if (typeof entry.metadata?.exitCode === 'number') return false

  const content = entry.content.trim().toLowerCase()
  if (!content) return false
  if (
    content === 'turn started' ||
    content.startsWith('thread started') ||
    content.startsWith('turn completed') ||
    content.startsWith('applying patch') ||
    content.startsWith('patch applied') ||
    content.startsWith('patch failed') ||
    content.startsWith('process exited with code') ||
    content === 'process finished'
  ) {
    return false
  }

  return true
}

function appendAssistantBody(current: string, entry: NormalizedEntry): string {
  const next = entry.content
  if (!next) return current
  if (!current) return next

  const eventType = getString(entry.metadata?.codexEventType)
  const isDelta = eventType === 'agent_message_delta'

  if (isDelta) {
    return `${current}${next}`
  }

  const separator = current.endsWith('\n') || next.startsWith('\n') ? '' : '\n\n'
  return `${current}${separator}${next}`
}

function isTurnCompletedEntry(entry: NormalizedEntry): boolean {
  return getString(entry.metadata?.codexEventType) === 'turn_completed'
}

function isErrorEntry(entry: NormalizedEntry): boolean {
  if (entry.type === 'error') return true
  const badge = statusBadge(entry)
  return badge?.tone === 'error'
}

function createAssistantTurn(entries: NormalizedEntry[], index: number): CodexAssistantTurn | null {
  if (entries.length === 0) return null

  let body = ''
  const narrativeEntries: NormalizedEntry[] = []
  const processEntries: NormalizedEntry[] = []

  entries.forEach((entry) => {
    if (entry.type === 'assistant_message') {
      body = appendAssistantBody(body, entry)
      return
    }

    if (isNarrativeSystemEntry(entry)) {
      narrativeEntries.push(entry)
      return
    }

    processEntries.push(entry)
  })

  return {
    id: `assistant-turn-${index}-${entries[0]?.id ?? index}`,
    kind: 'assistant',
    timestamp: entries[0]?.timestamp ?? Date.now(),
    entries,
    body,
    narrativeEntries,
    processEntries,
    completed: entries.some(isTurnCompletedEntry),
    hasErrors: entries.some(isErrorEntry)
  }
}

export function buildCodexConversationTurns(entries: NormalizedEntry[]): CodexConversationTurn[] {
  const turns: CodexConversationTurn[] = []
  let assistantEntries: NormalizedEntry[] = []

  const flushAssistantEntries = () => {
    if (assistantEntries.length === 0) return
    const assistantTurn = createAssistantTurn(assistantEntries, turns.length)
    if (assistantTurn) {
      turns.push(assistantTurn)
    }
    assistantEntries = []
  }

  entries.forEach((entry) => {
    if (entry.type === 'user_message') {
      flushAssistantEntries()
      turns.push({
        id: `user-turn-${entry.id}`,
        kind: 'user',
        timestamp: entry.timestamp,
        entry
      })
      return
    }

    assistantEntries.push(entry)
  })

  flushAssistantEntries()
  return turns
}

function isThinkingEntry(entry: NormalizedEntry): boolean {
  return getString(entry.metadata?.codexBlockType) === 'thinking'
}

function isSystemStatusEntry(entry: NormalizedEntry): boolean {
  if (entry.type !== 'system_message') {
    return false
  }

  const eventType = getString(entry.metadata?.codexEventType)
  if (
    eventType === 'thread_started' ||
    eventType === 'turn_started' ||
    eventType === 'turn_completed' ||
    eventType === 'patch_begin' ||
    eventType === 'patch_end' ||
    eventType === 'task_started' ||
    eventType === 'task_complete'
  ) {
    return true
  }

  return typeof entry.metadata?.exitCode === 'number'
}

function inferProcessKind(entry: NormalizedEntry): CodexProcessItemKind | null {
  if (isThinkingEntry(entry)) return 'thinking_collapsible'
  if (isSystemStatusEntry(entry)) return 'system_status'

  if (entry.type === 'command_run') return 'command_collapsible'
  if (entry.type === 'file_read') return 'file_read_collapsible'
  if (entry.type === 'file_edit') return 'file_edit_collapsible'

  if (entry.type === 'tool_use') {
    const toolName = getString(entry.metadata?.toolName)?.toLowerCase() || ''
    const toolInput = asRecord(entry.metadata?.toolInput)
    if (getString(toolInput?.command)) return 'command_collapsible'
    if (toolName.includes('read')) return 'file_read_collapsible'
    if (toolName.includes('write') || toolName.includes('create')) return 'file_create_collapsible'
    if (toolName.includes('edit') || toolName.includes('patch')) return 'file_edit_collapsible'
    if (toolName.includes('bash') || toolName.includes('exec') || toolName.includes('terminal')) {
      return 'command_collapsible'
    }
    return 'unknown_collapsible'
  }

  if (entry.type === 'tool_result') return 'unknown_collapsible'

  if (entry.type === 'system_message') {
    const cardType = getString(entry.metadata?.codexCardType)
    if (cardType === 'file_change') return inferFileChangeProcessKind(entry)
    if (cardType === 'todo_list') return 'unknown_collapsible'
    if (!isNarrativeSystemEntry(entry)) return 'unknown_collapsible'
  }

  return null
}

function processTitle(kind: CodexProcessItemKind, entry: NormalizedEntry): string {
  const cardType = getString(entry.metadata?.codexCardType)
  if (cardType === 'todo_list') return '待办清单'
  if (cardType === 'file_change') {
    return kind === 'file_create_collapsible' ? '创建文件' : '编辑文件'
  }

  if (kind === 'thinking_collapsible') return '思考过程'
  if (kind === 'command_collapsible') return '执行命令'
  if (kind === 'file_read_collapsible') return '读取文件'
  if (kind === 'file_edit_collapsible') return '编辑文件'
  if (kind === 'file_create_collapsible') return '创建文件'
  if (kind === 'system_status') return '系统状态'
  return entryTitle(entry)
}

function processSummary(kind: CodexProcessItemKind, entry: NormalizedEntry, relatedResult?: NormalizedEntry): string {
  if (kind === 'system_status') {
    return entry.content
  }

  if (kind === 'thinking_collapsible') {
    return ''
  }

  if (
    kind === 'file_read_collapsible' ||
    kind === 'file_edit_collapsible' ||
    kind === 'file_create_collapsible'
  ) {
    const changes = getCodexFileChanges(entry)
    if (changes.length > 0) {
      const firstPath = shortenFilePath(changes[0].path)
      if (changes.length === 1) return firstPath
      return `${firstPath} 等 ${changes.length} 个文件`
    }

    const toolInput = asRecord(entry.metadata?.toolInput)
    const path =
      getString(toolInput?.path) ||
      getString(toolInput?.filePath) ||
      getString(toolInput?.file_path) ||
      getString(entry.metadata?.filePath)
    if (path) return shortenFilePath(path)
  }

  const summary = buildSummary(entry).summary
  if (kind === 'command_collapsible' && summary.startsWith('$ ')) {
    return summary.slice(2)
  }

  if (kind === 'unknown_collapsible' && relatedResult) {
    return buildSummary(relatedResult).summary
  }

  return summary
}

function normalizeAssistantBlockContent(entries: NormalizedEntry[]): string {
  let content = ''
  entries.forEach((entry) => {
    content = appendAssistantBody(content, entry)
  })
  return content
}

function createAnswerBlock(entries: NormalizedEntry[], index: number): CodexAnswerMarkdownBlock | null {
  if (entries.length === 0) return null
  const content = normalizeAssistantBlockContent(entries)
  if (!content.trim()) return null
  return {
    id: `assistant-block-answer-${index}-${entries[0]?.id ?? index}`,
    type: 'assistant_block',
    kind: 'answer_markdown',
    timestamp: entries[0]?.timestamp ?? Date.now(),
    content,
    entries
  }
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

function createProcessBlock(
  entry: NormalizedEntry,
  index: number,
  kind: CodexProcessItemKind,
  relatedResult?: NormalizedEntry
): CodexProcessBlock {
  return {
    id: `assistant-block-process-${index}-${entry.id}`,
    type: 'assistant_block',
    kind,
    timestamp: entry.timestamp,
    title: processTitle(kind, entry),
    summary: processSummary(kind, entry, relatedResult),
    entry,
    relatedResult
  }
}

export function buildCodexTimelineItems(entries: NormalizedEntry[]): CodexTimelineItem[] {
  const items: CodexTimelineItem[] = []
  const assistantBuffer: NormalizedEntry[] = []
  const resultQueues = buildResultQueues(entries)
  const consumedResultIds = new Set<string>()

  const flushAssistantBuffer = () => {
    const answer = createAnswerBlock([...assistantBuffer], items.length)
    if (answer) items.push(answer)
    assistantBuffer.length = 0
  }

  entries.forEach((entry, index) => {
    if (entry.type === 'user_message') {
      flushAssistantBuffer()
      items.push({
        id: `user-bubble-${entry.id}`,
        type: 'user_bubble',
        timestamp: entry.timestamp,
        entry
      })
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
      items.push({
        id: `assistant-block-error-${entry.id}`,
        type: 'assistant_block',
        kind: 'error_block',
        timestamp: entry.timestamp,
        entry
      })
      return
    }

    const kind = inferProcessKind(entry)
    if (kind === 'thinking_collapsible' || kind === 'system_status') {
      items.push(createProcessBlock(entry, index, kind))
      return
    }

    if (!kind && entry.type === 'system_message' && isNarrativeSystemEntry(entry)) {
      items.push({
        id: `assistant-block-system-text-${entry.id}`,
        type: 'assistant_block',
        kind: 'answer_markdown',
        timestamp: entry.timestamp,
        content: entry.content,
        entries: [entry]
      })
      return
    }

    if (!kind) {
      items.push(createProcessBlock(entry, index, 'unknown_collapsible'))
      return
    }

    const relatedResult = consumePairedResult(entry, entries, index, resultQueues, consumedResultIds)
    items.push(createProcessBlock(entry, index, kind, relatedResult))
  })

  flushAssistantBuffer()
  return items
}
