import { useState, type ComponentProps } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { db, type OptimizePromptInput, type OptimizePromptResult } from '@/data'
import { getEnabledDefaultCliToolId, getSettings } from '@/data/settings'
import { resolvePromptOptimizationErrorMessage } from '@/lib/prompt-optimization'
import { useLanguage } from '@/providers/language-provider'

interface PromptOptimizeButtonProps
  extends Pick<
    OptimizePromptInput,
    'contextType' | 'name' | 'toolId' | 'agentToolConfigId'
  > {
  prompt: string
  disabled?: boolean
  className?: string
  variant?: ComponentProps<typeof Button>['variant']
  size?: ComponentProps<typeof Button>['size']
  onApply: (optimizedPrompt: string, result: OptimizePromptResult) => void
  onError?: (message: string) => void
}

export function PromptOptimizeButton({
  prompt,
  contextType,
  name,
  toolId,
  agentToolConfigId,
  disabled = false,
  className,
  variant = 'outline',
  size = 'icon-sm',
  onApply,
  onError
}: PromptOptimizeButtonProps) {
  const { t } = useLanguage()
  const [isOptimizing, setIsOptimizing] = useState(false)
  const hasPrompt = prompt.trim().length > 0

  const reportError = (message: string) => {
    if (onError) {
      onError(message)
      return
    }

    window.alert(message)
  }

  const handleOptimize = async () => {
    const sourcePrompt = prompt.trim()
    if (!sourcePrompt) {
      reportError(t.task.promptOptimizePromptRequired || 'Please enter a prompt to optimize first.')
      return
    }

    const resolvedToolId = toolId || getEnabledDefaultCliToolId(getSettings()) || null

    setIsOptimizing(true)

    try {
      const result = await db.optimizePrompt({
        prompt: sourcePrompt,
        contextType,
        name,
        toolId: resolvedToolId,
        agentToolConfigId
      })

      onApply(result.optimizedPrompt, result)
    } catch (error) {
      reportError(resolvePromptOptimizationErrorMessage(error, t.task as Record<string, string>))
    } finally {
      setIsOptimizing(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled || isOptimizing || !hasPrompt}
      onClick={() => void handleOptimize()}
      className={className}
      title={
        isOptimizing
          ? t.task.promptOptimizeLoading || 'Optimizing...'
          : t.task.promptOptimizeButton || 'Optimize prompt'
      }
      aria-label={
        isOptimizing
          ? t.task.promptOptimizeLoading || 'Optimizing...'
          : t.task.promptOptimizeButton || 'Optimize prompt'
      }
    >
      {isOptimizing ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Sparkles className="size-3.5" />
      )}
    </Button>
  )
}
