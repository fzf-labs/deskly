import { IPC_CHANNELS } from '../../main/ipc/channels'
import type {
  AgentToolConfig,
  CreateAgentToolConfigInput,
  UpdateAgentToolConfigInput
} from '../../shared/contracts/agent-tool-config'
import type {
  Automation,
  AutomationRun,
  CreateAutomationRequest,
  RunAutomationNowResult,
  UpdateAutomationRequest
} from '../../shared/contracts/automation'
import type {
  NotificationOptions,
  NotificationSoundSettings,
  NotificationSoundSettingsState
} from '../../shared/contracts/notification'
import type { OptimizePromptInput, OptimizePromptResult } from '../../shared/contracts/prompt'
import type {
  CompleteTaskNodeResultInput,
  CreateTaskInput,
  CreateTaskOptions,
  DbTask,
  DbTaskNode,
  TaskNodeStatus,
  TaskStatus,
  TaskWithWorktree,
  UpdateCurrentTaskNodeRuntimeInput,
  UpdateTaskInput
} from '../../shared/contracts/task'
import type {
  ApproveWorkflowRunNodeInput,
  CreateWorkflowDefinitionInput,
  CreateWorkflowRunForTaskInput,
  GenerateWorkflowDefinitionInput,
  GeneratedWorkflowDefinitionResult,
  UpdateWorkflowDefinitionInput,
  WorkflowDefinition,
  WorkflowDefinitionFilter,
  WorkflowRun,
  WorkflowRunNode
} from '../../shared/contracts/workflow'
import { invoke } from './common'

