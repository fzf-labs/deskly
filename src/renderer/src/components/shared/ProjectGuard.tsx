import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { isProjectRequiredRoute, useProjects } from '@features/projects'
import { PROJECT_SETTINGS_ROUTE } from '@features/settings'

interface ProjectGuardProps {
  children: ReactNode
}

export function ProjectGuard({ children }: ProjectGuardProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { projects, loading } = useProjects()
  const isProjectSettingsRoute =
    location.pathname === '/settings' &&
    new URLSearchParams(location.search).get('tab') === 'projects'
  const shouldRedirect =
    projects.length === 0 &&
    !isProjectSettingsRoute &&
    isProjectRequiredRoute(location.pathname, location.search)

  useEffect(() => {
    if (loading) return
    if (shouldRedirect) {
      navigate(PROJECT_SETTINGS_ROUTE, { replace: true })
    }
  }, [loading, navigate, shouldRedirect])

  if (loading) {
    return null
  }

  if (shouldRedirect) {
    return null
  }

  return <>{children}</>
}
