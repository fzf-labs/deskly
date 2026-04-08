import type {
  CreatePreviewConfigInput,
  UpdatePreviewConfigInput
} from '../../shared/contracts/preview'
import { IPC_CHANNELS } from './channels'
import type { IpcModuleContext } from './types'

export const registerPreviewConfigIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { previewConfigService, previewDetectionService } = services

  handle(IPC_CHANNELS.previewConfig.getAll, [], () => previewConfigService.getAllConfigs())

  handle(IPC_CHANNELS.previewConfig.getByProject, [v.string()], (_, projectId) =>
    previewConfigService.getConfigsByProject(projectId)
  )

  handle(IPC_CHANNELS.previewConfig.get, [v.string()], (_, id) => previewConfigService.getConfig(id) ?? null)

  handle(IPC_CHANNELS.previewConfig.add, [v.object()], (_, configValue) =>
    previewConfigService.addConfig(configValue as CreatePreviewConfigInput)
  )

  handle(IPC_CHANNELS.previewConfig.update, [v.string(), v.object()], (_, id, updatesValue) =>
    previewConfigService.updateConfig(id, updatesValue as UpdatePreviewConfigInput)
  )

  handle(IPC_CHANNELS.previewConfig.delete, [v.string()], (_, id) =>
    previewConfigService.deleteConfig(id)
  )

  handle(
    IPC_CHANNELS.previewConfig.detectAndSync,
    [v.string(), v.string()],
    (_, projectId, workspacePath) =>
      previewDetectionService.detectAndSync(projectId, workspacePath)
  )
}
