import { ChevronDown, Folder, FolderOpen } from 'lucide-react'

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
  const handleToggleProjectGroup = () => {
    onSelectProject(group.kind === 'project' ? group.id : null)
    onToggleGroup(group.id)
  }

  if (!leftOpen) {
    const Icon = isCurrentGroup ? FolderOpen : Folder

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSelectProject(group.kind === 'project' ? group.id : null)}
            className={cn(
              'text-sidebar-foreground/84 hover:bg-sidebar-accent hover:text-sidebar-foreground flex size-10 items-center justify-center rounded-sm transition-colors',
              isCurrentGroup &&
                'border border-sidebar-border/80 bg-sidebar-accent text-sidebar-foreground shadow-xs'
            )}
          >
            <Icon className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{group.name}</TooltipContent>
      </Tooltip>
    )
  }

  const Icon = isCurrentGroup ? FolderOpen : Folder

  return (
    <section className="space-y-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleToggleProjectGroup}
          className={cn(
            'text-sidebar-foreground/88 hover:bg-sidebar-accent/78 hover:text-sidebar-foreground flex min-w-0 flex-1 items-center gap-2.5 rounded-sm px-2.5 py-2 text-left transition-colors',
            isCurrentGroup &&
              'border border-sidebar-border/80 bg-sidebar-accent text-sidebar-foreground shadow-xs'
          )}
          aria-expanded={isExpanded}
        >
          <Icon
            className={cn(
              'text-sidebar-foreground/72 size-4 shrink-0',
              isCurrentGroup && 'text-sidebar-foreground'
            )}
          />
          <div className="min-w-0 flex-1 truncate text-[13px] font-medium">{group.name}</div>
          <ChevronDown className={cn('size-3.5 transition-transform', !isExpanded && '-rotate-90')} />
        </button>
      </div>

      {isExpanded && (
        <div className="ml-2 space-y-0.5 pl-1">
          {group.tasks.length === 0 ? (
            <button
              type="button"
              onClick={() => onSelectProject(group.kind === 'project' ? group.id : null)}
              className="text-sidebar-foreground/68 hover:text-sidebar-foreground flex w-full items-center rounded-sm px-2 py-2 text-xs transition-colors"
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
