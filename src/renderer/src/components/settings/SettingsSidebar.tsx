import { ArrowLeft } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useLanguage } from '@/providers/language-provider'

import { categoryIcons, settingsCategories } from './constants'
import type { SettingsCategory } from './types'

interface SettingsSidebarProps {
  activeCategory: SettingsCategory
  onSelectCategory: (category: SettingsCategory) => void
  onBack?: () => void
}

export function SettingsSidebar({
  activeCategory,
  onSelectCategory,
  onBack
}: SettingsSidebarProps) {
  const { t } = useLanguage()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="h-12 shrink-0" />

      <div className="px-4 pb-4 pt-5">
        <div className="text-sidebar-foreground text-lg font-semibold tracking-tight">
          {t.settings.title}
        </div>
        <p className="text-sidebar-foreground/58 mt-1 text-sm leading-6">
          {t.settings.pageDescription}
        </p>
      </div>

      <div className="px-3 pb-2">
        <div className="border-sidebar-border/70 border-t" />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {settingsCategories.map((id) => {
          const Icon = categoryIcons[id]

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectCategory(id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors',
                activeCategory === id
                  ? 'bg-sidebar-accent/80 text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground/72 hover:bg-sidebar-accent/72 hover:text-sidebar-foreground'
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{t.settings[id]}</span>
            </button>
          )
        })}
      </nav>

      {onBack ? (
        <div className="border-sidebar-border/70 border-t px-3 py-3">
          <button
            type="button"
            onClick={onBack}
            className="text-sidebar-foreground/72 hover:bg-sidebar-accent/72 hover:text-sidebar-foreground flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors"
          >
            <ArrowLeft className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{t.settings.back}</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
