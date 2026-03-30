/**
 * Unified Chat Input Component
 *
 * Used for both the home page initial input and task detail reply input.
 * Supports text input, file attachments, image paste, and keyboard shortcuts.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { MessageAttachment } from '@features/cli-session'

import { cn } from '@/lib/utils'

import { ComposerInputShell } from './ComposerInputShell'
import { INPUT_ATTACHMENT_ACCEPT, useInputAttachments } from './useInputAttachments'

export interface ChatInputProps {
  /** Controlled textarea value */
  value?: string
  /** Controlled textarea change callback */
  onValueChange?: (value: string) => void
  /** Placeholder text */
  placeholder?: string
  /** Whether the agent is running */
  isRunning?: boolean
  /** Callback when submitting with text and attachments */
  onSubmit: (text: string, attachments?: MessageAttachment[]) => Promise<void>
  /** Callback when stop button is clicked */
  onStop?: () => void
  /** Variant: 'home' for larger home page style, 'reply' for compact reply style */
  variant?: 'home' | 'reply'
  /** Additional class names */
  className?: string
  /** Whether to disable the input */
  disabled?: boolean
  /** Auto focus on mount */
  autoFocus?: boolean
  /** Extra operation controls shown in home variant */
  operationBar?: ReactNode
  /** Extra actions shown just to the left of the submit button in home variant */
  submitLeftBar?: ReactNode
  /** Optional title value for task creation mode */
  titleValue?: string
  /** Optional title change callback for task creation mode */
  onTitleChange?: (value: string) => void
  /** Title placeholder for task creation mode */
  titlePlaceholder?: string
  /** Whether title is required before submit */
  requireTitle?: boolean
}

export function ChatInput({
  value: controlledValue,
  onValueChange,
  placeholder = 'Type a message...',
  isRunning = false,
  onSubmit,
  onStop,
  variant = 'reply',
  className,
  disabled = false,
  autoFocus = false,
  operationBar,
  submitLeftBar,
  titleValue,
  onTitleChange,
  titlePlaceholder = '请输入标题',
  requireTitle = false
}: ChatInputProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isComposingRef = useRef(false)
  const prevIsRunningRef = useRef(isRunning)
  const isHome = variant === 'home'
  const hasTitleField = isHome && typeof onTitleChange === 'function'
  const isTaskCreateLayout = isHome && hasTitleField
  const isControlled = typeof controlledValue === 'string'
  const value = isControlled ? controlledValue : uncontrolledValue
  const {
    attachments,
    fileInputRef,
    handleFileChange,
    handlePaste,
    openFilePicker,
    removeAttachment,
    resetAttachments,
    toMessageAttachments
  } = useInputAttachments({ logLabel: 'ChatInput' })

  const setValue = useCallback(
    (nextValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(nextValue)
      }
      onValueChange?.(nextValue)
    },
    [isControlled, onValueChange]
  )

  useEffect(() => {
    if (!autoFocus) return;
    if (isTaskCreateLayout && titleInputRef.current) {
      titleInputRef.current.focus()
      return
    }
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus, isTaskCreateLayout])

  useEffect(() => {
    if (prevIsRunningRef.current && !isRunning && textareaRef.current) {
      textareaRef.current.focus()
    }
    prevIsRunningRef.current = isRunning
  }, [isRunning])

  const handleSubmit = async () => {
    const hasContent = value.trim() || attachments.length > 0
    const hasRequiredTitle = !requireTitle || (titleValue || '').trim().length > 0

    if (hasContent && hasRequiredTitle && !isRunning && !disabled) {
      const text = value.trim()
      const messageAttachments = toMessageAttachments()

      setValue('')
      resetAttachments()
      await onSubmit(text, messageAttachments)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  const handleCompositionStart = () => {
    isComposingRef.current = true
  }

  const handleCompositionEnd = () => {
    setTimeout(() => {
      isComposingRef.current = false
    }, 10)
  }

  const canSubmit =
    Boolean(value.trim() || attachments.length > 0) &&
    Boolean(!requireTitle || (titleValue || '').trim()) &&
    !disabled &&
    !isRunning

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea || isTaskCreateLayout) return;

    textarea.style.height = 'auto'

    const maxHeight = isHome ? 200 : 120
    const minHeight = isHome ? 56 : 20
    const newHeight = Math.min(
      Math.max(textarea.scrollHeight, minHeight),
      maxHeight
    )

    textarea.style.height = `${newHeight}px`
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [isTaskCreateLayout, value, isHome])

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={INPUT_ATTACHMENT_ACCEPT}
        onChange={handleFileChange}
        className="hidden"
      />

      <ComposerInputShell
        variant={variant}
        className={className}
        disabled={disabled}
        isRunning={isRunning}
        onStop={onStop}
        attachments={attachments}
        onRemoveAttachment={removeAttachment}
        onOpenFilePicker={openFilePicker}
        titleInputRef={titleInputRef}
        titleValue={titleValue}
        onTitleChange={onTitleChange}
        titlePlaceholder={titlePlaceholder}
        onTitleEnter={() => textareaRef.current?.focus()}
        operationBar={operationBar}
        submitLeftBar={submitLeftBar}
        canSubmit={canSubmit}
        onSubmit={() => {
          void handleSubmit()
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onPaste={handlePaste}
          placeholder={placeholder}
          className={cn(
            'text-foreground placeholder:text-muted-foreground w-full resize-none border-0 bg-transparent focus:outline-none',
            isHome ? 'text-base' : 'px-1 text-sm',
            isTaskCreateLayout && 'min-h-[160px] flex-1 overflow-auto px-0 py-1 text-sm'
          )}
          style={{
            minHeight: isTaskCreateLayout ? undefined : isHome ? '56px' : '20px',
            maxHeight: isTaskCreateLayout ? undefined : isHome ? '200px' : '120px',
            overflowY: isTaskCreateLayout ? 'auto' : 'hidden'
          }}
          rows={1}
          disabled={isRunning || disabled}
        />
      </ComposerInputShell>
    </>
  )
}
