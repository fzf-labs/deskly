export type CliSessionStatus = 'idle' | 'running' | 'stopped' | 'error'

export interface OutputSnapshot {
  output: string[]
  truncated: boolean
  byteLength: number
  entryCount: number
}

export interface CliSessionStartOptions {
  model?: string
  prompt?: string
  projectId?: string | null
  taskId?: string
  taskNodeId?: string
  configId?: string | null
}

export interface CliSessionInfo {
  id: string
  status: CliSessionStatus
  workdir: string
  toolId: string
  startTime: Date
  taskId?: string
  taskNodeId?: string
}

export interface CliSessionStatusEvent {
  sessionId: string
  status: CliSessionStatus
  forced?: boolean
}

export interface CliSessionOutputEvent {
  sessionId: string
  type: string
  content: string
}

export interface CliSessionCloseEvent {
  sessionId: string
  code: number
  forcedStatus?: CliSessionStatus
}

export interface CliSessionErrorEvent {
  sessionId: string
  error: string
}

export interface LogStreamSubscriptionResult {
  success: boolean
  error?: string
}

export interface TerminalSessionStartResult {
  paneId: string
  isNew: boolean
}

export interface TerminalDataEvent {
  paneId: string
  data: string
}

export interface TerminalExitEvent {
  paneId: string
  exitCode: number
  signal?: number
}

export interface TerminalErrorEvent {
  paneId: string
  error: string
}
