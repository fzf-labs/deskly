import { useEffect, useState } from 'react'
import { ArrowUpRight, Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { shell } from '@/lib/electron-api'
import { getLocalizedSystemCliText } from '@/lib/system-cli-tools'
import { useLanguage } from '@/providers/language-provider'
import {
  resolveSystemCliInstallMethods,
  type SystemCliToolInfo
} from '../../../../../shared/system-cli-tools'

interface SystemCliToolDetailDialogProps {
  open: boolean
  tool: SystemCliToolInfo | null
  onOpenChange: (open: boolean) => void
}

const openExternalUrl = async (url: string) => {
  try {
    await shell.openUrl(url)
  } catch {
    window.open(url, '_blank')
  }
}

export function SystemCliToolDetailDialog({
  open,
  tool,
  onOpenChange
}: SystemCliToolDetailDialogProps) {
  const { language, t } = useLanguage()
  const [copiedValue, setCopiedValue] = useState<string | null>(null)

  useEffect(() => {
    if (!copiedValue) return undefined

    const timer = window.setTimeout(() => setCopiedValue(null), 1200)
    return () => window.clearTimeout(timer)
  }, [copiedValue])

  if (!tool) {
    return null
  }

  const installMethods = resolveSystemCliInstallMethods(tool.installMethods, tool.platform)
  const homepageUrl = tool.homepageUrl

  const getCategoryLabel = (): string => {
    switch (tool.category) {
      case 'media':
        return t.settings.cliToolsCategoryMedia
      case 'data':
        return t.settings.cliToolsCategoryData
      case 'search':
        return t.settings.cliToolsCategorySearch
      case 'download':
        return t.settings.cliToolsCategoryDownload
      case 'document':
        return t.settings.cliToolsCategoryDocument
      default:
        return tool.category
    }
  }

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedValue(value)
    } catch {
      setCopiedValue(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{tool.displayName}</span>
            <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] uppercase">
              {getCategoryLabel()}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-2">
            <h3 className="text-sm font-medium">{t.settings.cliToolsDetailIntro}</h3>
            <p className="text-muted-foreground text-sm">
              {getLocalizedSystemCliText(tool.detailIntro, language)}
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">{t.settings.cliToolsToolInfo}</h3>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="border-border bg-muted/20 rounded-lg border px-3 py-2">
                <div className="text-muted-foreground text-xs">{t.settings.cliToolsVersion}</div>
                <div className="mt-1 font-mono text-sm">{tool.version || '—'}</div>
              </div>
              <div className="border-border bg-muted/20 rounded-lg border px-3 py-2">
                <div className="text-muted-foreground text-xs">{t.settings.cliToolsPath}</div>
                <div className="mt-1 break-all font-mono text-sm">{tool.installPath || '—'}</div>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">{t.settings.cliToolsUseCases}</h3>
            <ul className="text-muted-foreground space-y-1 text-sm">
              {tool.useCases.map((item) => (
                <li key={`${tool.id}-${item.en}`}>• {getLocalizedSystemCliText(item, language)}</li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">{t.settings.cliToolsGuideSteps}</h3>
            <ol className="text-muted-foreground space-y-1 text-sm">
              {tool.guideSteps.map((item, index) => (
                <li key={`${tool.id}-guide-${item.en}`} className="flex gap-2">
                  <span className="text-foreground w-5 shrink-0">{index + 1}.</span>
                  <span>{getLocalizedSystemCliText(item, language)}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">{t.settings.cliToolsExamplePrompts}</h3>
            <div className="space-y-2">
              {tool.examplePrompts.map((item) => {
                const prompt = getLocalizedSystemCliText(item.prompt, language)
                const isCopied = copiedValue === prompt

                return (
                  <div
                    key={`${tool.id}-${item.label.en}`}
                    className="border-border bg-muted/20 rounded-lg border p-3"
                  >
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <div className="text-sm font-medium">
                        {getLocalizedSystemCliText(item.label, language)}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => void copyText(prompt)}
                      >
                        {isCopied ? (
                          <Check className="mr-1 size-3.5" />
                        ) : (
                          <Copy className="mr-1 size-3.5" />
                        )}
                        {isCopied ? t.settings.cliToolsCopied : t.settings.cliToolsCopy}
                      </Button>
                    </div>
                    <p className="text-muted-foreground text-sm">{prompt}</p>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">{t.settings.cliToolsInstallCommand}</h3>
            <div className="space-y-2">
              {installMethods.map((method) => {
                const isCopied = copiedValue === method.command

                return (
                  <div
                    key={`${tool.id}-${method.label}`}
                    className="border-border bg-background rounded-lg border px-3 py-2"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="text-muted-foreground text-[11px] uppercase">
                        {method.label}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => void copyText(method.command)}
                      >
                        {isCopied ? (
                          <Check className="mr-1 size-3.5" />
                        ) : (
                          <Copy className="mr-1 size-3.5" />
                        )}
                        {isCopied ? t.settings.cliToolsCopied : t.settings.cliToolsCopy}
                      </Button>
                    </div>
                    <code className="text-foreground block break-all font-mono text-xs">
                      {method.command}
                    </code>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="flex flex-wrap gap-2 border-t pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void openExternalUrl(tool.docsUrl)}
            >
              <ArrowUpRight className="mr-1 size-3.5" />
              {t.settings.cliToolsDocs}
            </Button>
            {homepageUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void openExternalUrl(homepageUrl)}
              >
                <ArrowUpRight className="mr-1 size-3.5" />
                {t.settings.cliToolsHomepage}
              </Button>
            ) : null}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
