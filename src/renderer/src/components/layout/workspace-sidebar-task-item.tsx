import { cn } from '@/lib/utils'
import { taskStatusUi } from '@features/tasks'

import type { WorkspaceTaskItem } from './useWorkspaceSidebar'

function formatTaskLabel(title: string, prompt: string) {
  const source = title.trim() || prompt.trim()
  if (!source) return 'Untitled'
  return source.length > 36 ? `${source.slice(0, 36)}...` : source
}

function formatTaskMeta(updatedAt: string) {
  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < hour) {
    return `${Math.max(1, Math.floor(diffMs / minute))}m`
  }

  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)}h`
  }

  if (diffMs < day * 7) {
    return `${Math.floor(diffMs / day)}d`
  }

  const isSameYear = now.getFullYear() === date.getFullYear()
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(isSameYear ? {} : { year: 'numeric' })
  })
}

interface WorkspaceSidebarTaskItemProps {
  task: WorkspaceTaskItem
  isActive: boolean
  onClick: (taskId: string, projectId: string | null) => void
}

export function WorkspaceSidebarTaskItem({
  task,
  isActive,
  onClick
}: WorkspaceSidebarTaskItemProps) {
  const statusInfo = taskStatusUi[task.status]

  return (
    <button
      type="button"
      onClick={() => onClick(task.id, task.projectId)}
      aria-label={`${formatTaskLabel(task.title, task.prompt)} · ${statusInfo.label}`}
      className={cn(
        'hover:bg-sidebar-accent/80 flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left transition-colors',
        isActive &&
          'bg-sidebar-accent text-sidebar-foreground shadow-xs ring-1 ring-inset ring-sidebar-border/80'
      )}
    >
      <div
        className={cn(
          'size-2 shrink-0 rounded-full',
          isActive ? statusInfo.dotColor : cn(statusInfo.dotColor, 'opacity-85')
        )}
      />
      <div className="min-w-0 flex-1 truncate">
        <span
          className={cn(
            'truncate text-[13px] font-medium',
            isActive ? 'text-sidebar-foreground' : 'text-sidebar-foreground'
          )}
        >
          {formatTaskLabel(task.title, task.prompt)}
        </span>
      </div>
      <div
        className={cn(
          'text-sidebar-foreground/64 shrink-0 text-[11px] font-medium tabular-nums',
          isActive && 'text-sidebar-foreground/78'
        )}
      >
        {formatTaskMeta(task.updatedAt)}
      </div>
    </button>
  )
}
