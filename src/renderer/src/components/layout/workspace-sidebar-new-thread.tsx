import { Bot } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface WorkspaceSidebarNewThreadProps {
  leftOpen: boolean
  label: string
  onClick: () => void
}

export function WorkspaceSidebarNewThread({
  leftOpen,
  label,
  onClick
}: WorkspaceSidebarNewThreadProps) {
  return (
    <div className="px-3 pb-3 pt-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/92 flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-sm font-medium shadow-sm transition-colors"
          >
            <Bot className="size-4 shrink-0" />
            {leftOpen && <span>{label}</span>}
          </button>
        </TooltipTrigger>
        {!leftOpen && <TooltipContent side="right">{label}</TooltipContent>}
      </Tooltip>
    </div>
  )
}
