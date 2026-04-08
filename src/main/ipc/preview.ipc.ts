import { IPC_CHANNELS } from './channels'
import type { IpcModuleContext } from './types'

export const registerPreviewIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { previewService } = services

  handle(
    IPC_CHANNELS.preview.start,
    [
      v.string(),
      v.string(),
      v.string(),
      v.array(v.string()),
      v.optional(v.number({ min: 1 })),
      v.optional(v.string()),
      v.optional(v.object())
    ],
    async (_, instanceId, configId, command, args, port, cwd, env) => {
      return await previewService.startPreview(
        instanceId,
        configId,
        command,
        args,
        port,
        cwd,
        env as Record<string, string> | undefined
      )
    }
  )

  handle(IPC_CHANNELS.preview.stop, [v.string()], async (_, instanceId) => {
    await previewService.stopPreview(instanceId)
  })

  handle(IPC_CHANNELS.preview.getInstance, [v.string()], (_, instanceId) => {
    return previewService.getInstance(instanceId) ?? null
  })

  handle(IPC_CHANNELS.preview.getAllInstances, [], () => previewService.getAllInstances())

  handle(
    IPC_CHANNELS.preview.getOutput,
    [v.string(), v.optional(v.number({ min: 1 }))],
    (_, instanceId, limit) => previewService.getOutput(instanceId, limit)
  )

  handle(IPC_CHANNELS.preview.clearInstance, [v.string()], (_, instanceId) => {
    previewService.clearInstance(instanceId)
  })
}
