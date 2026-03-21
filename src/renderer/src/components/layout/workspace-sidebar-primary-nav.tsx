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
  className?: string
}

export function WorkspaceSidebarPrimaryNav({
  leftOpen,
  items,
  className
}: WorkspaceSidebarPrimaryNavProps) {
  return (
    <div className={cn('w-full', className)}>
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
                    'text-sidebar-foreground/88 hover:bg-sidebar-accent/75 hover:text-sidebar-foreground flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-[15px] font-medium transition-colors',
                    item.isActive &&
                      'bg-sidebar-accent text-sidebar-foreground shadow-xs ring-1 ring-inset ring-sidebar-border/80',
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
