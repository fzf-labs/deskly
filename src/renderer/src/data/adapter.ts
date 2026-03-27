import type {
  AgentToolConfig,
  CreateAgentToolConfigInput,
  CreateAutomationRequest,
  CreateTaskInput,
  CreateWorkflowDefinitionInput,
  GeneratedWorkflowDefinitionResult,
  GenerateWorkflowDefinitionInput,
  OptimizePromptInput,
  OptimizePromptResult,
  RunAutomationNowResult,
  Task,
  TaskNodeStatus,
  TaskNode,
  UpdateAgentToolConfigInput,
  UpdateAutomationRequest,
  UpdateTaskInput,
  WorkflowDefinition,
  WorkflowRun,
  UpdateWorkflowDefinitionInput,
  WorkflowRunNode
} from './types'
import type { Automation, AutomationRun } from './types'

export const db = {
  createTask: async (input: CreateTaskInput): Promise<Task> => {
    return (await window.api.database.createTask(input)) as Task
  },

  getTask: (id: string): Promise<Task | null> => {
    return window.api.database.getTask(id) as Promise<Task | null>
  },

  getAllTasks: (): Promise<Task[]> => {
    return window.api.database.getAllTasks() as Promise<Task[]>
  },

  updateTask: async (id: string, updates: UpdateTaskInput): Promise<Task | null> => {
    return (await window.api.database.updateTask(id, updates)) as Task | null
  },

  deleteTask: async (id: string, removeWorktree: boolean = true): Promise<boolean> => {
    return await window.api.task.delete(id, removeWorktree)
  },

  listAgentToolConfigs: (toolId?: string): Promise<AgentToolConfig[]> => {
    return window.api.database.listAgentToolConfigs(toolId) as Promise<AgentToolConfig[]>
  },

  getAgentToolConfig: (id: string): Promise<AgentToolConfig | null> => {
    return window.api.database.getAgentToolConfig(id) as Promise<AgentToolConfig | null>
  },

  createAgentToolConfig: (input: CreateAgentToolConfigInput): Promise<AgentToolConfig> => {
    return window.api.database.createAgentToolConfig(input) as Promise<AgentToolConfig>
  },

  updateAgentToolConfig: (
    id: string,
    updates: UpdateAgentToolConfigInput
  ): Promise<AgentToolConfig | null> => {
    return window.api.database.updateAgentToolConfig(id, updates) as Promise<AgentToolConfig | null>
  },

  deleteAgentToolConfig: (id: string): Promise<boolean> => {
    return window.api.database.deleteAgentToolConfig(id) as Promise<boolean>
  },

  setDefaultAgentToolConfig: (id: string): Promise<AgentToolConfig | null> => {
    return window.api.database.setDefaultAgentToolConfig(id) as Promise<AgentToolConfig | null>
  },

  getTaskNodes: (taskId: string): Promise<TaskNode[]> => {
    return window.api.database.getTaskNodes(taskId) as Promise<TaskNode[]>
  },

  getTaskNode: (nodeId: string): Promise<TaskNode | null> => {
    return window.api.database.getTaskNode(nodeId) as Promise<TaskNode | null>
  },

  getCurrentTaskNode: (taskId: string): Promise<TaskNode | null> => {
    return window.api.database.getCurrentTaskNode(taskId) as Promise<TaskNode | null>
  },

  updateCurrentTaskNodeRuntime: (
    taskId: string,
    updates: {
      session_id?: string | null
      resume_session_id?: string | null
      cli_tool_id?: string | null
      agent_tool_config_id?: string | null
    }
  ): Promise<TaskNode | null> => {
    return window.api.database.updateCurrentTaskNodeRuntime(
      taskId,
      updates
    ) as Promise<TaskNode | null>
  },

  getTaskNodesByStatus: (taskId: string, status: TaskNodeStatus): Promise<TaskNode[]> => {
    return window.api.database.getTaskNodesByStatus(taskId, status) as Promise<TaskNode[]>
  },

  completeTaskNode: (
    nodeId: string,
    result?: {
      resultSummary?: string | null
      cost?: number | null
      duration?: number | null
      sessionId?: string | null
    }
  ): Promise<unknown> => {
    return window.api.database.completeTaskNode(nodeId, result) as Promise<unknown>
  },

  markTaskNodeErrorReview: (nodeId: string, error: string): Promise<unknown> => {
    return window.api.database.markTaskNodeErrorReview(nodeId, error) as Promise<unknown>
  },

  approveTaskNode: (nodeId: string): Promise<unknown> => {
    return window.api.database.approveTaskNode(nodeId) as Promise<unknown>
  },

  rerunTaskNode: (nodeId: string): Promise<unknown> => {
    return window.api.database.rerunTaskNode(nodeId) as Promise<unknown>
  },

  stopTaskNodeExecution: (nodeId: string, reason?: string): Promise<unknown> => {
    return window.api.database.stopTaskNodeExecution(nodeId, reason) as Promise<unknown>
  },

  startTaskExecution: (taskId: string): Promise<unknown> => {
    return window.api.task.startExecution(taskId) as Promise<unknown>
  },

  stopTaskExecution: (taskId: string): Promise<unknown> => {
    return window.api.task.stopExecution(taskId) as Promise<unknown>
  },

  getWorkflowRunByTask: (taskId: string): Promise<WorkflowRun | null> => {
    return window.api.workflow.getRunByTask(taskId) as Promise<WorkflowRun | null>
  },

  listWorkflowRunNodes: (runId: string): Promise<WorkflowRunNode[]> => {
    return window.api.workflow.listRunNodes(runId) as Promise<WorkflowRunNode[]>
  },

  listWorkflowDefinitions: (filter?: {
    scope?: 'global' | 'project'
    projectId?: string | null
  }): Promise<WorkflowDefinition[]> => {
    return window.api.workflow.listDefinitions(filter) as Promise<WorkflowDefinition[]>
  },

  getWorkflowDefinition: (id: string): Promise<WorkflowDefinition | null> => {
    return window.api.workflow.getDefinition(id) as Promise<WorkflowDefinition | null>
  },

  generateWorkflowDefinition: (
    input: GenerateWorkflowDefinitionInput
  ): Promise<GeneratedWorkflowDefinitionResult> => {
    return window.api.workflow.generateDefinition(
      input
    ) as Promise<GeneratedWorkflowDefinitionResult>
  },

  optimizePrompt: (input: OptimizePromptInput): Promise<OptimizePromptResult> => {
    return window.api.prompt.optimize(input) as Promise<OptimizePromptResult>
  },

  createWorkflowDefinition: (input: CreateWorkflowDefinitionInput): Promise<WorkflowDefinition> => {
    return window.api.workflow.createDefinition(input) as Promise<WorkflowDefinition>
  },

  updateWorkflowDefinition: (input: UpdateWorkflowDefinitionInput): Promise<WorkflowDefinition> => {
    return window.api.workflow.updateDefinition(input) as Promise<WorkflowDefinition>
  },

  deleteWorkflowDefinition: (id: string): Promise<boolean> => {
    return window.api.workflow.deleteDefinition(id) as Promise<boolean>
  },

  createAutomation: (input: CreateAutomationRequest): Promise<Automation> => {
    return window.api.automation.create(input) as Promise<Automation>
  },

  updateAutomation: (id: string, updates: UpdateAutomationRequest): Promise<Automation | null> => {
    return window.api.automation.update(id, updates) as Promise<Automation | null>
  },

  deleteAutomation: (id: string): Promise<boolean> => {
    return window.api.automation.delete(id)
  },

  getAutomation: (id: string): Promise<Automation | null> => {
    return window.api.automation.get(id) as Promise<Automation | null>
  },

  listAutomations: (): Promise<Automation[]> => {
    return window.api.automation.list() as Promise<Automation[]>
  },

  setAutomationEnabled: (id: string, enabled: boolean): Promise<Automation | null> => {
    return window.api.automation.setEnabled(id, enabled) as Promise<Automation | null>
  },

  runAutomationNow: (id: string): Promise<RunAutomationNowResult> => {
    return window.api.automation.runNow(id) as Promise<RunAutomationNowResult>
  },

  listAutomationRuns: (automationId: string, limit = 100): Promise<AutomationRun[]> => {
    return window.api.automation.listRuns(automationId, limit) as Promise<AutomationRun[]>
  }
}
