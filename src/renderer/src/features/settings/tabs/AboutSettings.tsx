import { useEffect, useState } from 'react'

import { app } from '@/lib/electron-api'
import { useLanguage } from '@/providers/language-provider'

export function AboutSettings() {
  const { t } = useLanguage()
  const [version, setVersion] = useState('0.0.0')

  useEffect(() => {
    app
      .getVersion()
      .then(setVersion)
      .catch(() => setVersion('0.0.0'))
  }, [])

  return (
    <div className="space-y-4">
      <div className="border-border bg-muted/20 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-foreground text-lg font-semibold">Deskly</h2>
          <p className="text-muted-foreground text-sm">{t.settings.aiPlatform}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <div className="border-border bg-muted/60 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
            <span className="tracking-wider uppercase">{t.settings.version}</span>
            <span className="text-foreground font-semibold">{version}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
