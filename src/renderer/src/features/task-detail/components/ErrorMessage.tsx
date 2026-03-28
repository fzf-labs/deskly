import { useLanguage } from '@/providers/language-provider'

interface ErrorMessageProps {
  message: string
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  const { t } = useLanguage()

  if (message === '__CLAUDE_CODE_NOT_FOUND__') {
    return (
      <div className="flex items-start gap-3 py-2">
        <WarningIcon className="text-amber-500" />
        <p className="text-muted-foreground text-sm">{t.common.errors.claudeCodeNotFound}</p>
      </div>
    )
  }

  if (message === '__API_KEY_ERROR__') {
    return (
      <div className="flex items-start gap-3 py-2">
        <WarningIcon className="text-amber-500" />
        <p className="text-muted-foreground text-sm">{t.common.errors.apiKeyError}</p>
      </div>
    )
  }

  const isInternalError = message.startsWith('__INTERNAL_ERROR__|')
  if (isInternalError) {
    const logPath = message.split('|')[1] || '~/.deskly/logs/Deskly.log'
    const errorMessage = (
      t.common.errors.internalError || 'Internal server error. Please check log file: {logPath}'
    ).replace('{logPath}', logPath)

    return (
      <div className="flex items-start gap-3 py-2">
        <WarningIcon className="text-destructive" />
        <p className="text-muted-foreground text-sm">{errorMessage}</p>
      </div>
    )
  }

  const isApiKeyError =
    /invalid api key|api key|authentication|unauthorized|please run \/login/i.test(message)

  if (isApiKeyError) {
    return (
      <div className="flex items-start gap-3 py-2">
        <WarningIcon className="text-amber-500" />
        <p className="text-muted-foreground text-sm">{t.common.errors.apiKeyError}</p>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 py-2">
      <WarningIcon className="text-destructive" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  )
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
      <svg viewBox="0 0 16 16" className={`size-4 ${className}`} fill="currentColor">
        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 4.5a1 1 0 112 0v3a1 1 0 11-2 0v-3zm1 7a1 1 0 100-2 1 1 0 000 2z" />
      </svg>
    </div>
  )
}
