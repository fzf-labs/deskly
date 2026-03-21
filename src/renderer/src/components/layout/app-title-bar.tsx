import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { cn } from '@/lib/utils'

import { useSidebar } from './sidebar-context'

function isMacPlatform() {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform)
}

export function AppTitleBar() {
  const location = useLocation()
  const { leftOpen, toggleLeft } = useSidebar()
  const isMac = isMacPlatform()
  const pageLabel = useMemo(() => {
    if (location.pathname === '/tasks' || location.pathname.startsWith('/task/')) {
      return 'Workspace'
    }
    if (location.pathname.startsWith('/projects')) return 'Projects'
    if (location.pathname.startsWith('/dashboard')) return 'Dashboard'
    if (location.pathname.startsWith('/board')) return 'Board'
    if (location.pathname.startsWith('/automations')) return 'Automations'
    if (location.pathname.startsWith('/skills')) return 'Skills'
    if (location.pathname.startsWith('/mcp')) return 'MCP'
    if (location.pathname.startsWith('/pipeline-templates')) return 'Pipelines'
    return 'Deskly'
  }, [location.pathname])

  return (
    <div
      className={cn(
        'app-drag-region flex shrink-0 border-b border-border/70 px-4',
        isMac ? 'h-[3.25rem] items-start pt-1' : 'h-[3.25rem] items-center'
      )}
    >
      <div className={cn('flex min-w-0 flex-1 items-center gap-3', isMac ? 'pl-[68px]' : 'pl-0')}>
        <button
          type="button"
          onClick={toggleLeft}
          className="app-no-drag text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors"
          aria-label={leftOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {leftOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
        </button>

        <div className="min-w-0">
          <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-[0.16em]">
            Deskly
          </div>
          <div className="text-foreground truncate text-sm font-medium">{pageLabel}</div>
        </div>
      </div>
    </div>
  )
}
