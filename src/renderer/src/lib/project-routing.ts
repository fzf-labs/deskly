export const PROJECT_REQUIRED_ROUTE_PREFIXES = [
  '/dashboard',
  '/board',
  '/automations',
  '/pipeline-templates',
  '/skills',
  '/mcp'
] as const

export function isProjectRequiredRoute(pathname: string, search = ''): boolean {
  if (pathname === '/pipeline-templates/editor') {
    const searchParams = new URLSearchParams(search)
    return searchParams.get('scope') !== 'global'
  }

  return PROJECT_REQUIRED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export function normalizeCurrentProjectId<T extends { id: string }>(
  currentProjectId: string | null,
  projects: T[]
): string | null {
  if (!currentProjectId) {
    return null
  }

  return projects.some((project) => project.id === currentProjectId) ? currentProjectId : null
}
