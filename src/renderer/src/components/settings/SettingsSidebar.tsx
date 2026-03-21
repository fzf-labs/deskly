import { ArrowLeft } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useLanguage } from '@/providers/language-provider'

import {
  APP_SHELL_SIDEBAR_DIVIDER_CLASS,
  APP_SHELL_SIDEBAR_FOOTER_CLASS,
  APP_SHELL_SIDEBAR_SECTION_BODY_CLASS,
  APP_SHELL_SIDEBAR_TOP_OFFSET_CLASS
} from '@/components/layout/sidebar-rhythm'

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
      <div className={APP_SHELL_SIDEBAR_TOP_OFFSET_CLASS} />

      <div className={APP_SHELL_SIDEBAR_DIVIDER_CLASS}>
        <div className="border-sidebar-border/70 border-t" />
      </div>

      <nav className={cn('flex-1 space-y-1 overflow-y-auto', APP_SHELL_SIDEBAR_SECTION_BODY_CLASS)}>
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
        <div className={APP_SHELL_SIDEBAR_FOOTER_CLASS}>
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
