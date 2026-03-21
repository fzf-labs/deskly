import type { LucideIcon } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface WorkspaceUtilityNavItem {
  id: string
  label: string
  icon: LucideIcon
  isActive: boolean
  onClick: () => void
}

interface WorkspaceSidebarUtilityNavProps {
  leftOpen: boolean
  items: WorkspaceUtilityNavItem[]
}

export function WorkspaceSidebarUtilityNav({
  leftOpen,
  items
}: WorkspaceSidebarUtilityNavProps) {
  return (
    <div className="border-sidebar-border/70 border-t px-2 py-3">
      <div className={cn('space-y-1', !leftOpen && 'flex flex-col items-center')}>
        {items.map((item) => {
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
  )
}
