import { EventEmitter } from 'events'
import type { TerminalSession, CreateTerminalParams } from './types'
import { createSession } from './session'

export class TerminalService extends EventEmitter {
  private sessions: Map<string, TerminalSession> = new Map()

  async createOrAttach(params: CreateTerminalParams): Promise<{ paneId: string; isNew: boolean }> {
    const { paneId, cols, rows } = params
    const existing = this.sessions.get(paneId)

    if (existing?.isAlive) {
      console.info('[TerminalService] attach existing session', {
        paneId,
        shell: existing.shell,
        cwd: existing.cwd,
        cols,
        rows
      })
      existing.lastActive = Date.now()
      if (cols && rows) {
        this.resize({ paneId, cols, rows })
      }
      return { paneId, isNew: false }
    }

    let session: TerminalSession
    try {
      session = this.createSessionWithFallback(params)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.emit('error', { paneId, error: message })
      throw error
    }
    this.sessions.set(paneId, session)
    console.info('[TerminalService] created session', {
      paneId,
      shell: session.shell,
      cwd: session.cwd,
      cols: session.cols,
      rows: session.rows,
      workspaceId: session.workspaceId
    })

    let hasLoggedFirstData = false
    session.pty.onData((data) => {
      if (!hasLoggedFirstData) {
        hasLoggedFirstData = true
        console.info('[TerminalService] first data', { paneId, bytes: data.length })
      }
      this.emit('data', { paneId, data })
    })

    session.pty.onExit(({ exitCode, signal }) => {
      session.isAlive = false
      console.info('[TerminalService] session exit', { paneId, exitCode, signal })
      this.emit('exit', { paneId, exitCode, signal })
      this.sessions.delete(paneId)
    })

    return { paneId, isNew: true }
  }

  private createSessionWithFallback(params: CreateTerminalParams): TerminalSession {
    try {
      return createSession(params)
    } catch (error) {
      console.error('[TerminalService] Failed to create session with user shell config, retrying clean shell config:', error)
      try {
        return createSession({ ...params, useCleanShellConfig: true })
      } catch (cleanShellError) {
        console.error('[TerminalService] Failed to create session with clean shell config, retrying fallback shell:', cleanShellError)
        return createSession({ ...params, useFallbackShell: true })
      }
    }
  }

  write(params: { paneId: string; data: string }): void {
    const session = this.sessions.get(params.paneId)
    if (!session || !session.isAlive) {
      throw new Error(`Terminal session ${params.paneId} not found or not alive`)
    }
    try {
      console.info('[TerminalService] write', { paneId: params.paneId, bytes: params.data.length })
      session.pty.write(params.data)
      session.lastActive = Date.now()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[TerminalService] write error', { paneId: params.paneId, error: message })
      this.emit('error', { paneId: params.paneId, error: message })
    }
  }

  resize(params: { paneId: string; cols: number; rows: number }): void {
    const { paneId, cols, rows } = params
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols <= 0 || rows <= 0) {
      return
    }
    const session = this.sessions.get(paneId)
    if (!session || !session.isAlive) {
      return
    }
    try {
      session.pty.resize(cols, rows)
      session.cols = cols
      session.rows = rows
      session.lastActive = Date.now()
    } catch (error) {
      console.error(`[TerminalService] Failed to resize terminal ${paneId}:`, error)
    }
  }

  signal(params: { paneId: string; signal?: string }): void {
    const { paneId, signal = 'SIGTERM' } = params
    const session = this.sessions.get(paneId)
    if (!session || !session.isAlive) {
      return
    }
    try {
      session.pty.kill(signal)
      session.lastActive = Date.now()
    } catch (error) {
      console.error(`[TerminalService] Failed to signal terminal ${paneId}:`, error)
    }
  }

  kill(params: { paneId: string }): void {
    const { paneId } = params
    const session = this.sessions.get(paneId)
    if (!session) {
      return
    }
    try {
      if (session.isAlive) {
        session.pty.kill()
      }
    } catch (error) {
      console.error(`[TerminalService] Failed to kill terminal ${paneId}:`, error)
    } finally {
      this.sessions.delete(paneId)
    }
  }

  detach(params: { paneId: string }): void {
    const session = this.sessions.get(params.paneId)
    if (!session) return
    session.lastActive = Date.now()
  }

  killByWorkspaceId(workspaceId: string): { killed: number; failed: number } {
    const sessionsToKill = Array.from(this.sessions.values()).filter(
      (session) => session.workspaceId === workspaceId
    )

    if (sessionsToKill.length === 0) {
      return { killed: 0, failed: 0 }
    }

    let killed = 0
    let failed = 0

    for (const session of sessionsToKill) {
      try {
        if (session.isAlive) {
          session.pty.kill()
        }
        this.sessions.delete(session.paneId)
        killed += 1
      } catch (error) {
        console.error(`[TerminalService] Failed to kill terminal ${session.paneId}:`, error)
        failed += 1
      }
    }

    return { killed, failed }
  }

  dispose(): void {
    for (const session of this.sessions.values()) {
      try {
        if (session.isAlive) {
          session.pty.kill()
        }
      } catch (error) {
        console.error('[TerminalService] Failed to stop terminal session:', error)
      }
    }
    this.sessions.clear()
  }
}
