import type { IpcModuleContext } from './types'
import type { DatabaseService } from '../services/DatabaseService'
import { IPC_CHANNELS } from './channels'

export const registerWorkflowIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { databaseService } = services

  handle(
    IPC_CHANNELS.workflow.listDefinitions,
    [
      v.optional(
        v.shape({
          scope: v.optional(v.enum(['global', 'project'] as const)),
          projectId: v.optional(v.nullable(v.string({ allowEmpty: true })))
        })
      )
    ],
    (_, filter) =>
      databaseService.listWorkflowDefinitions(
        filter as Parameters<DatabaseService['listWorkflowDefinitions']>[0]
      )
  )

  handle(IPC_CHANNELS.workflow.getDefinition, [v.string()], (_, id) =>
    databaseService.getWorkflowDefinition(id)
  )

  handle(
    IPC_CHANNELS.workflow.generateDefinition,
    [
      v.shape({
        prompt: v.string(),
        name: v.optional(v.nullable(v.string({ allowEmpty: true }))),
        mode: v.optional(v.enum(['ai', 'rules'] as const)),
        toolId: v.optional(v.nullable(v.string({ allowEmpty: true }))),
        agentToolConfigId: v.optional(v.nullable(v.string({ allowEmpty: true })))
      })
    ],
    async (_, input) =>
      await databaseService.generateWorkflowDefinition(
        input as unknown as Parameters<DatabaseService['generateWorkflowDefinition']>[0]
      )
  )

  handle(IPC_CHANNELS.workflow.createDefinition, [v.object()], (_, input) =>
    databaseService.createWorkflowDefinition(
      input as unknown as Parameters<DatabaseService['createWorkflowDefinition']>[0]
    )
  )

  handle(IPC_CHANNELS.workflow.updateDefinition, [v.object()], (_, input) =>
    databaseService.updateWorkflowDefinition(
      input as unknown as Parameters<DatabaseService['updateWorkflowDefinition']>[0]
    )
  )

  handle(IPC_CHANNELS.workflow.deleteDefinition, [v.string()], (_, id) =>
    databaseService.deleteWorkflowDefinition(id)
  )

  handle(
    IPC_CHANNELS.workflow.createRunForTask,
    [
      v.shape({
        taskId: v.string(),
        workflowDefinitionId: v.optional(v.nullable(v.string({ allowEmpty: true }))),
        definition: v.optional(v.object())
      })
    ],
    (_, input) =>
      databaseService.createWorkflowRunForTask(
        input as unknown as Parameters<DatabaseService['createWorkflowRunForTask']>[0]
      )
  )

  handle(IPC_CHANNELS.workflow.getRun, [v.string()], (_, runId) =>
    databaseService.getWorkflowRun(runId)
  )

  handle(IPC_CHANNELS.workflow.getRunByTask, [v.string()], (_, taskId) =>
    databaseService.getWorkflowRunByTask(taskId)
  )

  handle(IPC_CHANNELS.workflow.listRunNodes, [v.string()], (_, runId) =>
    databaseService.listWorkflowRunNodes(runId)
  )

  handle(
    IPC_CHANNELS.workflow.startRun,
    [v.string()],
    async (_, runId) => await databaseService.startWorkflowRun(runId)
  )

  handle(
    IPC_CHANNELS.workflow.approveNode,
    [
      v.string(),
      v.optional(
        v.shape({
          comment: v.optional(v.nullable(v.string({ allowEmpty: true }))),
          reviewed_by: v.optional(v.nullable(v.string({ allowEmpty: true }))),
          reviewed_at: v.optional(v.string())
        })
      )
    ],
    (_, nodeId, input) => databaseService.approveWorkflowRunNode(nodeId, input ?? undefined)
  )

  handle(IPC_CHANNELS.workflow.retryNode, [v.string()], (_, nodeId) =>
    databaseService.retryWorkflowRunNode(nodeId)
  )

  handle(
    IPC_CHANNELS.workflow.stopRun,
    [v.string()],
    async (_, runId) => await databaseService.stopWorkflowRun(runId)
  )
}
