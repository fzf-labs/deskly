import { cn } from '@/lib/utils'

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
  return (
    <button
      type="button"
      onClick={() => onClick(task.id, task.projectId)}
      className={cn(
        'hover:bg-sidebar-accent/90 flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors',
        isActive && 'bg-background/95 text-foreground shadow-sm'
      )}
    >
      <div
        className={cn(
          'mt-1 size-2.5 shrink-0 rounded-full',
          isActive ? 'bg-foreground' : 'bg-sidebar-foreground/20'
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sidebar-foreground truncate text-sm font-medium">
          {formatTaskLabel(task.title, task.prompt)}
        </div>
        <div className="text-sidebar-foreground/50 mt-0.5 truncate text-xs">
          {formatTaskMeta(task.updatedAt)}
        </div>
      </div>
    </button>
  )
}
