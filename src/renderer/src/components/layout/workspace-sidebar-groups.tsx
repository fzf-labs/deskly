import { cn } from '@/lib/utils'

import type { WorkspaceProjectGroup } from './useWorkspaceSidebar'
import { WorkspaceSidebarProjectGroup } from './workspace-sidebar-project-group'

interface WorkspaceSidebarGroupsProps {
  leftOpen: boolean
  loading: boolean
  emptyLabel: string
  startConversationLabel: string
  activeTaskId: string | null
  activeProjectGroupId: string | null
  projectGroups: WorkspaceProjectGroup[]
  expandedGroups: Record<string, boolean>
  onSelectProject: (projectId: string | null) => void
  onSelectTask: (taskId: string, projectId: string | null) => void
  onToggleGroup: (groupId: string) => void
}

export function WorkspaceSidebarGroups({
  leftOpen,
  loading,
  emptyLabel,
  startConversationLabel,
  activeTaskId,
  activeProjectGroupId,
  projectGroups,
  expandedGroups,
  onSelectProject,
  onSelectTask,
  onToggleGroup
}: WorkspaceSidebarGroupsProps) {
  return (
    <div className={cn('flex-1 overflow-y-auto px-3 pb-3', !leftOpen && 'px-2')}>
      {loading ? (
        <div
          className={cn(
            'text-sidebar-foreground/72 rounded-2xl px-3 py-4 text-sm',
            !leftOpen && 'px-0 text-center'
          )}
        >
          Loading...
        </div>
      ) : projectGroups.length === 0 ? (
        <div
          className={cn(
            'text-sidebar-foreground/72 rounded-2xl px-3 py-4 text-sm',
            !leftOpen && 'px-0 text-center'
          )}
        >
          {leftOpen ? emptyLabel : '...'}
        </div>
      ) : (
        <div className="space-y-1">
          {projectGroups.map((group) => {
            const isExpanded = expandedGroups[group.id] ?? true
            const isCurrentGroup = activeProjectGroupId === group.id
            return (
              <WorkspaceSidebarProjectGroup
                key={group.id}
                group={group}
                leftOpen={leftOpen}
                isExpanded={isExpanded}
                isCurrentGroup={isCurrentGroup}
                activeTaskId={activeTaskId}
                startConversationLabel={startConversationLabel}
                onSelectProject={onSelectProject}
                onSelectTask={onSelectTask}
                onToggleGroup={onToggleGroup}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
