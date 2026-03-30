import { useCallback, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react'
import type { MessageAttachment } from '@features/cli-session'

export interface InputAttachment {
  id: string
  file: File
  type: 'image' | 'file'
  preview?: string
}

interface UseInputAttachmentsOptions {
  logLabel: string
}

export const INPUT_ATTACHMENT_ACCEPT =
  'image/*,.pdf,.doc,.docx,.txt,.md,.json,.csv,.xlsx,.xls,.pptx,.ppt'

const generateAttachmentId = () =>
  `attachment_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

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

export function useInputAttachments({ logLabel }: UseInputAttachmentsOptions) {
  const [attachments, setAttachments] = useState<InputAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback(
    async (files: FileList | File[], forceImage = false) => {
      const nextAttachments: InputAttachment[] = []

      for (const file of Array.from(files)) {
        const attachment: InputAttachment = {
          id: generateAttachmentId(),
          file,
          type: forceImage || isImageFile(file) ? 'image' : 'file'
        }

        if (attachment.type === 'image') {
          try {
            attachment.preview = await createImagePreview(file)
          } catch (error) {
            console.error(`[${logLabel}] Failed to create image preview:`, error)
          }
        }

        nextAttachments.push(attachment)
      }

      setAttachments((previous) => [...previous, ...nextAttachments])
    },
    [logLabel]
  )

  const removeAttachment = useCallback((id: string) => {
    setAttachments((previous) => previous.filter((attachment) => attachment.id !== id))
  }, [])

  const resetAttachments = useCallback(() => {
    setAttachments([])
  }, [])

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files.length > 0) {
        void addFiles(event.target.files)
        event.target.value = ''
      }
    },
    [addFiles]
  )

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

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const toMessageAttachments = useCallback((): MessageAttachment[] | undefined => {
    if (attachments.length === 0) {
      return undefined
    }

    const nextAttachments = attachments
      .filter((attachment) => {
        if (attachment.type !== 'image') {
          return true
        }

        const hasPreview = Boolean(attachment.preview)
        if (!hasPreview) {
          console.warn(`[${logLabel}] Skipping image ${attachment.file.name}: no preview data`)
        }
        return hasPreview
      })
      .map((attachment) => ({
        id: attachment.id,
        type: attachment.type,
        name: attachment.file.name,
        data: attachment.preview || '',
        mimeType: attachment.file.type || (attachment.type === 'image' ? 'image/png' : '')
      }))

    return nextAttachments.length > 0 ? nextAttachments : undefined
  }, [attachments, logLabel])

  return {
    attachments,
    fileInputRef,
    handleFileChange,
    handlePaste,
    openFilePicker,
    removeAttachment,
    resetAttachments,
    toMessageAttachments
  }
}
