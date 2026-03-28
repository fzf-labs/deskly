import { useMemo, useState } from 'react'

import type { LogMsg } from '../../hooks'

import { CodexErrorBlock } from './CodexErrorBlock'
import { CodexMarkdownBlock } from './CodexMarkdownBlock'
import { CodexProcessRow } from './CodexProcessRow'
import { CodexUserBubble } from './CodexUserBubble'
import { buildCodexTimelineItems, parseCodexLogs } from './codex-log-model'

export function CodexLogView({ logs }: { logs: LogMsg[] }): React.ReactNode {
  const entries = useMemo(() => parseCodexLogs(logs), [logs])
  const items = useMemo(() => buildCodexTimelineItems(entries), [entries])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (items.length === 0) {
    return <div className="px-3 py-2 text-xs text-muted-foreground">No logs yet.</div>
  }

  return (
    <div className="w-full space-y-2">
      {items.map((item) => {
        if (item.type === 'user_bubble') {
          return <CodexUserBubble key={item.id} entry={item.entry} />
        }

        if (item.kind === 'answer_markdown') {
          return <CodexMarkdownBlock key={item.id} content={item.content} />
        }

        if (item.kind === 'error_block') {
          return (
            <CodexErrorBlock
              key={item.id}
              entry={item.entry}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
            />
          )
        }

        return (
          <CodexProcessRow
            key={item.id}
            item={item}
            expanded={expandedId === item.id}
            onToggle={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
          />
        )
      })}
    </div>
  )
}
