import { AlertCircle, ChevronDown } from 'lucide-react'

import type { NormalizedEntry } from '../logTypes'
import { formatTime, previewText } from './codex-log-model'

export function CodexErrorBlock({
  entry,
  expanded,
  onToggle
}: {
  entry: NormalizedEntry
  expanded: boolean
  onToggle: () => void
}): React.ReactNode {
  const summary = previewText(entry.content, 1, 160).text || '展开查看错误详情'

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onToggle}
        className="group relative flex w-full items-center justify-between overflow-hidden rounded-[4px] border border-red-500/20 border-l-[4px] px-2.5 py-1 text-left text-[13px] hover:bg-red-500/5 hover:border-red-500/35"
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
          <ChevronDown className={`h-[14px] w-[14px] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
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