export const taskApi = {
  notification: {
    show: (options: NotificationOptions): Promise<boolean> =>
      invoke(IPC_CHANNELS.notification.show, options),
    setEnabled: (enabled: boolean): Promise<unknown> =>
      invoke(IPC_CHANNELS.notification.setEnabled, enabled),
    isEnabled: (): Promise<boolean> => invoke(IPC_CHANNELS.notification.isEnabled),
    setSoundEnabled: (enabled: boolean): Promise<unknown> =>
      invoke(IPC_CHANNELS.notification.setSoundEnabled, enabled),
    isSoundEnabled: (): Promise<boolean> => invoke(IPC_CHANNELS.notification.isSoundEnabled),
    setSoundSettings: (settings: NotificationSoundSettings): Promise<unknown> =>
      invoke(IPC_CHANNELS.notification.setSoundSettings, settings),
    getSoundSettings: (): Promise<NotificationSoundSettingsState> =>
      invoke(IPC_CHANNELS.notification.getSoundSettings)
  },
  database: {
    createTask: (input: CreateTaskInput): Promise<DbTask> =>
      invoke(IPC_CHANNELS.database.createTask, input),
    getTask: (id: string): Promise<DbTask | null> => invoke(IPC_CHANNELS.database.getTask, id),
    getAllTasks: (): Promise<DbTask[]> => invoke(IPC_CHANNELS.database.getAllTasks),
    updateTask: (id: string, updates: UpdateTaskInput): Promise<DbTask | null> =>
      invoke(IPC_CHANNELS.database.updateTask, id, updates),
    deleteTask: (id: string): Promise<boolean> => invoke(IPC_CHANNELS.database.deleteTask, id),
    getTasksByProjectId: (projectId: string): Promise<DbTask[]> =>
      invoke(IPC_CHANNELS.database.getTasksByProjectId, projectId),
    listAgentToolConfigs: (toolId?: string): Promise<AgentToolConfig[]> =>
      invoke(IPC_CHANNELS.database.listAgentToolConfigs, toolId),
    getAgentToolConfig: (id: string): Promise<AgentToolConfig | null> =>
      invoke(IPC_CHANNELS.database.getAgentToolConfig, id),
    createAgentToolConfig: (input: CreateAgentToolConfigInput): Promise<AgentToolConfig> =>
      invoke(IPC_CHANNELS.database.createAgentToolConfig, input),
    updateAgentToolConfig: (
      id: string,
      updates: UpdateAgentToolConfigInput
    ): Promise<AgentToolConfig | null> =>
      invoke(IPC_CHANNELS.database.updateAgentToolConfig, id, updates),
    deleteAgentToolConfig: (id: string): Promise<boolean> =>
      invoke(IPC_CHANNELS.database.deleteAgentToolConfig, id),
    setDefaultAgentToolConfig: (id: string): Promise<AgentToolConfig | null> =>
      invoke(IPC_CHANNELS.database.setDefaultAgentToolConfig, id),
    getTaskNodes: (taskId: string): Promise<DbTaskNode[]> =>
      invoke(IPC_CHANNELS.database.getTaskNodes, taskId),
    getTaskNode: (nodeId: string): Promise<DbTaskNode | null> =>
      invoke(IPC_CHANNELS.database.getTaskNode, nodeId),
    getCurrentTaskNode: (taskId: string): Promise<DbTaskNode | null> =>
      invoke(IPC_CHANNELS.database.getCurrentTaskNode, taskId),
    updateCurrentTaskNodeRuntime: (
      taskId: string,
      updates: UpdateCurrentTaskNodeRuntimeInput
    ): Promise<DbTaskNode | null> =>
      invoke(IPC_CHANNELS.database.updateCurrentTaskNodeRuntime, taskId, updates),
    getTaskNodesByStatus: (taskId: string, status: TaskNodeStatus): Promise<DbTaskNode[]> =>
      invoke(IPC_CHANNELS.database.getTaskNodesByStatus, taskId, status),
    completeTaskNode: (nodeId: string, result?: CompleteTaskNodeResultInput): Promise<unknown> =>
      invoke(IPC_CHANNELS.database.completeTaskNode, nodeId, result),
    markTaskNodeErrorReview: (nodeId: string, error: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.database.markTaskNodeErrorReview, nodeId, error),
    approveTaskNode: (nodeId: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.database.approveTaskNode, nodeId),
    rerunTaskNode: (nodeId: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.database.rerunTaskNode, nodeId),
    stopTaskNodeExecution: (nodeId: string, reason?: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.database.stopTaskNodeExecution, nodeId, reason)
  },
  workflow: {
    listDefinitions: (filter?: WorkflowDefinitionFilter): Promise<WorkflowDefinition[]> =>
      invoke(IPC_CHANNELS.workflow.listDefinitions, filter),
    getDefinition: (id: string): Promise<WorkflowDefinition | null> =>
      invoke(IPC_CHANNELS.workflow.getDefinition, id),
    generateDefinition: (
      input: GenerateWorkflowDefinitionInput
    ): Promise<GeneratedWorkflowDefinitionResult> =>
      invoke(IPC_CHANNELS.workflow.generateDefinition, input),
    createDefinition: (input: CreateWorkflowDefinitionInput): Promise<WorkflowDefinition> =>
      invoke(IPC_CHANNELS.workflow.createDefinition, input),
    updateDefinition: (input: UpdateWorkflowDefinitionInput): Promise<WorkflowDefinition> =>
      invoke(IPC_CHANNELS.workflow.updateDefinition, input),
    deleteDefinition: (id: string): Promise<boolean> =>
      invoke(IPC_CHANNELS.workflow.deleteDefinition, id),
    createRunForTask: (input: CreateWorkflowRunForTaskInput): Promise<WorkflowRun> =>
      invoke(IPC_CHANNELS.workflow.createRunForTask, input),
    getRun: (id: string): Promise<WorkflowRun | null> => invoke(IPC_CHANNELS.workflow.getRun, id),
    getRunByTask: (taskId: string): Promise<WorkflowRun | null> =>
      invoke(IPC_CHANNELS.workflow.getRunByTask, taskId),
    listRunNodes: (runId: string): Promise<WorkflowRunNode[]> =>
      invoke(IPC_CHANNELS.workflow.listRunNodes, runId),
    startRun: (runId: string): Promise<WorkflowRun | null> =>
      invoke(IPC_CHANNELS.workflow.startRun, runId),
    approveNode: (
      nodeId: string,
      input?: ApproveWorkflowRunNodeInput
    ): Promise<WorkflowRunNode | null> => invoke(IPC_CHANNELS.workflow.approveNode, nodeId, input),
    retryNode: (nodeId: string): Promise<WorkflowRunNode | null> =>
      invoke(IPC_CHANNELS.workflow.retryNode, nodeId),
    stopRun: (runId: string): Promise<WorkflowRun | null> =>
      invoke(IPC_CHANNELS.workflow.stopRun, runId)
  },
  prompt: {
    optimize: (input: OptimizePromptInput): Promise<OptimizePromptResult> =>
      invoke(IPC_CHANNELS.prompt.optimize, input)
  },
  task: {
    create: (options: CreateTaskOptions): Promise<TaskWithWorktree> =>
      invoke(IPC_CHANNELS.task.create, options),
    get: (id: string): Promise<TaskWithWorktree | null> => invoke(IPC_CHANNELS.task.get, id),
    getAll: (): Promise<TaskWithWorktree[]> => invoke(IPC_CHANNELS.task.getAll),
    getByProject: (projectId: string): Promise<TaskWithWorktree[]> =>
      invoke(IPC_CHANNELS.task.getByProject, projectId),
    updateStatus: (id: string, status: TaskStatus): Promise<TaskWithWorktree | null> =>
      invoke(IPC_CHANNELS.task.updateStatus, id, status),
    delete: (id: string, removeWorktree?: boolean): Promise<boolean> =>
      invoke(IPC_CHANNELS.task.delete, id, removeWorktree),
    startExecution: (taskId: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.task.startExecution, taskId),
    stopExecution: (taskId: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.task.stopExecution, taskId)
  },
  automation: {
    create: (input: CreateAutomationRequest): Promise<Automation> =>
      invoke(IPC_CHANNELS.automation.create, input),
    update: (id: string, updates: UpdateAutomationRequest): Promise<Automation | null> =>
      invoke(IPC_CHANNELS.automation.update, id, updates),
    delete: (id: string): Promise<boolean> => invoke(IPC_CHANNELS.automation.delete, id),
    get: (id: string): Promise<Automation | null> => invoke(IPC_CHANNELS.automation.get, id),
    list: (): Promise<Automation[]> => invoke(IPC_CHANNELS.automation.list),
    setEnabled: (id: string, enabled: boolean): Promise<Automation | null> =>
      invoke(IPC_CHANNELS.automation.setEnabled, id, enabled),
    runNow: (id: string): Promise<RunAutomationNowResult> =>
      invoke(IPC_CHANNELS.automation.runNow, id),
    listRuns: (id: string, limit?: number): Promise<AutomationRun[]> =>
      invoke(IPC_CHANNELS.automation.listRuns, id, limit)
  }
}
