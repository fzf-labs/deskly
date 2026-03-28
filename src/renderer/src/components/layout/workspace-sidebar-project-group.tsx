import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Folder, FolderOpen } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/providers/language-provider'

import type { WorkspaceProjectGroup } from './useWorkspaceSidebar'
import { WorkspaceSidebarTaskItem } from './workspace-sidebar-task-item'

const TASK_BATCH_SIZE = 10

function getVisibleTaskCountForIndex(taskIndex: number) {
  return Math.ceil((taskIndex + 1) / TASK_BATCH_SIZE) * TASK_BATCH_SIZE
}

interface WorkspaceSidebarProjectGroupProps {
  group: WorkspaceProjectGroup
  leftOpen: boolean
  isExpanded: boolean
  isCurrentGroup: boolean
  activeTaskId: string | null
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
  onSelectProject,
  onSelectTask,
  onToggleGroup
}: WorkspaceSidebarProjectGroupProps) {
  const { tt } = useTranslation()
  const [visibleTaskCount, setVisibleTaskCount] = useState(TASK_BATCH_SIZE)

  const activeTaskIndex = useMemo(
    () => group.tasks.findIndex((task) => task.id === activeTaskId),
    [activeTaskId, group.tasks]
  )

  useEffect(() => {
    if (activeTaskIndex < 0) return

    const requiredVisibleTaskCount = getVisibleTaskCountForIndex(activeTaskIndex)
    setVisibleTaskCount((current) => Math.max(current, requiredVisibleTaskCount))
  }, [activeTaskIndex])

  const handleToggleProjectGroup = () => {
    onSelectProject(group.kind === 'project' ? group.id : null)
    onToggleGroup(group.id)
  }

  const visibleTasks = group.tasks.slice(0, visibleTaskCount)
  const remainingTaskCount = Math.max(0, group.tasks.length - visibleTasks.length)

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
                'bg-sidebar-accent text-sidebar-foreground shadow-xs ring-1 ring-inset ring-sidebar-border/80'
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
              'bg-sidebar-accent text-sidebar-foreground shadow-xs ring-1 ring-inset ring-sidebar-border/80'
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
          {group.tasks.length > 0 ? (
            visibleTasks.map((task) => (
              <WorkspaceSidebarTaskItem
                key={task.id}
                task={task}
                isActive={task.id === activeTaskId}
                onClick={onSelectTask}
              />
            ))
          ) : null}
          {remainingTaskCount > 0 ? (
            <button
              type="button"
              onClick={() => setVisibleTaskCount((current) => current + TASK_BATCH_SIZE)}
              className={cn(
                'text-sidebar-foreground/58 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground/74',
                'w-full rounded-sm px-2 py-1.5 text-center text-[12px] font-medium transition-colors'
              )}
            >
              {tt('nav.showMoreThreads')}
            </button>
          ) : null}
        </div>
      )}
    </section>
  )
}
