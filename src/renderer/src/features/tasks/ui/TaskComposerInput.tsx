import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode
} from 'react'
import type { MessageAttachment } from '@features/cli-session'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/providers/language-provider'
import { ArrowUp, FileText, Paperclip, Plus, Sparkles, Wrench, X } from 'lucide-react'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { createTaskPromptTextNode, getTaskPromptVisibleText, hasTaskPromptContent, normalizeTaskPromptNodes, type TaskPromptNode, type TaskPromptSlashItem } from '../model/task-prompt'
import { scrollSelectedSlashItemIntoView } from './task-composer-input-utils'

interface Attachment {
  id: string
  file: File
  type: 'image' | 'file'
  preview?: string
}

interface TaskComposerInputSubmitPayload {
  text: string
  promptNodes: TaskPromptNode[]
  attachments?: MessageAttachment[]
}

interface TaskComposerInputProps {
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

const generateId = () => `attachment_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
const generatePromptTokenInstanceId = (baseId: string) =>
  `${baseId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const isImageFile = (file: File) => {
  if (file.type.startsWith('image/')) {
    return true
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext || '')
}

const createImagePreview = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      if (result) {
        resolve(result)
      } else {
        reject(new Error('Failed to read file'))
      }
    }
    reader.onerror = () => reject(new Error('FileReader error'))
    reader.readAsDataURL(file)
  })

const serializePromptNodes = (nodes: TaskPromptNode[]) => JSON.stringify(normalizeTaskPromptNodes(nodes))

