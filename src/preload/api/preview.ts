import type {
  CreatePreviewConfigInput,
  PreviewConfig,
  PreviewConfigSyncResult,
  PreviewInstance,
  UpdatePreviewConfigInput
} from '../../shared/contracts/preview'
import { IPC_CHANNELS } from '../../main/ipc/channels'
import { invoke } from './common'

export const previewApi = {
  editor: {
    getAvailable: (): Promise<unknown[]> => invoke(IPC_CHANNELS.editor.getAvailable),
    openProject: (projectPath: string, editorCommand: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.editor.openProject, projectPath, editorCommand)
  },
  previewConfig: {
    getAll: (): Promise<PreviewConfig[]> => invoke(IPC_CHANNELS.previewConfig.getAll),
    getByProject: (projectId: string): Promise<PreviewConfig[]> =>
      invoke(IPC_CHANNELS.previewConfig.getByProject, projectId),
    get: (id: string): Promise<PreviewConfig | null> => invoke(IPC_CHANNELS.previewConfig.get, id),
    add: (config: CreatePreviewConfigInput): Promise<PreviewConfig> =>
      invoke(IPC_CHANNELS.previewConfig.add, config),
    update: (id: string, updates: UpdatePreviewConfigInput): Promise<PreviewConfig> =>
      invoke(IPC_CHANNELS.previewConfig.update, id, updates),
    delete: (id: string): Promise<boolean> => invoke(IPC_CHANNELS.previewConfig.delete, id),
    detectAndSync: (projectId: string, workspacePath: string): Promise<PreviewConfigSyncResult> =>
      invoke(IPC_CHANNELS.previewConfig.detectAndSync, projectId, workspacePath)
  },
  preview: {
    start: (
      instanceId: string,
      configId: string,
      command: string,
      args: string[],
      port?: number | null,
      cwd?: string,
      env?: Record<string, string>
    ): Promise<PreviewInstance> =>
      invoke(IPC_CHANNELS.preview.start, instanceId, configId, command, args, port, cwd, env),
    stop: (instanceId: string): Promise<void> => invoke(IPC_CHANNELS.preview.stop, instanceId),
    getInstance: (instanceId: string): Promise<PreviewInstance | null> =>
      invoke(IPC_CHANNELS.preview.getInstance, instanceId),
    getAllInstances: (): Promise<PreviewInstance[]> => invoke(IPC_CHANNELS.preview.getAllInstances),
    getOutput: (instanceId: string, limit?: number): Promise<string[]> =>
      invoke(IPC_CHANNELS.preview.getOutput, instanceId, limit),
    clearInstance: (instanceId: string): Promise<void> =>
      invoke(IPC_CHANNELS.preview.clearInstance, instanceId)
  }
}
