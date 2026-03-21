import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { cn } from '@/lib/utils'

import { useSidebar } from './sidebar-context'

function isMacPlatform() {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform)
}

interface AppTitleBarProps {
  showSidebarToggle?: boolean
}

export function AppTitleBar({ showSidebarToggle = true }: AppTitleBarProps) {
  const { leftOpen, toggleLeft } = useSidebar()
  const isMac = isMacPlatform()

  return (
    <div
      className={cn(
        'app-drag-region flex shrink-0 px-3',
        isMac ? 'h-[3.25rem] items-start pt-1' : 'h-[3.25rem] items-center'
      )}
    >
      <div
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3',
          isMac ? 'pl-[68px]' : 'pl-0'
        )}
      >
        {showSidebarToggle ? (
          <button
            type="button"
            onClick={toggleLeft}
            className="app-no-drag text-muted-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-0 active:bg-transparent flex size-8 shrink-0 items-center justify-center bg-transparent transition-colors"
            aria-label={leftOpen ? 'Hide sidebar' : 'Show sidebar'}
            title={leftOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            {leftOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </button>
        ) : null}
      </div>
    </div>
  )
}
