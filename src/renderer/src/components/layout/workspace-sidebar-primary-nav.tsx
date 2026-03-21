import type { LucideIcon } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface WorkspacePrimaryNavItem {
  id: string
  label: string
  icon: LucideIcon
  isActive: boolean
  onClick: () => void
}

interface WorkspaceSidebarPrimaryNavProps {
  leftOpen: boolean
  items: WorkspacePrimaryNavItem[]
}

export function WorkspaceSidebarPrimaryNav({
  leftOpen,
  items
}: WorkspaceSidebarPrimaryNavProps) {
  return (
    <div className={cn('px-3 pt-2', !leftOpen && 'px-2')}>
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon

          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={item.onClick}
                  className={cn(
                    'text-sidebar-foreground/72 hover:bg-sidebar-accent/75 hover:text-sidebar-foreground flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[15px] font-medium transition-colors',
                    item.isActive && 'bg-sidebar-accent/80 text-sidebar-foreground',
                    !leftOpen && 'justify-center px-0'
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {leftOpen && <span className="truncate">{item.label}</span>}
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
