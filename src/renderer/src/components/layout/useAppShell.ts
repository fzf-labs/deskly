import { useEffect } from 'react'

import type { AppShellConfig } from './shell-config'
import { useSidebar } from './sidebar-context'

export function useAppShell(config: AppShellConfig) {
  const { setShellConfig, resetShellConfig } = useSidebar()

  useEffect(() => {
    setShellConfig(config)
  }, [config, setShellConfig])

  useEffect(() => {
    return () => {
      resetShellConfig()
    }
  }, [resetShellConfig])
}