const createTokenElement = (documentRef: Document, node: Extract<TaskPromptNode, { type: 'token' }>) => {
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
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [slashQuery, setSlashQuery] = useState('')
  const [slashOpen, setSlashOpen] = useState(false)
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const slashMenuRef = useRef<HTMLDivElement>(null)
  const slashRangeRef = useRef<Range | null>(null)
  const lastAppliedNodesRef = useRef<string>('')

  const normalizedPromptNodes = useMemo(() => normalizeTaskPromptNodes(promptNodes), [promptNodes])
  const visibleText = useMemo(
    () => (slashEnabled ? getTaskPromptVisibleText(normalizedPromptNodes) : value),
    [normalizedPromptNodes, slashEnabled, value]
  )

  const filteredSlashItems = useMemo(() => {
    const normalizedQuery = slashQuery.trim().toLowerCase()
    const items = normalizedQuery
      ? slashItems.filter((item) => item.searchText.includes(normalizedQuery))
      : slashItems

    return items
  }, [slashItems, slashQuery])

  useEffect(() => {
    if (!slashEnabled) {
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
  }, [normalizedPromptNodes, slashEnabled])

  useEffect(() => {
    if (!autoFocus) {
      return
    }

    if (typeof onTitleChange === 'function' && titleInputRef.current) {
      titleInputRef.current.focus()
      return
    }

    if (slashEnabled) {
      editorRef.current?.focus()
      return
    }

    textareaRef.current?.focus()
  }, [autoFocus, onTitleChange, slashEnabled])

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

  const addFiles = useCallback(async (files: FileList | File[], forceImage = false) => {
    const nextAttachments: Attachment[] = []

    for (const file of Array.from(files)) {
      const isImage = forceImage || isImageFile(file)
      const attachment: Attachment = {
        id: generateId(),
        file,
        type: isImage ? 'image' : 'file'
      }

      if (isImage) {
        try {
          attachment.preview = await createImagePreview(file)
        } catch (error) {
          console.error('[TaskComposerInput] Failed to create image preview:', error)
        }
      }

      nextAttachments.push(attachment)
    }

    setAttachments((previous) => [...previous, ...nextAttachments])
  }, [])

  const removeAttachment = useCallback((id: string) => {
    setAttachments((previous) => previous.filter((attachment) => attachment.id !== id))
  }, [])

  const convertAttachments = (): MessageAttachment[] | undefined => {
    if (attachments.length === 0) {
      return undefined
    }

    const result = attachments
      .filter((attachment) => {
        if (attachment.type !== 'image') {
          return true
        }
        return Boolean(attachment.preview)
      })
      .map((attachment) => ({
        id: attachment.id,
        type: attachment.type,
        name: attachment.file.name,
        data: attachment.preview || '',
        mimeType: attachment.file.type || (attachment.type === 'image' ? 'image/png' : '')
      }))

    return result.length > 0 ? result : undefined
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      void addFiles(event.target.files)
      event.target.value = ''
    }
  }

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      const imageFiles: File[] = []
      for (let index = 0; index < event.clipboardData.items.length; index += 1) {
        const item = event.clipboardData.items[index]
        if (!item.type.startsWith('image/')) {
          continue
        }
        const file = item.getAsFile()
        if (file) {
          imageFiles.push(file)
        }
      }

      if (imageFiles.length > 0) {
        event.preventDefault()
        await addFiles(imageFiles, true)
      }
    },
    [addFiles]
  )

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
    if (!slashEnabled) {
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
  }, [closeSlashMenu, slashEnabled])

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
        if ((direction === 'previous' && offset !== 0) || (direction === 'next' && offset !== (anchorNode.textContent?.length || 0))) {
          return false
        }
        sibling =
          direction === 'previous' ? anchorNode.previousSibling : anchorNode.nextSibling
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
    const promptContent = slashEnabled ? normalizedPromptNodes : [createTaskPromptTextNode(value)]
    const textContent = slashEnabled ? visibleText.trim() : value.trim()
    const hasContent = slashEnabled ? hasTaskPromptContent(promptContent) : Boolean(textContent)
    const hasRequiredTitle = !requireTitle || (titleValue || '').trim().length > 0

    if (!hasContent && attachments.length === 0) {
      return
    }

    if (!hasRequiredTitle || disabled) {
      return
    }

    const messageAttachments = convertAttachments()
    const submittedNodes = slashEnabled ? normalizedPromptNodes : [createTaskPromptTextNode(textContent)]

    if (!slashEnabled) {
      onValueChange?.('')
    }
    onPromptNodesChange?.([])
    setAttachments([])
    closeSlashMenu()

    await onSubmit({
      text: textContent,
      promptNodes: submittedNodes,
      attachments: messageAttachments
    })
  }

  const canSubmit =
    (slashEnabled ? hasTaskPromptContent(normalizedPromptNodes) : Boolean(value.trim())) ||
    attachments.length > 0

  return (
    <div className={cn('relative w-full', className)}>
      {slashEnabled && slashOpen && (
        <div className="absolute inset-x-0 bottom-full z-30 mb-3">
          <div className="border-border bg-popover w-full overflow-hidden rounded-[28px] border shadow-xl">
            <div ref={slashMenuRef} className="max-h-72 overflow-auto p-2">
              {slashLoading ? (
                <div className="text-muted-foreground px-3 py-6 text-sm">
                  {t.common.loading}
                </div>
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

      <div className="border-border/60 bg-background/96 w-full rounded-[28px] border p-4 shadow-[0_24px_60px_rgba(15,23,42,0.10)] backdrop-blur">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt,.md,.json,.csv,.xlsx,.xls,.pptx,.ppt"
          onChange={handleFileChange}
          className="hidden"
        />

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
                  onClick={() => removeAttachment(attachment.id)}
                  className="bg-primary text-primary-foreground absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {typeof onTitleChange === 'function' && (
          <>
            <div className="mb-2">
              <input
                ref={titleInputRef}
                value={titleValue || ''}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder={titlePlaceholder}
                className="text-foreground placeholder:text-muted-foreground w-full border-0 bg-transparent px-0 py-1 text-base font-medium focus:outline-none"
                disabled={disabled}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    if (slashEnabled) {
                      editorRef.current?.focus()
                    } else {
                      textareaRef.current?.focus()
                    }
                  }
                }}
              />
            </div>
            <div className="bg-border/70 mb-3 h-px w-full" />
          </>
        )}

        <div className="relative">
          {slashEnabled ? (
            <>
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
                contentEditable
                suppressContentEditableWarning
                onInput={handleEditorInput}
                onKeyDown={handleEditorKeyDown}
                onClick={handleEditorClick}
                onPaste={handlePaste}
                className="text-foreground min-h-[160px] w-full overflow-auto whitespace-pre-wrap break-words border-0 bg-transparent px-0 py-1 text-sm focus:outline-none"
                style={{ maxHeight: '320px' }}
                data-testid="task-composer-rich-editor"
              />
            </>
          ) : (
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => onValueChange?.(event.target.value)}
              onPaste={handlePaste}
              placeholder={placeholder}
              className="text-foreground placeholder:text-muted-foreground min-h-[160px] w-full resize-none overflow-auto border-0 bg-transparent px-0 py-1 text-sm focus:outline-none"
              style={{ maxHeight: '320px' }}
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
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                disabled={disabled}
                className="border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8} className="z-50 w-56">
                <DropdownMenuItem
                  onSelect={() => fileInputRef.current?.click()}
                  className="cursor-pointer gap-3 py-2.5"
                >
                  <Paperclip className="size-4" />
                  <span>{t.home.addFilesOrPhotos}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {operationBar && <div className="ml-1 min-w-0 flex-1">{operationBar}</div>}
          </div>

          <div className="flex items-center gap-1">
            {submitLeftBar}
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={disabled || !canSubmit || (requireTitle && !(titleValue || '').trim())}
              className={cn(
                'flex size-8 items-center justify-center rounded-full transition-all',
                !disabled && canSubmit && (!requireTitle || Boolean((titleValue || '').trim()))
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
