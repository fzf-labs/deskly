import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  SettingsContent,
  SettingsSidebar,
  type SettingsCategory
} from '@/components/settings'
import { useAppShell } from '@/components/layout'

function canNavigateBack() {
  if (typeof window === 'undefined') return false

  const state = window.history.state as { idx?: number } | null
  return typeof state?.idx === 'number' ? state.idx > 0 : window.history.length > 1
}

export function SettingsPage() {
  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('account')

  const handleBack = useCallback(() => {
    if (canNavigateBack()) {
      navigate(-1)
      return
    }

    navigate('/tasks', { replace: true })
  }, [navigate])

  const shellConfig = useMemo(
    () => ({
      left: {
        content: (
          <SettingsSidebar
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            onBack={handleBack}
          />
        ),
        visible: true,
        variant: 'settings' as const
      },
      right: {
        visible: false
      }
    }),
    [activeCategory, handleBack]
  )

  useAppShell(shellConfig)

  return <SettingsContent className="h-full" activeCategory={activeCategory} />
}
