import { useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import {
  isSettingsCategory,
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
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedCategory = searchParams.get('tab')
  const activeCategory: SettingsCategory = isSettingsCategory(requestedCategory)
    ? requestedCategory
    : 'account'

  const handleSelectCategory = useCallback(
    (category: SettingsCategory) => {
      const nextSearchParams = new URLSearchParams(searchParams)

      if (category === 'account') {
        nextSearchParams.delete('tab')
      } else {
        nextSearchParams.set('tab', category)
      }

      setSearchParams(nextSearchParams, { replace: true })
    },
    [searchParams, setSearchParams]
  )

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
            onSelectCategory={handleSelectCategory}
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
    [activeCategory, handleBack, handleSelectCategory]
  )

  useAppShell(shellConfig)

  return <SettingsContent className="h-full" activeCategory={activeCategory} />
}
