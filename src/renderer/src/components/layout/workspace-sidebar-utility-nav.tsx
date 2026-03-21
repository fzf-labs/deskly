import type { LucideIcon } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { APP_SHELL_SIDEBAR_FOOTER_CLASS } from './sidebar-rhythm'

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
  className?: string
  variant?: 'default' | 'standalone'
}

export function WorkspaceSidebarUtilityNav({
  leftOpen,
  items,
  className,
  variant = 'default'
}: WorkspaceSidebarUtilityNavProps) {
  return (
    <div className={cn(APP_SHELL_SIDEBAR_FOOTER_CLASS, className, !leftOpen && 'px-2')}>
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
                    variant === 'standalone'
                      ? 'text-sidebar-foreground/82 hover:bg-sidebar-accent/72 hover:text-sidebar-foreground flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors'
                      : 'text-sidebar-foreground/78 hover:bg-sidebar-accent/72 hover:text-sidebar-foreground flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors',
                    item.isActive &&
                      (variant === 'standalone'
                        ? 'bg-sidebar-accent text-sidebar-foreground shadow-xs ring-1 ring-inset ring-sidebar-border/80'
                        : 'bg-sidebar-accent text-sidebar-foreground shadow-xs ring-1 ring-inset ring-sidebar-border/80'),
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
