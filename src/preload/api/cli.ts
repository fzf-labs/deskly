import { IPC_CHANNELS, IPC_EVENTS } from '../../main/ipc/channels'
import type {
  CliSessionCloseEvent,
  CliSessionErrorEvent,
  CliSessionInfo,
  CliSessionOutputEvent,
  CliSessionStartOptions,
  CliSessionStatusEvent,
  LogStreamSubscriptionResult,
  OutputSnapshot,
  TerminalDataEvent,
  TerminalErrorEvent,
  TerminalExitEvent,
  TerminalSessionStartResult
} from '../../shared/contracts/cli-session'
import type { TaskNodeEventPayload } from '../../shared/contracts/task'
import { invoke, listen, listenPair } from './common'

export const cliApi = {
  cli: {
    startSession: (
      sessionId: string,
      command: string,
      args: string[],
      cwd?: string
    ): Promise<unknown> => invoke(IPC_CHANNELS.cli.startSession, sessionId, command, args, cwd),
    stopSession: (sessionId: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.cli.stopSession, sessionId),
    getOutput: (sessionId: string): Promise<OutputSnapshot> =>
      invoke(IPC_CHANNELS.cli.getOutput, sessionId)
  },
  terminal: {
    startSession: (
      paneId: string,
      cwd: string,
      cols?: number,
      rows?: number,
      workspaceId?: string
    ): Promise<TerminalSessionStartResult> =>
      invoke(IPC_CHANNELS.terminal.startSession, paneId, cwd, cols, rows, workspaceId),
    write: (paneId: string, data: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.terminal.write, paneId, data),
    resize: (paneId: string, cols: number, rows: number): Promise<unknown> =>
      invoke(IPC_CHANNELS.terminal.resize, paneId, cols, rows),
    signal: (paneId: string, signal?: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.terminal.signal, paneId, signal),
    kill: (paneId: string): Promise<unknown> => invoke(IPC_CHANNELS.terminal.kill, paneId),
    detach: (paneId: string): Promise<unknown> => invoke(IPC_CHANNELS.terminal.detach, paneId),
    killByWorkspaceId: (workspaceId: string): Promise<{ killed: number; failed: number }> =>
      invoke(IPC_CHANNELS.terminal.killByWorkspaceId, workspaceId),
    onData: (callback: (data: TerminalDataEvent) => void): (() => void) =>
      listen(IPC_EVENTS.terminal.data, callback),
    onExit: (callback: (data: TerminalExitEvent) => void): (() => void) =>
      listen(IPC_EVENTS.terminal.exit, callback),
    onError: (callback: (data: TerminalErrorEvent) => void): (() => void) =>
      listen(IPC_EVENTS.terminal.error, callback)
  },
  cliSession: {
    startSession: (
      sessionId: string,
      toolId: string,
      workdir: string,
      options?: CliSessionStartOptions
    ): Promise<unknown> =>
      invoke(IPC_CHANNELS.cliSession.startSession, sessionId, toolId, workdir, options),
    stopSession: (sessionId: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.cliSession.stopSession, sessionId),
    sendInput: (sessionId: string, input: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.cliSession.sendInput, sessionId, input),
    getSessions: (): Promise<CliSessionInfo[]> => invoke(IPC_CHANNELS.cliSession.getSessions),
    getSession: (sessionId: string): Promise<CliSessionInfo | null> =>
      invoke(IPC_CHANNELS.cliSession.getSession, sessionId),
    onStatus: (callback: (data: CliSessionStatusEvent) => void): (() => void) =>
      listen(IPC_EVENTS.cliSession.status, callback),
    onOutput: (callback: (data: CliSessionOutputEvent) => void): (() => void) =>
      listen(IPC_EVENTS.cliSession.output, callback),
    onClose: (callback: (data: CliSessionCloseEvent) => void): (() => void) =>
      listen(IPC_EVENTS.cliSession.close, callback),
    onError: (callback: (data: CliSessionErrorEvent) => void): (() => void) =>
      listen(IPC_EVENTS.cliSession.error, callback)
  },
  logStream: {
    subscribe: (sessionId: string): Promise<LogStreamSubscriptionResult> =>
      invoke(IPC_CHANNELS.logStream.subscribe, sessionId),
    unsubscribe: (sessionId: string): Promise<LogStreamSubscriptionResult> =>
      invoke(IPC_CHANNELS.logStream.unsubscribe, sessionId),
    getHistory: (
      taskId: string,
      sessionId?: string | null,
      taskNodeId?: string | null
    ): Promise<unknown[]> =>
      invoke(IPC_CHANNELS.logStream.getHistory, taskId, sessionId || null, taskNodeId || null),
    onMessage: (callback: (sessionId: string, msg: unknown) => void): (() => void) =>
      listenPair(IPC_EVENTS.logStream.message, callback)
  },
  taskNode: {
    onCompleted: (callback: (data: TaskNodeEventPayload) => void): (() => void) =>
      listen(IPC_EVENTS.taskNode.completed, callback),
    onReview: (callback: (data: TaskNodeEventPayload) => void): (() => void) =>
      listen(IPC_EVENTS.taskNode.review, callback)
  },
  cliTools: {
    getAll: (): Promise<unknown[]> => invoke(IPC_CHANNELS.cliTools.getAll),
    getSnapshot: (): Promise<unknown[]> => invoke(IPC_CHANNELS.cliTools.getSnapshot),
    refresh: (options?: { level?: 'fast' | 'full'; force?: boolean; toolIds?: string[] }): Promise<unknown[]> =>
      invoke(IPC_CHANNELS.cliTools.refresh, options),
    detect: (
      toolId: string,
      options?: { level?: 'fast' | 'full'; force?: boolean }
    ): Promise<unknown> => invoke(IPC_CHANNELS.cliTools.detect, toolId, options),
    detectAll: (options?: { level?: 'fast' | 'full'; force?: boolean }): Promise<unknown[]> =>
      invoke(IPC_CHANNELS.cliTools.detectAll, options),
    onUpdated: (callback: (tools: unknown[]) => void): (() => void) =>
      listen(IPC_EVENTS.cliTools.updated, callback)
  },
  cliToolConfig: {
    get: (toolId: string): Promise<Record<string, unknown>> =>
      invoke(IPC_CHANNELS.cliToolConfig.get, toolId),
    save: (toolId: string, config: Record<string, unknown>): Promise<unknown> =>
      invoke(IPC_CHANNELS.cliToolConfig.save, toolId, config)
  },
  systemCliTools: {
    getAll: (): Promise<unknown[]> => invoke(IPC_CHANNELS.systemCliTools.getAll),
    getSnapshot: (): Promise<unknown[]> => invoke(IPC_CHANNELS.systemCliTools.getSnapshot),
    refresh: (options?: { level?: 'fast' | 'full'; force?: boolean; toolIds?: string[] }): Promise<unknown[]> =>
      invoke(IPC_CHANNELS.systemCliTools.refresh, options),
    detect: (
      toolId: string,
      options?: { level?: 'fast' | 'full'; force?: boolean }
    ): Promise<unknown> => invoke(IPC_CHANNELS.systemCliTools.detect, toolId, options),
    detectAll: (options?: { level?: 'fast' | 'full'; force?: boolean }): Promise<unknown[]> =>
      invoke(IPC_CHANNELS.systemCliTools.detectAll, options),
    onUpdated: (callback: (tools: unknown[]) => void): (() => void) =>
      listen(IPC_EVENTS.systemCliTools.updated, callback)
  }
}
