import { dialog } from '@/lib/electron-api'
import type { CreateProjectInput, Project } from '../hooks/useProjects'

interface CreateProjectFromDirectoryOptions {
  addProject: (input: CreateProjectInput) => Promise<Project>
  setCurrentProjectId: (id: string) => void
}

async function selectProjectDirectory(): Promise<string | null> {
  const result = await dialog.open({ directory: true })
  if (Array.isArray(result)) {
    return result[0] ?? null
  }
  return result
}

export async function createProjectFromDirectory({
  addProject,
  setCurrentProjectId
}: CreateProjectFromDirectoryOptions): Promise<Project | null> {
  const projectPath = await selectProjectDirectory()
  if (!projectPath) {
    return null
  }

  const project = await addProject({
    name: projectPath.split('/').pop() || 'Untitled',
    path: projectPath
  })
  setCurrentProjectId(project.id)
  return project
}
