import type { NormalizedEntry } from '../logTypes'
import { formatTime } from './codex-log-model'

export function CodexUserBubble({ entry }: { entry: NormalizedEntry }): React.ReactNode {
  return (
    <div className="flex justify-end">
      <div className="max-w-[76%] min-w-0 rounded-[10px] border border-border/35 bg-accent/35 px-3.5 py-2.5 text-foreground">
        <div className="mb-1 text-right text-[11px] text-muted-foreground">{formatTime(entry.timestamp)}</div>
        <p className="text-sm leading-6 break-words whitespace-pre-wrap">{entry.content}</p>
      </div>
    </div>
  )
}
