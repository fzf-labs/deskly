import {
  Check,
  FileText,
  GitBranch,
  MonitorSmartphone,
  MoreHorizontal,
  PanelLeft,
  Play,
  RotateCcw,
  Terminal
} from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import type { RightPanelTab } from '../model/right-panel'
import type { LanguageStrings, TaskMetaRow } from '../types'

interface TaskDetailHeaderProps {
  t: LanguageStrings
  title: string
  metaRows: TaskMetaRow[]
  showActionButton: boolean
  actionDisabled: boolean
  actionKind: 'start' | 'complete' | 'retry'
  actionLabel: string
  onAction: () => void
  onToggleSidebar: () => void
  activePanelTab: RightPanelTab | null
  onTogglePanelTab: (tab: RightPanelTab) => void
  onEdit: () => void
  onDelete: () => void
  canEdit: boolean
}

export function TaskDetailHeader({
  t,
  title,
  metaRows,
  showActionButton,
  actionDisabled,
  actionKind,
  actionLabel,
  onAction,
  onToggleSidebar,
  activePanelTab,
  onTogglePanelTab,
  onEdit,
  onDelete,
  canEdit
}: TaskDetailHeaderProps) {
  const panelActions: Array<{ id: RightPanelTab; label: string; icon: typeof FileText }> = [
    { id: 'files', label: t.preview.filesTab, icon: FileText },
    { id: 'git', label: t.preview.gitTab, icon: GitBranch },
    { id: 'terminal', label: t.preview.terminalTab, icon: Terminal },
    { id: 'preview', label: t.preview.preview, icon: MonitorSmartphone }
  ]
  const ActionIcon = actionKind === 'retry' ? RotateCcw : actionKind === 'complete' ? Check : Play

  return (
    <section className="border-border/50 bg-background/95 rounded-t-2xl border-b px-3 py-2 backdrop-blur">
      <div className="flex items-center gap-2 overflow-hidden">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex shrink-0 cursor-pointer items-center justify-center rounded-lg p-2 transition-colors duration-200 md:hidden"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="size-4" />
        </button>

        <div className="min-w-0 flex flex-1 items-center gap-2 overflow-hidden">
          <div className="text-foreground shrink-0 truncate text-sm font-medium">{title}</div>

          {metaRows.length > 0 && (
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto whitespace-nowrap">
              {metaRows.map((row) => {
                const Icon = row.icon
                return (
                  <div
                    key={row.key}
                    className="border-border/60 bg-muted/35 text-muted-foreground flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]"
                  >
                    <Icon className="size-3 shrink-0" />
                    <div className="truncate">{row.value}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex items-center gap-0.5">
            {showActionButton && (
              <button
                type="button"
                onClick={onAction}
                disabled={actionDisabled}
                title={actionLabel}
                aria-label={actionLabel}
                className="border-border/70 bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-accent inline-flex size-8 items-center justify-center rounded-md border transition-colors disabled:opacity-50"
              >
                <ActionIcon className="size-3.5" />
              </button>
            )}

            {panelActions.map((action) => {
              const Icon = action.icon
              const isActive = activePanelTab === action.id

              return (
                <button
                  key={action.id}
                  type="button"
                  title={action.label}
                  aria-label={action.label}
                  onClick={() => onTogglePanelTab(action.id)}
                  aria-pressed={isActive}
                  className={cn(
                    'border-border/70 bg-muted/20 text-muted-foreground hover:bg-accent hover:text-foreground inline-flex size-8 items-center justify-center rounded-md border transition-colors',
                    isActive && 'bg-background text-foreground border-border shadow-sm'
                  )}
                >
                  <Icon className="size-3.5" />
                </button>
              )
            })}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 items-center justify-center rounded-md transition-colors"
                type="button"
                aria-label="Task actions"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
                  {t.common.edit}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={onDelete}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                {t.common.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </section>
  )
}
