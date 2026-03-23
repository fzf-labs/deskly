import type { IpcModuleContext } from './types'
import type { DatabaseService } from '../services/DatabaseService'
import { IPC_CHANNELS } from './channels'

export const registerPromptIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { databaseService } = services

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
      await databaseService.optimizePrompt(
        input as unknown as Parameters<DatabaseService['optimizePrompt']>[0]
      )
  )
}
