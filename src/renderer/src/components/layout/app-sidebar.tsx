import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowUpDown,
  Clock3,
  FolderPlus,
  LayoutDashboard,
  ListChecks,
  PenSquare,
  Server,
  Settings,
  Sparkles,
  Workflow
} from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { createProjectFromDirectory, isProjectRequiredRoute } from '@features/projects'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useToast } from '@/providers/feedback-provider'
import { useLanguage } from '@/providers/language-provider'

import { useSidebar } from './sidebar-context'
import { WorkspaceSidebarPrimaryNav } from './workspace-sidebar-primary-nav'
import {
  type WorkspaceSidebarSortMode,
  useWorkspaceSidebar
} from './useWorkspaceSidebar'
import { WorkspaceSidebarGroups } from './workspace-sidebar-groups'
import { WorkspaceSidebarUtilityNav } from './workspace-sidebar-utility-nav'
import {
  APP_SHELL_SIDEBAR_DIVIDER_CLASS,
  APP_SHELL_SIDEBAR_HERO_CLASS,
  APP_SHELL_SIDEBAR_SECTION_HEADER_CLASS,
  APP_SHELL_SIDEBAR_TOP_OFFSET_CLASS
} from './sidebar-rhythm'

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
  return <WorkspaceSidebarContent />
}

export function WorkspaceSidebarContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLanguage()
  const toast = useToast()
  const { leftOpen } = useSidebar()
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [sortMode, setSortMode] = useState<WorkspaceSidebarSortMode>(getInitialSidebarSortMode)
  const activeTaskId = useActiveTaskId()
  const { addProject, currentProjectId, projectGroups, loading, setCurrentProjectId } =
    useWorkspaceSidebar(sortMode)
  const isWorkspaceRoute =
    location.pathname.startsWith('/tasks') || location.pathname.startsWith('/home')
  const isComposerRoute = isWorkspaceRoute && activeTaskId === null

  useEffect(() => {
    if (!currentProjectId && isProjectRequiredRoute(location.pathname, location.search)) {
      navigate('/tasks', { replace: true })
    }
  }, [currentProjectId, location.pathname, location.search, navigate])

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

  const handleCreateProject = async () => {
    try {
      const project = await createProjectFromDirectory({
        addProject,
        setCurrentProjectId: handleSetCurrentProject
      })
      if (project) {
        navigate('/tasks')
      }
    } catch (error) {
      console.error('Failed to create project:', error)
      toast.error(error instanceof Error ? error.message : '创建项目失败')
    }
  }

  const handleSelectTask = (taskId: string, projectId: string | null) => {
    if (projectId && projectId !== currentProjectId) {
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
      isActive: isComposerRoute
    }
  ]

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
      icon: Workflow,
      onClick: () => navigate('/board'),
      isActive: location.pathname.startsWith('/board')
    },
    {
      id: 'automations',
      label: t.nav.automations,
      icon: Clock3,
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
    }
  ]

  const settingsItem = {
    id: 'settings',
    label: t.nav.settings,
    icon: Settings,
    onClick: () => navigate('/settings'),
    isActive: location.pathname.startsWith('/settings')
  }

  const sidebarVisible = leftOpen
  const visibleUtilityItems = currentProjectId ? utilityItems : []

  return (
    <TooltipProvider delayDuration={120}>
      <div
        className={cn('flex h-full min-h-0 flex-col overflow-hidden', !sidebarVisible && 'hidden')}
      >
        <div className={APP_SHELL_SIDEBAR_TOP_OFFSET_CLASS} />

        <div className={APP_SHELL_SIDEBAR_HERO_CLASS}>
          <WorkspaceSidebarPrimaryNav leftOpen={leftOpen} items={primaryItems} />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={APP_SHELL_SIDEBAR_DIVIDER_CLASS}>
            <div className="border-sidebar-border/70 border-t" />
          </div>

          <div
            className={cn(
              'flex items-center justify-between',
              APP_SHELL_SIDEBAR_SECTION_HEADER_CLASS
            )}
          >
            <div className="text-sidebar-foreground/66 pl-2 text-[13px] font-medium">
              {t.nav.threads}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void handleCreateProject()}
                className="text-sidebar-foreground/66 hover:bg-sidebar-accent hover:text-sidebar-foreground flex size-7 items-center justify-center rounded-lg transition-colors"
                aria-label={t.nav.addProject}
                title={t.nav.addProject}
              >
                <FolderPlus className="size-3.5" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-sidebar-foreground/66 hover:bg-sidebar-accent hover:text-sidebar-foreground flex size-7 items-center justify-center rounded-lg transition-colors"
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
            activeTaskId={activeTaskId}
            activeProjectGroupId={isComposerRoute ? currentProjectId : null}
            projectGroups={projectGroups}
            expandedGroups={expandedGroups}
            onSelectProject={handleSelectProject}
            onSelectTask={handleSelectTask}
            onToggleGroup={toggleGroup}
          />

          {visibleUtilityItems.length > 0 ? (
            <WorkspaceSidebarUtilityNav leftOpen items={visibleUtilityItems} />
          ) : null}
          <div className="px-3 pb-3 pt-4">
            <div className="border-sidebar-border/70 border-t pt-3">
              <WorkspaceSidebarUtilityNav
                leftOpen={leftOpen}
                items={[settingsItem]}
                variant="standalone"
                className="border-0 px-0 py-0"
              />
            </div>
          </div>
        </div>
      </div>

    </TooltipProvider>
  )
}
