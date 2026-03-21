import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowUpDown,
  Clock3,
  FolderPlus,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  PenSquare,
  Server,
  Settings,
  Sparkles,
  Workflow
} from 'lucide-react'

import { CreateProjectDialog } from '@/components/projects/ProjectDialogs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/providers/language-provider'

import { useSidebar } from './sidebar-context'
import { WorkspaceSidebarPrimaryNav } from './workspace-sidebar-primary-nav'
import {
  type WorkspaceSidebarSortMode,
  useWorkspaceSidebar
} from './useWorkspaceSidebar'
import { WorkspaceSidebarGroups } from './workspace-sidebar-groups'
import { WorkspaceSidebarUtilityNav } from './workspace-sidebar-utility-nav'

const SIDEBAR_SORT_MODE_KEY = 'deskly_sidebar_sort_mode'

function getInitialSidebarSortMode(): WorkspaceSidebarSortMode {
  if (typeof window === 'undefined') return 'recent'

  const storedMode = window.localStorage.getItem(SIDEBAR_SORT_MODE_KEY)
  return storedMode === 'title' ? 'title' : 'recent'
}

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
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [sortMode, setSortMode] = useState<WorkspaceSidebarSortMode>(getInitialSidebarSortMode)
  const activeTaskId = useActiveTaskId()
  const { addProject, projectGroups, loading, refresh, setCurrentProjectId } =
    useWorkspaceSidebar(sortMode)

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_SORT_MODE_KEY, sortMode)
  }, [sortMode])

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

  const handleSetCurrentProject = (projectId: string) => {
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

  const primaryItems = [
    {
      id: 'new-thread',
      label: t.nav.newThread,
      icon: PenSquare,
      onClick: handleOpenWorkspace,
      isActive:
        location.pathname.startsWith('/tasks') ||
        location.pathname.startsWith('/task/') ||
        location.pathname.startsWith('/home')
    }
  ]

  const utilityItems = [
    {
      id: 'automations',
      label: t.nav.automations,
      icon: Clock3,
      onClick: () => navigate('/automations'),
      isActive: location.pathname.startsWith('/automations')
    },
    {
      id: 'skills',
      label: t.nav.skills,
      icon: Sparkles,
      onClick: () => navigate('/skills'),
      isActive: location.pathname.startsWith('/skills')
    },
    {
      id: 'dashboard',
      label: t.nav.dashboard,
      icon: LayoutDashboard,
      onClick: () => navigate('/dashboard'),
      isActive: location.pathname.startsWith('/dashboard')
    },
    {
      id: 'projects',
      label: t.nav.projects,
      icon: FolderKanban,
      onClick: () => navigate('/projects'),
      isActive: location.pathname.startsWith('/projects')
    },
    {
      id: 'pipelineTemplates',
      label: t.nav.pipelineTemplates,
      icon: ListChecks,
      onClick: () => navigate('/pipeline-templates'),
      isActive: location.pathname.startsWith('/pipeline-templates')
    },
    {
      id: 'board',
      label: t.nav.board,
      icon: Workflow,
      onClick: () => navigate('/board'),
      isActive: location.pathname.startsWith('/board')
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
      onClick: () => navigate('/settings'),
      isActive: location.pathname.startsWith('/settings')
    }
  ]

  const sidebarVisible = leftOpen

  return (
    <TooltipProvider delayDuration={120}>
      <aside
        className={cn(
          'bg-sidebar/88 border-sidebar-border/75 flex h-full shrink-0 flex-col overflow-hidden border-r backdrop-blur-xl transition-all duration-300 ease-in-out',
          sidebarVisible
            ? 'w-[320px] translate-x-0 opacity-100'
            : 'w-0 -translate-x-3 border-r-0 opacity-0 pointer-events-none'
        )}
        aria-hidden={!sidebarVisible}
      >
        <div className="h-12 shrink-0" />

        <WorkspaceSidebarPrimaryNav leftOpen items={primaryItems} />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="px-3 pb-2 pt-4">
            <div className="border-sidebar-border/70 border-t" />
          </div>

          <div className="flex items-center justify-between px-4 pb-2">
            <div className="text-sidebar-foreground/48 text-[13px] font-medium tracking-wide">
              {t.nav.threads}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCreateProjectOpen(true)}
                className="text-sidebar-foreground/48 hover:bg-sidebar-accent hover:text-sidebar-foreground flex size-7 items-center justify-center rounded-lg transition-colors"
                aria-label={t.nav.addProject}
                title={t.nav.addProject}
              >
                <FolderPlus className="size-3.5" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-sidebar-foreground/48 hover:bg-sidebar-accent hover:text-sidebar-foreground flex size-7 items-center justify-center rounded-lg transition-colors"
                    aria-label={t.nav.sortThreads}
                    title={t.nav.sortThreads}
                  >
                    <ArrowUpDown className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortMode('recent')}>
                    <span className="flex-1">{t.nav.sortByRecent}</span>
                    {sortMode === 'recent' ? <span className="text-xs">✓</span> : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortMode('title')}>
                    <span className="flex-1">{t.nav.sortByTitle}</span>
                    {sortMode === 'title' ? <span className="text-xs">✓</span> : null}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <WorkspaceSidebarGroups
            leftOpen
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

          <WorkspaceSidebarUtilityNav leftOpen items={utilityItems} />
        </div>
      </aside>

      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        onAddProject={addProject}
        onSetCurrentProject={handleSetCurrentProject}
      />
    </TooltipProvider>
  )
}
