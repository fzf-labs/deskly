import { BrowserWindow } from 'electron'
import type { IpcModuleContext } from './types'
import { IPC_CHANNELS, IPC_EVENTS } from './channels'

let systemCliToolsEventBound = false

export const registerSystemCliToolsIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { systemCliToolService } = services

  if (!systemCliToolsEventBound) {
    systemCliToolsEventBound = true
    systemCliToolService.on('updated', (tools) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send(IPC_EVENTS.systemCliTools.updated, tools)
        }
      }
    })
  }

  handle(IPC_CHANNELS.systemCliTools.getAll, [], () => systemCliToolService.getAllTools())
  handle(
    IPC_CHANNELS.systemCliTools.getSnapshot,
    [],
    () => systemCliToolService.getSnapshot()
  )
  handle(
    IPC_CHANNELS.systemCliTools.refresh,
    [v.optional(v.object())],
    (_, payload) =>
      systemCliToolService.refreshTools({
        level: payload?.level === 'full' ? 'full' : 'fast',
        force: Boolean(payload?.force),
        toolIds: Array.isArray(payload?.toolIds)
          ? payload.toolIds.filter((toolId): toolId is string => typeof toolId === 'string')
          : undefined
      })
  )
  handle(
    IPC_CHANNELS.systemCliTools.detect,
    [v.string(), v.optional(v.object())],
    (_, toolId, options) =>
      systemCliToolService.detectTool(toolId, {
        level: options?.level === 'fast' ? 'fast' : 'full',
        force: Boolean(options?.force)
      })
  )
  handle(
    IPC_CHANNELS.systemCliTools.detectAll,
    [v.optional(v.object())],
    (_, options) =>
      systemCliToolService.detectAllTools({
        level: options?.level === 'fast' ? 'fast' : 'full',
        force: Boolean(options?.force)
      })
  )
}
