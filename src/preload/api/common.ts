import { ipcRenderer } from 'electron'

type IpcResponse<T> = { success: boolean; data?: T; error?: string }

export const invoke = async <T>(channel: string, ...args: unknown[]): Promise<T> => {
  const response = await ipcRenderer.invoke(channel, ...args)
  if (response && typeof response === 'object' && 'success' in response) {
    const wrapped = response as IpcResponse<T>
    if ('data' in wrapped || 'error' in wrapped) {
      if (wrapped.success) {
        return wrapped.data as T
      }
      throw new Error(wrapped.error || 'IPC request failed')
    }
  }
  return response as T
}

export const listen = <T>(channel: string, callback: (payload: T) => void): (() => void) => {
  const listener = (_: unknown, payload: T) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

export const listenPair = <A, B>(
  channel: string,
  callback: (first: A, second: B) => void
): (() => void) => {
  const listener = (_: unknown, first: A, second: B) => callback(first, second)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}
