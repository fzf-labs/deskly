import { Navigate } from 'react-router-dom'

import { PROJECT_SETTINGS_ROUTE } from '@features/settings'

export function ProjectsPage() {
  return <Navigate to={PROJECT_SETTINGS_ROUTE} replace />
}
