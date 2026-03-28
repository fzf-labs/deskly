import type { IpcModuleContext } from './types'
import { IPC_CHANNELS } from './channels'

export const registerPromptIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { aiAuthoringService } = services

  handle(
    IPC_CHANNELS.prompt.optimize,
    [
      v.shape({
        prompt: v.string(),
        contextType: v.enum(['task', 'workflow-generation', 'workflow-node', 'automation'] as const),
        name: v.optional(v.nullable(v.string({ allowEmpty: true }))),
        toolId: v.optional(v.nullable(v.string({ allowEmpty: true }))),
        agentToolConfigId: v.optional(v.nullable(v.string({ allowEmpty: true })))
      })
    ],
    async (_, input) =>
      await aiAuthoringService.optimizePrompt(
        input as unknown as Parameters<typeof aiAuthoringService.optimizePrompt>[0]
      )
  )
}
