import { IPC_CHANNELS } from '../../main/ipc/channels'
import { invoke } from './common'

export const previewApi = {
  editor: {
    getAvailable: (): Promise<unknown[]> => invoke(IPC_CHANNELS.editor.getAvailable),
    openProject: (projectPath: string, editorCommand: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.editor.openProject, projectPath, editorCommand)
  },
  previewConfig: {
    getAll: (): Promise<unknown[]> => invoke(IPC_CHANNELS.previewConfig.getAll),
    getByProject: (projectId: string): Promise<unknown[]> =>
      invoke(IPC_CHANNELS.previewConfig.getByProject, projectId),
    get: (id: string): Promise<unknown> => invoke(IPC_CHANNELS.previewConfig.get, id),
    add: (config: Record<string, unknown>): Promise<unknown> =>
      invoke(IPC_CHANNELS.previewConfig.add, config),
    update: (id: string, updates: Record<string, unknown>): Promise<unknown> =>
      invoke(IPC_CHANNELS.previewConfig.update, id, updates),
    delete: (id: string): Promise<unknown> => invoke(IPC_CHANNELS.previewConfig.delete, id)
  },
  preview: {
    start: (
      instanceId: string,
      configId: string,
      command: string,
      args: string[],
      cwd?: string,
      env?: Record<string, string>
    ): Promise<unknown> => invoke(IPC_CHANNELS.preview.start, instanceId, configId, command, args, cwd, env),
    stop: (instanceId: string): Promise<unknown> => invoke(IPC_CHANNELS.preview.stop, instanceId),
    getInstance: (instanceId: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.preview.getInstance, instanceId),
    getAllInstances: (): Promise<unknown[]> => invoke(IPC_CHANNELS.preview.getAllInstances),
    getOutput: (instanceId: string, limit?: number): Promise<string[]> =>
      invoke(IPC_CHANNELS.preview.getOutput, instanceId, limit),
    clearInstance: (instanceId: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.preview.clearInstance, instanceId)
  }
}
