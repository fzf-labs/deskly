import { FileText } from 'lucide-react'

import { LazyImage } from '@/components/shared/LazyImage'
import type { MessageAttachment } from '@features/cli-session'

interface UserMessageProps {
  content: string
  attachments?: MessageAttachment[]
}

export function UserMessage({ content, attachments }: UserMessageProps) {
  if (attachments && attachments.length > 0) {
    console.log('[UserMessage] Rendering attachments:', attachments.length)
    attachments.forEach((attachment, index) => {
      console.log(
        `[UserMessage] Attachment ${index}: type=${attachment.type}, name=${attachment.name}, hasData=${!!attachment.data}, dataLength=${attachment.data?.length || 0}`
      )
    })
  }

  return (
    <div className="flex min-w-0 gap-3">
      <div className="min-w-0 flex-1" />
      <div className="bg-accent/50 max-w-[85%] min-w-0 rounded-xl px-4 py-3">
        {attachments && attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((attachment) =>
              attachment.type === 'image' ? (
                <LazyImage
                  key={attachment.id}
                  src={attachment.data}
                  alt={attachment.name}
                  className="max-h-48 max-w-full"
                  isDataLoading={attachment.isLoading}
                />
              ) : (
                <div
                  key={attachment.id}
                  className="bg-muted flex items-center gap-2 rounded-lg px-3 py-2"
                >
                  <FileText className="text-muted-foreground size-4" />
                  <span className="text-foreground text-sm">{attachment.name}</span>
                </div>
              )
            )}
          </div>
        )}
        {content && (
          <p className="text-foreground text-sm break-words whitespace-pre-wrap">{content}</p>
        )}
      </div>
    </div>
  )
}
