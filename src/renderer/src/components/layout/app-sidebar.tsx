import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Bot,
  ChevronDown,
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
import { Logo } from '@/components/shared/Logo'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useLanguage } from '@/providers/language-provider'

import { useSidebar } from './sidebar-context'
import { useWorkspaceSidebar } from './useWorkspaceSidebar'

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
  const { currentProject, projectGroups, loading, refresh, setCurrentProjectId } =
    useWorkspaceSidebar()

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
      label: 'Dashboard',
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
          <div className="border-sidebar-border/70 border-b px-3 pb-3 pt-3">
            <button
              type="button"
              onClick={handleOpenWorkspace}
              className="hover:bg-sidebar-accent/70 mb-3 flex w-full min-w-0 items-center gap-3 rounded-[22px] px-2.5 py-2 text-left transition-colors"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-[18px] border border-white/70 bg-white/85 shadow-sm">
                <Logo />
              </div>
              {leftOpen ? (
                <div className="min-w-0">
                  <div className="text-sidebar-foreground truncate text-sm font-semibold">
                    Deskly
                  </div>
                  <div className="text-sidebar-foreground/55 truncate text-xs">
                    {currentProject?.name || 'Code workspace'}
                  </div>
                </div>
              ) : null}
            </button>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleOpenWorkspace}
                  className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/92 flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-sm font-medium shadow-sm transition-colors"
                >
                  <Bot className="size-4 shrink-0" />
                  {leftOpen && <span>{t.nav.newThread}</span>}
                </button>
              </TooltipTrigger>
              {!leftOpen && <TooltipContent side="right">{t.nav.newThread}</TooltipContent>}
            </Tooltip>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-2 py-3">
              {loading ? (
                <div
                  className={cn(
                    'text-sidebar-foreground/55 px-3 py-4 text-sm',
                    !leftOpen && 'px-0 text-center'
                  )}
                >
                  Loading...
                </div>
              ) : projectGroups.length === 0 ? (
                <div
                  className={cn(
                    'text-sidebar-foreground/55 px-3 py-4 text-sm',
                    !leftOpen && 'px-0 text-center'
                  )}
                >
                  {leftOpen ? t.nav.noTasksYet : '...'}
                </div>
              ) : (
                <div className="space-y-2">
                  {projectGroups.map((group) => {
                    const isExpanded = expandedGroups[group.id] ?? true
                    const isCurrentGroup =
                      group.isCurrent || group.tasks.some((task) => task.id === activeTaskId)

                    if (!leftOpen) {
                      return (
                        <Tooltip key={group.id}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() =>
                                handleSelectProject(group.kind === 'project' ? group.id : null)
                              }
                              className={cn(
                                'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground flex size-12 items-center justify-center rounded-2xl transition-colors',
                                isCurrentGroup &&
                                  'bg-sidebar-accent text-sidebar-foreground shadow-sm'
                              )}
                            >
                              <span className="text-sm font-semibold uppercase">
                                {group.name.slice(0, 2)}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right">{group.name}</TooltipContent>
                        </Tooltip>
                      )
                    }

                    return (
                      <section key={group.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleSelectProject(group.kind === 'project' ? group.id : null)
                            }
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
                            onClick={() => toggleGroup(group.id)}
                            className="text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors"
                            aria-label={`Toggle ${group.name}`}
                          >
                            <ChevronDown
                              className={cn(
                                'size-4 transition-transform',
                                !isExpanded && '-rotate-90'
                              )}
                            />
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="space-y-1 pl-3">
                            {group.tasks.length === 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleSelectProject(group.kind === 'project' ? group.id : null)
                                }
                                className="text-sidebar-foreground/45 hover:text-sidebar-foreground flex w-full items-center rounded-xl px-3 py-2 text-xs transition-colors"
                              >
                                {t.nav.startConversation}
                              </button>
                            ) : (
                              group.tasks.map((task) => {
                                const isActive = task.id === activeTaskId
                                return (
                                  <button
                                    key={task.id}
                                    type="button"
                                    onClick={() => handleSelectTask(task.id, task.projectId)}
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
                              })
                            )}
                          </div>
                        )}
                      </section>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="border-sidebar-border/70 border-t px-2 py-3">
              <div className={cn('space-y-1', !leftOpen && 'flex flex-col items-center')}>
                {utilityItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={item.onClick}
                          className={cn(
                            'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors',
                            item.isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                            !leftOpen && 'w-auto justify-center px-0'
                          )}
                        >
                          <Icon className="size-4 shrink-0" />
                          {leftOpen && <span>{item.label}</span>}
                        </button>
                      </TooltipTrigger>
                      {!leftOpen && <TooltipContent side="right">{item.label}</TooltipContent>}
                    </Tooltip>
                  )
                })}
              </div>
            </div>
          </div>
        </aside>

        <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      </>
    </TooltipProvider>
  )
}
