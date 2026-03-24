import { EventEmitter } from 'events'
import { describe, expect, it, vi } from 'vitest'
import { PreviewService } from '../../src/main/services/PreviewService'
import { registerCliSessionIpc } from '../../src/main/ipc/cli-session.ipc'
import { v } from '../../src/main/utils/ipc-response'
import { AppContext } from '../../src/main/app/AppContext'
import { IPC_CHANNELS } from '../../src/main/ipc/channels'

describe('preview stop behavior', () => {
  it('waits for exit and escalates to SIGKILL after timeout', async () => {
    const service = new PreviewService()
    const instanceId = 'preview-1'
    const instance = {
      id: instanceId,
      configId: 'cfg',
      status: 'running',
      startedAt: new Date().toISOString()
    }

    const child = new EventEmitter() as any
    child.exitCode = null
    child.killed = false
    const killCalls: string[] = []
    child.kill = (signal?: NodeJS.Signals) => {
      if (signal) killCalls.push(signal)
      return true
    }

    ;(service as any).instances.set(instanceId, instance)
    ;(service as any).processes.set(instanceId, child)

    vi.useFakeTimers()
    const stopPromise = service.stopPreview(instanceId)

    expect(killCalls).toEqual(['SIGTERM'])

    await vi.advanceTimersByTimeAsync(5000)
    expect(killCalls).toContain('SIGKILL')

    child.emit('exit', 0)
    await stopPromise
    vi.useRealTimers()
  })
})

describe('log stream subscription cleanup', () => {
  it('removes subscriptions on webContents destroyed', () => {
    const handlers: Record<string, (event: any, ...args: any[]) => any> = {}
    const unsubscribe = vi.fn()
    const cliSessionService = {
      subscribeToSession: vi.fn(() => unsubscribe),
      getSessionLogHistory: vi.fn(() => [])
    }

    registerCliSessionIpc({
      services: { cliSessionService } as any,
      handle: (channel, _validators, handler) => {
        handlers[channel] = handler
      },
      v,
      resolveProjectIdForSession: () => null
    } as any)

    const webContents = new EventEmitter() as any
    webContents.id = 1
    webContents.isDestroyed = () => false
    webContents.send = vi.fn()

    handlers[IPC_CHANNELS.logStream.subscribe]({ sender: webContents }, 'session-1')
    webContents.emit('destroyed')

    expect(unsubscribe).toHaveBeenCalled()
  })
})

describe('app context disposal order', () => {
  it('disposes resources before services in reverse order', async () => {
    const calls: string[] = []
    const serviceA = { dispose: () => calls.push('serviceA') }
    const serviceB = { dispose: () => calls.push('serviceB') }
    const ctx = new AppContext({} as any, {} as any, [serviceA, serviceB])

    ctx.trackDisposable(() => calls.push('dispose-1'))
    ctx.trackDisposable(() => calls.push('dispose-2'))

    await ctx.dispose()

    expect(calls).toEqual(['dispose-2', 'dispose-1', 'serviceB', 'serviceA'])
  })
})
