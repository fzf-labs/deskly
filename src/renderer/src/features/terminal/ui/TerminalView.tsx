import { useCallback, useEffect, useRef } from 'react'
import type { FitAddon } from '@xterm/addon-fit'
import type { Terminal as XTerm } from 'xterm'
import 'xterm/css/xterm.css'

import { cn } from '@/lib/utils'

import { createTerminalInstance } from '../model/helpers'

interface TerminalViewProps {
  paneId: string
  cwd: string
  workspaceId?: string | null
  isActive: boolean
}

export function TerminalView({ paneId, cwd, workspaceId, isActive }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const exitedRef = useRef(false)
  const receivedDataRef = useRef(false)
  const sessionStartedRef = useRef(false)

  const startSession = useCallback(
    async (size?: { cols: number; rows: number }) => {
      const cols = size?.cols ?? xtermRef.current?.cols ?? 80
      const rows = size?.rows ?? xtermRef.current?.rows ?? 24

      try {
        console.info('[TerminalView] startSession', { paneId, cwd, cols, rows, workspaceId })
        await window.api.terminal.startSession(paneId, cwd, cols, rows, workspaceId ?? undefined)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        xtermRef.current?.writeln(`\r\n[Failed to start terminal: ${message}]`)
      }
    },
    [cwd, paneId, workspaceId]
  )

  const getMeasuredSize = useCallback(() => {
    const container = containerRef.current
    if (!container || !xtermRef.current || !fitAddonRef.current) return null

    const rect = container.getBoundingClientRect()
    if (rect.width < 240 || rect.height < 120) {
      return null
    }

    try {
      fitAddonRef.current.fit()
      const cols = xtermRef.current.cols || 0
      const rows = xtermRef.current.rows || 0
      if (cols < 20 || rows < 5) {
        return null
      }
      return { cols, rows }
    } catch {
      return null
    }
  }, [])

  const handleResize = useCallback(() => {
    const size = getMeasuredSize()
    if (!size) return false

    if (sessionStartedRef.current) {
      window.api.terminal.resize(paneId, size.cols, size.rows)
      return true
    }

    sessionStartedRef.current = true
    void startSession(size)
    return true
  }, [getMeasuredSize, paneId, startSession])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let isDisposed = false
    let resizeObserver: ResizeObserver | null = null
    let inputDisposable: { dispose: () => void } | null = null
    let keyDisposable: { dispose: () => void } | null = null
    let unsubscribeData: (() => void) | null = null
    let unsubscribeExit: (() => void) | null = null
    let unsubscribeError: (() => void) | null = null
    let xterm: XTerm | null = null
    let noOutputTimer: number | null = null
    let startRetryTimer: number | null = null

    const scheduleStartAttempt = (attempt: number) => {
      if (isDisposed || sessionStartedRef.current) return
      if (handleResize()) return

      if (attempt >= 20) {
        console.info('[TerminalView] fallback startSession', { paneId })
        sessionStartedRef.current = true
        void startSession({ cols: 80, rows: 24 })
        return
      }

      startRetryTimer = window.setTimeout(() => {
        scheduleStartAttempt(attempt + 1)
      }, 50)
    }

    const initFrame = window.requestAnimationFrame(() => {
      if (isDisposed) return

      const terminalInstance = createTerminalInstance(container, {
        onUrlClick: (url) => window.api.shell.openUrl(url)
      })

      xterm = terminalInstance.xterm
      xtermRef.current = terminalInstance.xterm
      fitAddonRef.current = terminalInstance.fitAddon
      exitedRef.current = false
      receivedDataRef.current = false
      sessionStartedRef.current = false

      noOutputTimer = window.setTimeout(() => {
        if (isDisposed || receivedDataRef.current || !xterm) return
        xterm.writeln('\r\n[Terminal started but no shell output yet]')
        xterm.writeln(
          '[Try pressing Enter. If it is still blank, check the pnpm dev logs for TerminalService messages.]'
        )
      }, 1500)

      unsubscribeData = window.api.terminal.onData((data) => {
        if (data.paneId !== paneId) return
        if (!receivedDataRef.current) {
          console.info('[TerminalView] firstData', { paneId, bytes: data.data.length })
        }
        receivedDataRef.current = true
        xterm?.write(data.data)
      })

      unsubscribeExit = window.api.terminal.onExit((data) => {
        if (data.paneId !== paneId) return
        exitedRef.current = true
        xterm?.writeln(`\r\n[Process exited with code ${data.exitCode}]`)
        xterm?.writeln('[Press any key to restart]')
      })

      unsubscribeError = window.api.terminal.onError((data) => {
        if (data.paneId !== paneId) return
        xterm?.writeln(`\r\n[Terminal error: ${data.error}]`)
      })

      const handleInput = (value: string) => {
        if (exitedRef.current) {
          exitedRef.current = false
          xterm?.clear()
          void startSession()
          return
        }
        window.api.terminal.write(paneId, value)
      }

      inputDisposable = xterm.onData(handleInput)

      keyDisposable = xterm.onKey((event) => {
        if (!xterm) return
        const { domEvent } = event
        if ((domEvent.metaKey || domEvent.ctrlKey) && domEvent.key.toLowerCase() === 'k') {
          domEvent.preventDefault()
          xterm.clear()
        }
      })

      resizeObserver = new ResizeObserver(() => {
        if (isDisposed) return
        handleResize()
      })
      resizeObserver.observe(container)

      scheduleStartAttempt(0)
      xterm.focus()
    })

    return () => {
      isDisposed = true
      window.cancelAnimationFrame(initFrame)
      if (noOutputTimer !== null) {
        window.clearTimeout(noOutputTimer)
      }
      if (startRetryTimer !== null) {
        window.clearTimeout(startRetryTimer)
      }
      inputDisposable?.dispose()
      keyDisposable?.dispose()
      resizeObserver?.disconnect()
      unsubscribeData?.()
      unsubscribeExit?.()
      unsubscribeError?.()
      window.api.terminal.detach(paneId)
      xterm?.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
      sessionStartedRef.current = false
    }
  }, [handleResize, paneId, startSession])

  useEffect(() => {
    if (!isActive) return
    handleResize()
    xtermRef.current?.focus()
  }, [handleResize, isActive])

  return (
    <div
      className={cn(
        'absolute inset-0 h-full min-h-0 w-full overflow-hidden transition-opacity',
        isActive ? 'opacity-100' : 'pointer-events-none opacity-0'
      )}
    >
      <div ref={containerRef} className="h-full min-h-0 w-full" />
    </div>
  )
}
