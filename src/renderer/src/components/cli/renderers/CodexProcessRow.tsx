import {
  ChevronDown,
  File,
  FilePen,
  FilePlus,
  Lightbulb,
  MessageSquare,
  SquareTerminal
} from 'lucide-react'

import { cn } from '@/lib/utils'

import type { CodexProcessBlock } from './codex-log-model'
import {
  asRecord,
  buildFacts,
  buildSummary,
  formatTime,
  statusBadge,
  stringify,
  stripToolInput
} from './codex-log-model'

function processTone(kind: CodexProcessBlock['kind']): { border: string; icon: string; gradient: string } {
  if (kind === 'thinking_collapsible') {
    return {
      border: 'border-amber-500/30 hover:border-amber-500/45',
      icon: 'text-amber-600',
      gradient: 'from-muted/45 to-amber-100/70'
    }
  }
  if (kind === 'command_collapsible') {
    return {
      border: 'border-emerald-500/25 hover:border-emerald-500/40',
      icon: 'text-emerald-700',
      gradient: 'from-muted/45 to-emerald-100/70'
    }
  }
  if (kind === 'file_read_collapsible') {
    return {
      border: 'border-slate-400/30 hover:border-slate-500/45',
      icon: 'text-slate-600',
      gradient: 'from-muted/45 to-slate-100/80'
    }
  }
  if (kind === 'file_edit_collapsible') {
    return {
      border: 'border-sky-500/25 hover:border-sky-500/40',
      icon: 'text-sky-700',
      gradient: 'from-muted/45 to-sky-100/80'
    }
  }
  if (kind === 'file_create_collapsible') {
    return {
      border: 'border-green-500/25 hover:border-green-500/40',
      icon: 'text-green-700',
      gradient: 'from-muted/45 to-green-100/80'
    }
  }
  if (kind === 'system_status') {
    return {
      border: 'border-border/60 hover:border-muted-foreground/50',
      icon: 'text-muted-foreground',
      gradient: 'from-muted/45 to-muted/70'
    }
  }
  return {
    border: 'border-border/60 hover:border-muted-foreground/50',
    icon: 'text-muted-foreground',
    gradient: 'from-muted/45 to-emerald-100/60'
  }
}

function processIcon(kind: CodexProcessBlock['kind']): React.ReactNode {
  if (kind === 'thinking_collapsible') return <Lightbulb className="h-[14px] w-[14px] shrink-0" />
  if (kind === 'command_collapsible') return <SquareTerminal className="h-[14px] w-[14px] shrink-0" />
  if (kind === 'file_read_collapsible') return <File className="h-[14px] w-[14px] shrink-0" />
  if (kind === 'file_edit_collapsible') return <FilePen className="h-[14px] w-[14px] shrink-0" />
  if (kind === 'file_create_collapsible') return <FilePlus className="h-[14px] w-[14px] shrink-0" />
  return <MessageSquare className="h-[14px] w-[14px] shrink-0" />
}

function EntryDetail({ label, entry }: { label: string; entry: CodexProcessBlock['entry'] }): React.ReactNode {
  const facts = buildFacts(entry)
  const { fullContent, hasHiddenContent } = buildSummary(entry)
  const rawToolInput = asRecord(entry.metadata?.toolInput)
  const rawMetadata = stripToolInput(entry.metadata)

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

export function CodexProcessRow({
  item,
  expanded,
  onToggle
}: {
  item: CodexProcessBlock
  expanded: boolean
  onToggle: () => void
}): React.ReactNode {
  const tone = processTone(item.kind)
  const badge = statusBadge(item.relatedResult ?? item.entry)
  const isCollapsible = item.kind !== 'system_status'

  if (!isCollapsible) {
    return (
      <div className="w-full">
        <div
          className={cn(
            'relative flex w-full items-center overflow-hidden rounded-[4px] border border-l-[4px] px-2.5 py-1 text-[13px]',
            tone.border
          )}
        >
          <div
            className={cn(
              'pointer-events-none absolute inset-y-0 left-0 w-full rounded-r-[4px] bg-gradient-to-r opacity-35',
              tone.gradient
            )}
          />
          <div className="relative z-10 flex min-w-0 items-center overflow-hidden">
            <span className={tone.icon}>{processIcon(item.kind)}</span>
            <div className="ml-1 text-foreground">{item.title}</div>
            {item.summary ? (
              <span className="ml-1 flex-1 overflow-hidden text-muted-foreground">
                <div className="truncate">{item.summary}</div>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'group relative flex w-full items-center justify-between overflow-hidden rounded-[4px] border border-l-[4px] px-2.5 py-1 text-left text-[13px]',
          tone.border
        )}
      >
        <div className={cn('pointer-events-none absolute inset-y-0 left-0 w-full rounded-r-[4px] bg-gradient-to-r opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100', tone.gradient)} />
        <div className="relative z-10 flex min-w-0 items-center overflow-hidden">
          <span className={tone.icon}>{processIcon(item.kind)}</span>
          <div className="ml-1 text-foreground">{item.title}</div>
          {item.summary ? (
            <span className="ml-1 flex-1 overflow-hidden text-muted-foreground">
              <div className="truncate">{item.summary}</div>
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
          <EntryDetail label={item.title} entry={item.entry} />
          {item.relatedResult && (
            <div className="border-t border-border/45 pt-3">
              <EntryDetail label="结果" entry={item.relatedResult} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
