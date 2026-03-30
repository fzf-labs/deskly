import type { ReactNode, RefObject } from 'react'
import { ArrowUp, FileText, Paperclip, Plus, Send, Square, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useLanguage } from '@/providers/language-provider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

import type { InputAttachment } from './useInputAttachments'

interface ComposerInputShellProps {
  variant?: 'home' | 'reply'
  className?: string
  disabled?: boolean
  isRunning?: boolean
  onStop?: () => void
  attachments: InputAttachment[]
  onRemoveAttachment: (id: string) => void
  onOpenFilePicker: () => void
  titleInputRef?: RefObject<HTMLInputElement | null>
  titleValue?: string
  onTitleChange?: (value: string) => void
  titlePlaceholder?: string
  onTitleEnter?: () => void
  bodyWrapperClassName?: string
  children: ReactNode
  operationBar?: ReactNode
  submitLeftBar?: ReactNode
  canSubmit: boolean
  onSubmit: () => void
}

export function ComposerInputShell({
  variant = 'reply',
  className,
  disabled = false,
  isRunning = false,
  onStop,
  attachments,
  onRemoveAttachment,
  onOpenFilePicker,
  titleInputRef,
  titleValue,
  onTitleChange,
  titlePlaceholder = '请输入标题',
  onTitleEnter,
  bodyWrapperClassName,
  children,
  operationBar,
  submitLeftBar,
  canSubmit,
  onSubmit
}: ComposerInputShellProps) {
  const { t } = useLanguage()
  const isHome = variant === 'home'
  const hasTitleField = isHome && typeof onTitleChange === 'function'
  const isTaskCreateLayout = isHome && hasTitleField

  return (
    <div
      className={cn(
        'w-full',
        isHome
          ? 'border-border/60 bg-background/96 rounded-[28px] border p-4 shadow-[0_24px_60px_rgba(15,23,42,0.10)] backdrop-blur'
          : 'border-border/60 bg-background rounded-xl border p-3 shadow-sm',
        isTaskCreateLayout && 'flex min-h-[300px] flex-col',
        className
      )}
    >
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="group border-border/50 bg-muted/50 relative flex items-center gap-2 rounded-lg border px-3 py-2"
            >
              {attachment.type === 'image' && attachment.preview ? (
                <img
                  src={attachment.preview}
                  alt={attachment.file.name}
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <div className="bg-muted flex h-10 w-10 items-center justify-center rounded">
                  <FileText className="text-muted-foreground h-5 w-5" />
                </div>
              )}
              <span className="text-foreground max-w-[120px] truncate text-sm">
                {attachment.file.name}
              </span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(attachment.id)}
                className="bg-primary text-primary-foreground absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {hasTitleField && (
        <>
          <div className="mb-2">
            <input
              ref={titleInputRef}
              value={titleValue || ''}
              onChange={(event) => onTitleChange?.(event.target.value)}
              placeholder={titlePlaceholder}
              className="text-foreground placeholder:text-muted-foreground w-full border-0 bg-transparent px-0 py-1 text-base font-medium focus:outline-none"
              disabled={isRunning || disabled}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  onTitleEnter?.()
                }
              }}
            />
          </div>
          <div className="bg-border/70 mb-3 h-px w-full" />
        </>
      )}

      <div
        className={cn(
          isTaskCreateLayout && 'min-h-0 flex flex-1 flex-col',
          bodyWrapperClassName
        )}
      >
        {children}
      </div>

      <div className={cn('flex items-center justify-between', isHome ? 'mt-3' : 'mt-2')}>
        <div className={cn('flex items-center gap-1', isHome && 'min-w-0 flex-1')}>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              disabled={isRunning || disabled}
              className={cn(
                'flex items-center justify-center transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                isHome
                  ? 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground size-8 rounded-full border'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground size-7 rounded-md'
              )}
            >
              <Plus className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={8} className="z-50 w-56">
              <DropdownMenuItem
                onSelect={onOpenFilePicker}
                className="cursor-pointer gap-3 py-2.5"
              >
                <Paperclip className="size-4" />
                <span>{t.home.addFilesOrPhotos}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isHome && operationBar && <div className="ml-1 min-w-0 flex-1">{operationBar}</div>}
        </div>

        <div className="flex items-center gap-1">
          {isHome && submitLeftBar}
          {isRunning && onStop ? (
            <button
              type="button"
              onClick={onStop}
              className={cn(
                'flex items-center justify-center rounded-full transition-colors',
                isHome
                  ? 'size-8 bg-red-500 text-white hover:bg-red-600'
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90 size-7'
              )}
            >
              <Square className={isHome ? 'size-3.5' : 'size-3'} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className={cn(
                'flex items-center justify-center rounded-full transition-all',
                canSubmit
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer'
                  : 'bg-muted text-muted-foreground cursor-not-allowed',
                isHome ? 'size-8' : 'size-7'
              )}
            >
              {isHome ? <ArrowUp className="size-4" /> : <Send className="size-3" />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
