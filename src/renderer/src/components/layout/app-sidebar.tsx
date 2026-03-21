import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  FolderKanban,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  Server,
  Settings,
  Sparkles,
  Workflow
} from 'lucide-react'

import { SettingsModal } from '@/components/settings'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/providers/language-provider'

import { useSidebar } from './sidebar-context'
import { useWorkspaceSidebar } from './useWorkspaceSidebar'
import { WorkspaceSidebarGroups } from './workspace-sidebar-groups'
import { WorkspaceSidebarNewThread } from './workspace-sidebar-new-thread'
import { WorkspaceSidebarUtilityNav } from './workspace-sidebar-utility-nav'

function useActiveTaskId() {
  const location = useLocation()
  return useMemo(() => {
    const match = location.pathname.match(/^\/task\/([^/]+)$/)
    return match?.[1] ?? null
  }, [location.pathname])
}

export function AppSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLanguage()
  const { leftOpen } = useSidebar()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const activeTaskId = useActiveTaskId()
  const { projectGroups, loading, refresh, setCurrentProjectId } = useWorkspaceSidebar()

  useEffect(() => {
    const nextExpanded: Record<string, boolean> = {}
    for (const group of projectGroups) {
      nextExpanded[group.id] = expandedGroups[group.id] ?? true
    }
    setExpandedGroups(nextExpanded)
    // We intentionally only react to available groups here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectGroups.map((group) => group.id).join('|')])

  useEffect(() => {
    void refresh()
  }, [location.pathname, refresh])

  const handleOpenWorkspace = () => {
    navigate('/tasks')
  }

  const handleSelectProject = (projectId: string | null) => {
    setCurrentProjectId(projectId)
    navigate('/tasks')
  }

  const handleSelectTask = (taskId: string, projectId: string | null) => {
    if (projectId) {
      setCurrentProjectId(projectId)
    }
    navigate(`/task/${taskId}`)
  }

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  const utilityItems = [
    {
      id: 'dashboard',
      label: t.nav.dashboard,
      icon: LayoutDashboard,
      onClick: () => navigate('/dashboard'),
      isActive: location.pathname.startsWith('/dashboard')
    },
    {
      id: 'board',
      label: t.nav.board,
      icon: KanbanSquare,
      onClick: () => navigate('/board'),
      isActive: location.pathname.startsWith('/board')
    },
    {
      id: 'projects',
      label: t.nav.projects,
      icon: FolderKanban,
      onClick: () => navigate('/projects'),
      isActive: location.pathname.startsWith('/projects')
    },
    {
      id: 'automations',
      label: t.nav.automations,
      icon: Workflow,
      onClick: () => navigate('/automations'),
      isActive: location.pathname.startsWith('/automations')
    },
    {
      id: 'pipelineTemplates',
      label: t.nav.pipelineTemplates,
      icon: ListChecks,
      onClick: () => navigate('/pipeline-templates'),
      isActive: location.pathname.startsWith('/pipeline-templates')
    },
    {
      id: 'skills',
      label: t.nav.skills,
      icon: Sparkles,
      onClick: () => navigate('/skills'),
      isActive: location.pathname.startsWith('/skills')
    },
    {
      id: 'mcp',
      label: t.nav.mcp,
      icon: Server,
      onClick: () => navigate('/mcp'),
      isActive: location.pathname.startsWith('/mcp')
    },
    {
      id: 'settings',
      label: t.nav.settings,
      icon: Settings,
      onClick: () => setSettingsOpen(true),
      isActive: false
    }
  ]

  return (
    <TooltipProvider delayDuration={120}>
      <>
        <aside
          className={cn(
            'bg-sidebar/78 border-sidebar-border/80 flex h-full shrink-0 flex-col border-r backdrop-blur-xl transition-all duration-300 ease-in-out',
            leftOpen ? 'w-[308px]' : 'w-[78px]'
          )}
        >
          <WorkspaceSidebarNewThread
            leftOpen={leftOpen}
            label={t.nav.newThread}
            onClick={handleOpenWorkspace}
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <WorkspaceSidebarGroups
              leftOpen={leftOpen}
              loading={loading}
              emptyLabel={t.nav.noTasksYet}
              startConversationLabel={t.nav.startConversation}
              activeTaskId={activeTaskId}
              projectGroups={projectGroups}
              expandedGroups={expandedGroups}
              onSelectProject={handleSelectProject}
              onSelectTask={handleSelectTask}
              onToggleGroup={toggleGroup}
            />

            <WorkspaceSidebarUtilityNav leftOpen={leftOpen} items={utilityItems} />
          </div>
        </aside>

        <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      </>
    </TooltipProvider>
  )
}
