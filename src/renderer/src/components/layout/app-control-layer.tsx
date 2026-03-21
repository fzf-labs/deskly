import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { cn } from '@/lib/utils'

import { isMacPlatform } from './platform'
import { useSidebar } from './sidebar-context'

export function AppControlLayer() {
  const { leftOpen, setLeftOpen } = useSidebar()
  const isMac = isMacPlatform()

  return (
    <div
      className={cn(
        'pointer-events-none absolute left-0 top-0 z-40',
        isMac ? 'h-12 w-[220px]' : 'h-12 w-[96px]'
      )}
    >
      <div className={cn('absolute', isMac ? 'left-[76px] top-2' : 'left-3 top-3')}>
        <button
          type="button"
          onClick={() => setLeftOpen(!leftOpen)}
          className="app-no-drag pointer-events-auto group flex size-6 items-center justify-center rounded-full transition-transform hover:scale-105"
          aria-label={leftOpen ? 'Hide sidebar' : 'Show sidebar'}
          title={leftOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          <span className="flex size-4 items-center justify-center rounded-full border border-border/70 bg-background/92 text-muted-foreground shadow-[0_4px_10px_rgba(15,23,42,0.12)] backdrop-blur transition-colors group-hover:border-border group-hover:bg-background group-hover:text-foreground">
            {leftOpen ? (
              <PanelLeftClose className="size-[10px]" />
            ) : (
              <PanelLeftOpen className="size-[10px]" />
            )}
          </span>
        </button>
      </div>
    </div>
  )
}
