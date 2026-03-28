import type { IpcModuleContext } from './types'
import type { AgentToolProfileService } from '../services/AgentToolProfileService'
import type { DatabaseService } from '../services/DatabaseService'
import type { TaskNodeStatus } from '../types/task'
import { IPC_CHANNELS } from './channels'

export const registerDatabaseIpc = ({
  handle,
  v,
  services,
  taskNodeStatusValues
}: IpcModuleContext): void => {
  const { databaseService, agentToolProfileService, taskNodeRuntimeService } = services

  handle(IPC_CHANNELS.database.createTask, [v.object()], (_, input) =>
    databaseService.createTask(input as unknown as Parameters<DatabaseService['createTask']>[0])
  )

  handle(IPC_CHANNELS.database.getTask, [v.string()], (_, id) => databaseService.getTask(id))

  handle(IPC_CHANNELS.database.getAllTasks, [], () => databaseService.getAllTasks())

  handle(IPC_CHANNELS.database.updateTask, [v.string(), v.object()], (_, id, updates) =>
    databaseService.updateTask(
      id,
      updates as unknown as Parameters<DatabaseService['updateTask']>[1]
    )
  )

  handle(IPC_CHANNELS.database.deleteTask, [v.string()], (_, id) => databaseService.deleteTask(id))

  handle(IPC_CHANNELS.database.getTasksByProjectId, [v.string()], (_, projectId) =>
    databaseService.getTasksByProjectId(projectId)
  )

  handle(
    IPC_CHANNELS.database.listAgentToolConfigs,
    [v.optional(v.string({ allowEmpty: true }))],
    (_, toolId) => agentToolProfileService.list(toolId || undefined)
  )

  handle(IPC_CHANNELS.database.getAgentToolConfig, [v.string()], (_, id) =>
    agentToolProfileService.get(id)
  )

  handle(IPC_CHANNELS.database.createAgentToolConfig, [v.object()], (_, input) =>
    agentToolProfileService.create(
      input as unknown as Parameters<AgentToolProfileService['create']>[0]
    )
  )

  handle(IPC_CHANNELS.database.updateAgentToolConfig, [v.string(), v.object()], (_, id, updates) =>
    agentToolProfileService.update(
      id,
      updates as unknown as Parameters<AgentToolProfileService['update']>[1]
    )
  )

  handle(IPC_CHANNELS.database.deleteAgentToolConfig, [v.string()], (_, id) =>
    agentToolProfileService.delete(id)
  )

  handle(IPC_CHANNELS.database.setDefaultAgentToolConfig, [v.string()], (_, id) =>
    agentToolProfileService.setDefault(id)
  )

  handle(IPC_CHANNELS.database.getTaskNodes, [v.string()], (_, taskId) =>
    taskNodeRuntimeService.getTaskNodes(taskId)
  )

  handle(IPC_CHANNELS.database.getTaskNode, [v.string()], (_, nodeId) =>
    taskNodeRuntimeService.getTaskNode(nodeId)
  )

  handle(IPC_CHANNELS.database.getCurrentTaskNode, [v.string()], (_, taskId) =>
    taskNodeRuntimeService.getCurrentTaskNode(taskId)
  )

  handle(
    IPC_CHANNELS.database.updateCurrentTaskNodeRuntime,
    [
      v.string(),
      v.shape({
        session_id: v.optional(v.nullable(v.string({ allowEmpty: true }))),
        resume_session_id: v.optional(v.nullable(v.string({ allowEmpty: true }))),
        cli_tool_id: v.optional(v.nullable(v.string({ allowEmpty: true }))),
        agent_tool_config_id: v.optional(v.nullable(v.string({ allowEmpty: true })))
      })
    ],
    (_, taskId, updates) =>
      taskNodeRuntimeService.updateCurrentTaskNodeRuntime(
        taskId,
        updates as unknown as Parameters<
          typeof taskNodeRuntimeService.updateCurrentTaskNodeRuntime
        >[1]
      )
  )

  handle(
    IPC_CHANNELS.database.getTaskNodesByStatus,
    [v.string(), v.enum(taskNodeStatusValues)],
    (_, taskId, status) =>
      taskNodeRuntimeService.getTaskNodesByStatus(taskId, status as TaskNodeStatus)
  )

  handle(
    IPC_CHANNELS.database.completeTaskNode,
    [
      v.string(),
      v.optional(
        v.shape({
          resultSummary: v.optional(v.nullable(v.string({ allowEmpty: true }))),
          cost: v.optional(v.nullable(v.number())),
          duration: v.optional(v.nullable(v.number())),
          sessionId: v.optional(v.nullable(v.string({ allowEmpty: true }))),
          allowConversationCompletion: v.optional(v.boolean())
        })
      )
    ],
    (_, nodeId, result) => taskNodeRuntimeService.completeTaskNode(nodeId, result || {})
  )

  handle(
    IPC_CHANNELS.database.markTaskNodeErrorReview,
    [v.string(), v.string()],
    (_, nodeId, error) => taskNodeRuntimeService.markTaskNodeErrorReview(nodeId, error)
  )

  handle(IPC_CHANNELS.database.approveTaskNode, [v.string()], (_, nodeId) =>
    taskNodeRuntimeService.approveTaskNode(nodeId)
  )

  handle(IPC_CHANNELS.database.rerunTaskNode, [v.string()], (_, nodeId) =>
    taskNodeRuntimeService.rerunTaskNode(nodeId)
  )

  handle(
    IPC_CHANNELS.database.stopTaskNodeExecution,
    [v.string(), v.optional(v.string({ allowEmpty: true }))],
    (_, nodeId, reason) => taskNodeRuntimeService.stopTaskNodeExecution(nodeId, reason || undefined)
  )
}
