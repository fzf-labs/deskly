import { ChevronDown } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import type { WorkspaceProjectGroup } from './useWorkspaceSidebar'
import { WorkspaceSidebarTaskItem } from './workspace-sidebar-task-item'

interface WorkspaceSidebarProjectGroupProps {
  group: WorkspaceProjectGroup
  leftOpen: boolean
  isExpanded: boolean
  isCurrentGroup: boolean
  activeTaskId: string | null
  startConversationLabel: string
  onSelectProject: (projectId: string | null) => void
  onSelectTask: (taskId: string, projectId: string | null) => void
  onToggleGroup: (groupId: string) => void
}

export function WorkspaceSidebarProjectGroup({
  group,
  leftOpen,
  isExpanded,
  isCurrentGroup,
  activeTaskId,
  startConversationLabel,
  onSelectProject,
  onSelectTask,
  onToggleGroup
}: WorkspaceSidebarProjectGroupProps) {
  if (!leftOpen) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSelectProject(group.kind === 'project' ? group.id : null)}
            className={cn(
              'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground flex size-12 items-center justify-center rounded-2xl transition-colors',
              isCurrentGroup && 'bg-sidebar-accent text-sidebar-foreground shadow-sm'
            )}
          >
            <span className="text-sm font-semibold uppercase">{group.name.slice(0, 2)}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{group.name}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <section className="space-y-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSelectProject(group.kind === 'project' ? group.id : null)}
          className={cn(
            'text-sidebar-foreground hover:bg-sidebar-accent/80 flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors',
            isCurrentGroup && 'bg-sidebar-accent shadow-sm'
          )}
        >
          <div className="bg-background/90 text-sidebar-foreground/70 flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/70 text-xs font-semibold uppercase shadow-sm">
            {group.name.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{group.name}</div>
            <div className="text-sidebar-foreground/55 truncate text-xs">
              {group.tasks.length} threads
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onToggleGroup(group.id)}
          className="text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors"
          aria-label={`Toggle ${group.name}`}
        >
          <ChevronDown
            className={cn('size-4 transition-transform', !isExpanded && '-rotate-90')}
          />
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-1 pl-3">
          {group.tasks.length === 0 ? (
            <button
              type="button"
              onClick={() => onSelectProject(group.kind === 'project' ? group.id : null)}
              className="text-sidebar-foreground/45 hover:text-sidebar-foreground flex w-full items-center rounded-xl px-3 py-2 text-xs transition-colors"
            >
              {startConversationLabel}
            </button>
          ) : (
            group.tasks.map((task) => (
              <WorkspaceSidebarTaskItem
                key={task.id}
                task={task}
                isActive={task.id === activeTaskId}
                onClick={onSelectTask}
              />
            ))
          )}
        </div>
      )}
    </section>
  )
}
