import { EventEmitter } from 'events'
import { MsgStoreService } from '../MsgStoreService'

export type CliSessionStatus = 'running' | 'stopped' | 'error'

export interface CliSessionClosePayload {
  sessionId: string
  code: number | null
  forcedStatus?: CliSessionStatus
}

export interface CliSessionErrorPayload {
  sessionId: string
  error: string | Error
}

export interface CliStartOptions {
  sessionId: string
  toolId: string
  workdir: string
  taskId?: string
  taskNodeId?: string
  projectId?: string | null
  prompt?: string
  env?: NodeJS.ProcessEnv
  executablePath?: string
  toolConfig?: Record<string, unknown>
  model?: string
  onResumeIdCaptured?: (resumeId: string) => void | Promise<void>
  msgStore?: MsgStoreService
}

export interface CliCompletionSignal {
  status: 'success' | 'failure'
  reason?: string
}

export interface CliSessionHandle extends EventEmitter {
  sessionId: string
  toolId: string
  status: CliSessionStatus
  msgStore: MsgStoreService
  lastClosePayload?: CliSessionClosePayload | null
  lastErrorPayload?: CliSessionErrorPayload | null
  stop: () => void
  sendInput?: (input: string) => void
}

export interface CliAdapter {
  id: string
  startSession: (options: CliStartOptions) => Promise<CliSessionHandle>
}
