import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode
} from 'react'
import type { MessageAttachment } from '@features/cli-session'
import { useLanguage } from '@/providers/language-provider'
import { cn } from '@/lib/utils'
import { Sparkles, Wrench } from 'lucide-react'

import { ComposerInputShell } from '@/components/shared/ComposerInputShell'
import {
  INPUT_ATTACHMENT_ACCEPT,
  useInputAttachments
} from '@/components/shared/useInputAttachments'
import {
  createTaskPromptTextNode,
  getTaskPromptVisibleText,
  hasTaskPromptContent,
  normalizeTaskPromptNodes,
  type TaskPromptNode,
  type TaskPromptSlashItem
} from '../model/task-prompt'
import { scrollSelectedSlashItemIntoView } from './task-composer-input-utils'

interface TaskComposerInputSubmitPayload {
  text: string
  promptNodes?: TaskPromptNode[]
  attachments?: MessageAttachment[]
}

interface TaskComposerInputProps {
  inputMode?: 'plain' | 'slash-rich'
  value?: string
  onValueChange?: (value: string) => void
  promptNodes?: TaskPromptNode[]
  onPromptNodesChange?: (nodes: TaskPromptNode[]) => void
  slashItems?: TaskPromptSlashItem[]
  slashLoading?: boolean
  slashEnabled?: boolean
  placeholder?: string
  className?: string
  disabled?: boolean
  autoFocus?: boolean
  operationBar?: ReactNode
  submitLeftBar?: ReactNode
  titleValue?: string
  onTitleChange?: (value: string) => void
  titlePlaceholder?: string
  requireTitle?: boolean
  onSubmit: (payload: TaskComposerInputSubmitPayload) => Promise<void>
}
const generatePromptTokenInstanceId = (baseId: string) =>
  `${baseId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const serializePromptNodes = (nodes: TaskPromptNode[]) =>
  JSON.stringify(normalizeTaskPromptNodes(nodes))

const createTokenElement = (
  documentRef: Document,
  node: Extract<TaskPromptNode, { type: 'token' }>
) => {
  const chip = documentRef.createElement('span')
  chip.contentEditable = 'false'
  chip.dataset.nodeKind = 'token'
  chip.dataset.tokenId = node.id
  chip.dataset.tokenKind = node.tokenKind
  chip.dataset.tokenName = node.name
  chip.dataset.tokenSource = node.source
  chip.dataset.tokenToolId = node.toolId
  chip.className =
    'mx-0.5 inline-flex max-w-full select-none items-center gap-1 rounded-full border border-border/70 bg-muted/70 px-2 py-0.5 align-baseline text-xs font-medium text-foreground'

  const icon = documentRef.createElement('span')
  icon.className = 'text-muted-foreground'
  icon.textContent = node.tokenKind === 'skill' ? 'S' : 'M'

  const label = documentRef.createElement('span')
  label.className = 'max-w-[160px] truncate'
  label.textContent = node.name

  const remove = documentRef.createElement('span')
  remove.dataset.tokenRemove = 'true'
  remove.className = 'text-muted-foreground hover:text-foreground cursor-pointer'
  remove.textContent = '×'

  chip.append(icon, label, remove)
  return chip
}

const buildEditorDom = (editor: HTMLDivElement, nodes: TaskPromptNode[]) => {
  const nextNodes = normalizeTaskPromptNodes(nodes)
  const documentRef = editor.ownerDocument
  editor.replaceChildren()

  for (const node of nextNodes) {
    if (node.type === 'text') {
      editor.append(documentRef.createTextNode(node.text))
      continue
    }

    editor.append(createTokenElement(documentRef, node))
  }
}

const parsePromptNodesFromEditor = (editor: HTMLDivElement): TaskPromptNode[] => {
  const nodes: TaskPromptNode[] = []
  let textBuffer = ''

  const flushText = () => {
    if (!textBuffer) {
      return
    }
    nodes.push(createTaskPromptTextNode(textBuffer))
    textBuffer = ''
  }

  for (const child of Array.from(editor.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      textBuffer += child.textContent || ''
      continue
    }

    if (!(child instanceof HTMLElement)) {
      continue
    }

    if (child.dataset.nodeKind === 'token') {
      flushText()
      const tokenKind = child.dataset.tokenKind
      const id = child.dataset.tokenId
      const name = child.dataset.tokenName
      const source = child.dataset.tokenSource
      const toolId = child.dataset.tokenToolId

      if (
        (tokenKind === 'skill' || tokenKind === 'mcp') &&
        id &&
        name &&
        (source === 'project' || source === 'global') &&
        toolId
      ) {
        nodes.push({
          type: 'token',
          tokenKind,
          id,
          name,
          source,
          toolId
        })
      }
      continue
    }

    if (child.tagName === 'BR') {
      textBuffer += '\n'
      continue
    }

    textBuffer += child.textContent || ''
  }

  flushText()
  return normalizeTaskPromptNodes(nodes)
}

const isSelectionInside = (root: HTMLElement, target: Node | null) =>
  Boolean(target) && (target === root || root.contains(target))

const placeCaretAfterNode = (node: Node) => {
  const selection = window.getSelection()
  if (!selection) {
    return
  }

  const range = document.createRange()
  if (node.nodeType === Node.TEXT_NODE) {
    const textNode = node as Text
    range.setStart(textNode, textNode.textContent?.length || 0)
  } else {
    range.setStartAfter(node)
  }
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

const insertTextAtSelection = (text: string) => {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return
  }

  const range = selection.getRangeAt(0)
  range.deleteContents()
  const textNode = document.createTextNode(text)
  range.insertNode(textNode)
  placeCaretAfterNode(textNode)
}

export function TaskComposerInput({
  inputMode = 'slash-rich',
  value = '',
  onValueChange,
  promptNodes = [],
  onPromptNodesChange,
  slashItems = [],
  slashLoading = false,
  slashEnabled = false,
  placeholder = '提示词',
  className,
  disabled = false,
  autoFocus = false,
  operationBar,
  submitLeftBar,
  titleValue,
  onTitleChange,
  titlePlaceholder = '请输入标题',
  requireTitle = false,
  onSubmit
}: TaskComposerInputProps) {
  const { t } = useLanguage()
  const [slashQuery, setSlashQuery] = useState('')
  const [slashOpen, setSlashOpen] = useState(false)
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const slashMenuRef = useRef<HTMLDivElement>(null)
  const slashRangeRef = useRef<Range | null>(null)
  const lastAppliedNodesRef = useRef<string>('')
  const {
    attachments,
    fileInputRef,
    handleFileChange,
    handlePaste,
    openFilePicker,
    removeAttachment,
    resetAttachments,
    toMessageAttachments
  } = useInputAttachments({ logLabel: 'TaskComposerInput' })
  const useRichInput = inputMode === 'slash-rich'
  const slashEditorEnabled = useRichInput && slashEnabled

  const normalizedPromptNodes = useMemo(() => normalizeTaskPromptNodes(promptNodes), [promptNodes])
  const visibleText = useMemo(
    () => (useRichInput ? getTaskPromptVisibleText(normalizedPromptNodes) : value),
    [normalizedPromptNodes, useRichInput, value]
  )

  const filteredSlashItems = useMemo(() => {
    const normalizedQuery = slashQuery.trim().toLowerCase()
    const items = normalizedQuery
      ? slashItems.filter((item) => item.searchText.includes(normalizedQuery))
      : slashItems

    return items
  }, [slashItems, slashQuery])

  useEffect(() => {
    if (!slashEditorEnabled) {
      setSlashOpen(false)
      setSlashQuery('')
      setSelectedSlashIndex(0)
      slashRangeRef.current = null
    }
  }, [slashEditorEnabled])

  useEffect(() => {
    if (!useRichInput) {
      return
    }

    const editor = editorRef.current
    if (!editor) {
      return
    }

    const nextSignature = serializePromptNodes(normalizedPromptNodes)
    const currentSignature = serializePromptNodes(parsePromptNodesFromEditor(editor))
    if (nextSignature === currentSignature && nextSignature === lastAppliedNodesRef.current) {
      return
    }

    buildEditorDom(editor, normalizedPromptNodes)
    lastAppliedNodesRef.current = nextSignature
  }, [normalizedPromptNodes, useRichInput])

  useEffect(() => {
    if (!autoFocus) {
      return
    }

    if (typeof onTitleChange === 'function' && titleInputRef.current) {
      titleInputRef.current.focus()
      return
    }

    if (useRichInput) {
      editorRef.current?.focus()
      return
    }

    textareaRef.current?.focus()
  }, [autoFocus, onTitleChange, useRichInput])

  useEffect(() => {
    if (!slashOpen) {
      return
    }

    setSelectedSlashIndex((previous) => {
      if (filteredSlashItems.length === 0) {
        return 0
      }
      return Math.min(previous, filteredSlashItems.length - 1)
    })
  }, [filteredSlashItems.length, slashOpen])

  useEffect(() => {
    if (!slashOpen) {
      return
    }

    const frameId = requestAnimationFrame(() => {
      scrollSelectedSlashItemIntoView(slashMenuRef.current)
    })

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [filteredSlashItems, selectedSlashIndex, slashOpen])

  const closeSlashMenu = useCallback(() => {
    setSlashOpen(false)
    setSlashQuery('')
    setSelectedSlashIndex(0)
    slashRangeRef.current = null
  }, [])

  const syncNodesFromEditor = useCallback(() => {
    const editor = editorRef.current
    if (!editor) {
      return
    }

    const nextNodes = parsePromptNodesFromEditor(editor)
    lastAppliedNodesRef.current = serializePromptNodes(nextNodes)
    onPromptNodesChange?.(nextNodes)
  }, [onPromptNodesChange])

  const updateSlashState = useCallback(() => {
    if (!slashEditorEnabled) {
      closeSlashMenu()
      return
    }

    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      closeSlashMenu()
      return
    }

    const anchorNode = selection.anchorNode
    if (!isSelectionInside(editor, anchorNode)) {
      closeSlashMenu()
      return
    }

    let textNode: Text | null = null
    let offset = selection.anchorOffset

    if (anchorNode?.nodeType === Node.TEXT_NODE) {
      textNode = anchorNode as Text
    } else if (anchorNode === editor && offset > 0) {
      const previousNode = editor.childNodes[offset - 1]
      if (previousNode?.nodeType === Node.TEXT_NODE) {
        textNode = previousNode as Text
        offset = textNode.textContent?.length || 0
      }
    }

    if (!textNode) {
      closeSlashMenu()
      return
    }

    const textBeforeCaret = (textNode.textContent || '').slice(0, offset)
    const slashIndex = textBeforeCaret.lastIndexOf('/')
    if (slashIndex === -1) {
      closeSlashMenu()
      return
    }

    if (slashIndex > 0) {
      const previousChar = textBeforeCaret[slashIndex - 1]
      if (!/\s/.test(previousChar)) {
        closeSlashMenu()
        return
      }
    }

    const query = textBeforeCaret.slice(slashIndex + 1)
    if (/[\s/]/.test(query)) {
      closeSlashMenu()
      return
    }

    const triggerRange = document.createRange()
    triggerRange.setStart(textNode, slashIndex)
    triggerRange.setEnd(textNode, offset)

    slashRangeRef.current = triggerRange
    setSlashQuery(query)
    setSlashOpen(true)
  }, [closeSlashMenu, slashEditorEnabled])

  const removeTokenById = useCallback(
    (tokenId: string) => {
      const nextNodes = normalizedPromptNodes.filter(
        (node) => node.type !== 'token' || node.id !== tokenId
      )
      onPromptNodesChange?.(nextNodes)
      closeSlashMenu()
      requestAnimationFrame(() => {
        editorRef.current?.focus()
      })
    },
    [closeSlashMenu, normalizedPromptNodes, onPromptNodesChange]
  )

  const insertSlashItem = useCallback(
    (item: TaskPromptSlashItem) => {
      const editor = editorRef.current
      const triggerRange = slashRangeRef.current
      if (!editor || !triggerRange) {
        return
      }

      editor.focus()
      triggerRange.deleteContents()

      const tokenNode: Extract<TaskPromptNode, { type: 'token' }> = {
        type: 'token',
        tokenKind: item.tokenKind,
        id: generatePromptTokenInstanceId(item.id),
        name: item.name,
        source: item.source,
        toolId: item.toolId
      }

      const tokenElement = createTokenElement(document, tokenNode)
      const trailingSpace = document.createTextNode(' ')
      triggerRange.insertNode(trailingSpace)
      triggerRange.insertNode(tokenElement)
      placeCaretAfterNode(trailingSpace)

      syncNodesFromEditor()
      closeSlashMenu()
    },
    [closeSlashMenu, syncNodesFromEditor]
  )

  const handleEditorInput = () => {
    syncNodesFromEditor()
    updateSlashState()
  }

  const handleEditorClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    const removeTarget = target?.closest<HTMLElement>('[data-token-remove="true"]')
    if (removeTarget) {
      event.preventDefault()
      const tokenTarget = removeTarget.closest<HTMLElement>('[data-token-id]')
      if (tokenTarget?.dataset.tokenId) {
        removeTokenById(tokenTarget.dataset.tokenId)
      }
      return
    }

    updateSlashState()
  }

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (slashOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedSlashIndex((previous) =>
          filteredSlashItems.length === 0 ? 0 : (previous + 1) % filteredSlashItems.length
        )
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedSlashIndex((previous) =>
          filteredSlashItems.length === 0
            ? 0
            : (previous - 1 + filteredSlashItems.length) % filteredSlashItems.length
        )
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        closeSlashMenu()
        return
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        const selectedItem = filteredSlashItems[selectedSlashIndex]
        if (selectedItem) {
          event.preventDefault()
          insertSlashItem(selectedItem)
          return
        }
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (!disabled) {
        void handleSubmit()
      }
      return
    }

    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault()
      insertTextAtSelection('\n')
      syncNodesFromEditor()
      closeSlashMenu()
      return
    }

    const selection = window.getSelection()
    if (!selection || !selection.isCollapsed || selection.rangeCount === 0) {
      return
    }

    const editor = editorRef.current
    if (!editor || !isSelectionInside(editor, selection.anchorNode)) {
      return
    }

    const removeSiblingToken = (direction: 'previous' | 'next') => {
      const anchorNode = selection.anchorNode
      const offset = selection.anchorOffset

      let sibling: ChildNode | null = null
      if (anchorNode?.nodeType === Node.TEXT_NODE) {
        if (
          (direction === 'previous' && offset !== 0) ||
          (direction === 'next' && offset !== (anchorNode.textContent?.length || 0))
        ) {
          return false
        }
        sibling = direction === 'previous' ? anchorNode.previousSibling : anchorNode.nextSibling
      } else if (anchorNode === editor) {
        sibling =
          direction === 'previous'
            ? editor.childNodes[offset - 1] || null
            : editor.childNodes[offset] || null
      }

      if (sibling instanceof HTMLElement && sibling.dataset.tokenId) {
        event.preventDefault()
        removeTokenById(sibling.dataset.tokenId)
        return true
      }

      return false
    }

    if (event.key === 'Backspace') {
      void removeSiblingToken('previous')
    } else if (event.key === 'Delete') {
      void removeSiblingToken('next')
    }
  }

  const handleSubmit = async () => {
    const promptContent = useRichInput ? normalizedPromptNodes : []
    const textContent = (useRichInput ? visibleText : value).trim()
    const hasContent = useRichInput ? hasTaskPromptContent(promptContent) : Boolean(textContent)
    const hasRequiredTitle = !requireTitle || (titleValue || '').trim().length > 0

    if (!hasContent && attachments.length === 0) {
      return
    }

    if (!hasRequiredTitle || disabled) {
      return
    }

    const messageAttachments = toMessageAttachments()
    const submittedNodes = useRichInput ? promptContent : undefined

    if (!useRichInput) {
      onValueChange?.('')
    }
    onPromptNodesChange?.([])
    resetAttachments()
    closeSlashMenu()

    await onSubmit({
      text: textContent,
      promptNodes: submittedNodes,
      attachments: messageAttachments
    })
  }

  const canSubmit =
    (useRichInput ? hasTaskPromptContent(normalizedPromptNodes) : Boolean(value.trim())) ||
    attachments.length > 0
  const inputBodyClassName =
    'text-foreground min-h-[160px] flex-1 border-0 bg-transparent px-0 py-1 text-sm focus:outline-none'

  return (
    <div className={cn('relative w-full', className)}>
      {slashEditorEnabled && slashOpen && (
        <div className="absolute inset-x-0 bottom-full z-30 mb-3">
          <div className="border-border bg-popover w-full overflow-hidden rounded-[28px] border shadow-xl">
            <div ref={slashMenuRef} className="max-h-72 overflow-auto p-2">
              {slashLoading ? (
                <div className="text-muted-foreground px-3 py-6 text-sm">{t.common.loading}</div>
              ) : filteredSlashItems.length === 0 ? (
                <div className="text-muted-foreground px-3 py-6 text-sm">
                  {t.task.createSlashEmpty || 'No matching skills or MCP servers.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {(['skills', 'mcp'] as const).map((group) => {
                    const groupItems = filteredSlashItems.filter((item) => item.group === group)
                    if (groupItems.length === 0) {
                      return null
                    }

                    return (
                      <div key={group}>
                        <div className="text-muted-foreground px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
                          {group === 'skills'
                            ? t.task.createSlashGroupSkills || 'Skills'
                            : t.task.createSlashGroupMcp || 'MCP'}
                        </div>
                        <div className="space-y-1">
                          {groupItems.map((item) => {
                            const globalIndex = filteredSlashItems.findIndex(
                              (candidate) => candidate.id === item.id
                            )
                            const selected = globalIndex === selectedSlashIndex

                            return (
                              <button
                                key={item.id}
                                type="button"
                                data-slash-selected={selected ? 'true' : undefined}
                                className={cn(
                                  'flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                                  selected
                                    ? 'bg-accent text-accent-foreground'
                                    : 'hover:bg-accent/60 text-foreground'
                                )}
                                onMouseDown={(event) => {
                                  event.preventDefault()
                                  insertSlashItem(item)
                                }}
                              >
                                <div className="bg-muted text-muted-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
                                  {item.tokenKind === 'skill' ? (
                                    <Sparkles className="size-3.5" />
                                  ) : (
                                    <Wrench className="size-3.5" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-medium">
                                      {item.name}
                                    </span>
                                    <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase">
                                      {item.source}
                                    </span>
                                  </div>
                                  {item.description && (
                                    <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                                      {item.description}
                                    </div>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={INPUT_ATTACHMENT_ACCEPT}
        onChange={handleFileChange}
        className="hidden"
      />

      <ComposerInputShell
        variant="home"
        disabled={disabled}
        attachments={attachments}
        onRemoveAttachment={removeAttachment}
        onOpenFilePicker={openFilePicker}
        titleInputRef={titleInputRef}
        titleValue={titleValue}
        onTitleChange={onTitleChange}
        titlePlaceholder={titlePlaceholder}
        onTitleEnter={() => {
          if (useRichInput) {
            editorRef.current?.focus()
          } else {
            textareaRef.current?.focus()
          }
        }}
        bodyWrapperClassName={useRichInput ? 'relative' : undefined}
        operationBar={operationBar}
        submitLeftBar={submitLeftBar}
        canSubmit={canSubmit && (!requireTitle || Boolean((titleValue || '').trim()))}
        onSubmit={() => {
          void handleSubmit()
        }}
      >
        {useRichInput ? (
          <div className="relative flex min-h-[160px] flex-1 flex-col">
            {normalizedPromptNodes.length === 0 && (
              <div
                className="text-muted-foreground pointer-events-none absolute top-1 left-0 text-sm"
                aria-hidden="true"
              >
                {placeholder}
              </div>
            )}
            <div
              ref={editorRef}
              contentEditable={!disabled}
              suppressContentEditableWarning
              onInput={handleEditorInput}
              onKeyDown={handleEditorKeyDown}
              onClick={handleEditorClick}
              onPaste={handlePaste}
              className={cn(
                inputBodyClassName,
                'w-full overflow-auto whitespace-pre-wrap break-words'
              )}
              data-testid="task-composer-rich-editor"
            />
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onValueChange?.(event.target.value)}
            onPaste={handlePaste}
            placeholder={placeholder}
            className={cn(
              inputBodyClassName,
              'placeholder:text-muted-foreground w-full resize-none overflow-auto'
            )}
            rows={1}
            disabled={disabled}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void handleSubmit()
              }
            }}
          />
        )}
      </ComposerInputShell>
    </div>
  )
}
