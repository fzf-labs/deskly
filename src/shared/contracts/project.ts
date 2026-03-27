export type ProjectType = 'normal' | 'git'

export interface DbProject {
  id: string
  name: string
  path: string
  description: string | null
  project_type: ProjectType
  created_at: string
  updated_at: string
}

export interface CreateProjectInput {
  name: string
  path: string
  description?: string
  project_type?: ProjectType
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  project_type?: ProjectType
}

export interface Project {
  id: string
  name: string
  path: string
  description?: string
  projectType: ProjectType
  createdAt: string
  updatedAt: string
}

export interface CreateProjectOptions {
  name: string
  path: string
  description?: string
  projectType?: ProjectType
}

export interface CheckProjectPathResult {
  exists: boolean
  projectType?: ProjectType
  updated: boolean
}
