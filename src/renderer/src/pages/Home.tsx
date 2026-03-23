import { useNavigate } from 'react-router-dom'
import type { MessageAttachment } from '@/hooks/useAgent'
import { useLanguage } from '@/providers/language-provider'
import { getEnabledDefaultCliToolId, getSettings } from '@/data/settings'

import { ChatInput } from '@/components/shared/ChatInput'

export function HomePage() {
  const { t } = useLanguage()
  const navigate = useNavigate()

  const handleSubmit = async (text: string, attachments?: MessageAttachment[]) => {
    if (!text.trim() && (!attachments || attachments.length === 0)) return

    const prompt = text.trim()
    try {
      const settings = getSettings()
      const defaultCliToolId = getEnabledDefaultCliToolId(settings)
      if (!defaultCliToolId) {
        window.alert(
          t.settings?.cliDefaultRequired ||
            'Please enable and choose a default CLI in Settings -> Agent CLI'
        )
        return
      }
      const createdTask = await window.api.task.create({
        title: prompt,
        prompt,
        taskMode: 'conversation',
        cliToolId: defaultCliToolId
      })
      navigate(`/task/${createdTask.id}`, {
        state: { prompt, attachments }
      })
    } catch (error) {
      console.error('[Home] Failed to create task:', error)
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-auto px-4">
      <div className="flex w-full max-w-2xl flex-col items-center gap-6">
        <h1 className="text-foreground text-center text-4xl font-semibold tracking-tight md:text-5xl">
          {t.home.welcomeTitle}
        </h1>
        <ChatInput
          variant="home"
          placeholder={t.home.inputPlaceholder}
          onSubmit={handleSubmit}
          className="w-full"
          autoFocus
        />
      </div>
    </div>
  )
}
