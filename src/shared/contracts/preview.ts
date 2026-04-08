export type PreviewConfigType = 'frontend' | 'backend'
export type PreviewConfigOwnership = 'manual' | 'ai-managed'
export type PreviewLaunchCapability = 'inline-web' | 'config-only'

export interface PreviewConfig {
  id: string
  name: string
  projectId: string
  type: PreviewConfigType
  ownership: PreviewConfigOwnership
  launchCapability: PreviewLaunchCapability
  detectionKey?: string | null
  detectionSignature?: string | null
  detectionSource?: string | null
  command: string
  args: string[]
  cwd?: string | null
  port?: number | null
  env?: Record<string, string>
  autoStart?: boolean
  lastUsedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreatePreviewConfigInput {
  name: string
  projectId: string
  type?: PreviewConfigType
  ownership?: PreviewConfigOwnership
  launchCapability?: PreviewLaunchCapability
  detectionKey?: string | null
  detectionSignature?: string | null
  detectionSource?: string | null
  command: string
  args?: string[]
  cwd?: string | null
  port?: number | null
  env?: Record<string, string>
  autoStart?: boolean
  lastUsedAt?: string | null
}

export interface UpdatePreviewConfigInput {
  name?: string
  type?: PreviewConfigType
  ownership?: PreviewConfigOwnership
  launchCapability?: PreviewLaunchCapability
  detectionKey?: string | null
  detectionSignature?: string | null
  detectionSource?: string | null
  command?: string
  args?: string[]
  cwd?: string | null
  port?: number | null
  env?: Record<string, string>
  autoStart?: boolean
  lastUsedAt?: string | null
}

export type PreviewInstanceStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error'

export interface PreviewInstance {
  id: string
  configId: string
  status: PreviewInstanceStatus
  pid?: number
  port?: number | null
  startedAt?: string
  error?: string | null
}

export interface PreviewConfigSyncChange {
  id: string | null
  name: string
  ownership: PreviewConfigOwnership
  launchCapability: PreviewLaunchCapability
  detectionKey?: string | null
  reason: string
}

export interface PreviewConfigSyncResult {
  workspacePath: string
  configs: PreviewConfig[]
  added: PreviewConfigSyncChange[]
  updated: PreviewConfigSyncChange[]
  deleted: PreviewConfigSyncChange[]
  skipped: PreviewConfigSyncChange[]
}
