import type Database from 'better-sqlite3'
import { getAppPaths } from '../app/AppPaths'
import { newUlid } from '../utils/ids'
import { TaskExecutionService } from './TaskExecutionService'
import { DatabaseConnection } from './database/DatabaseConnection'
import { TaskRepository } from './database/TaskRepository'
import { ProjectRepository } from './database/ProjectRepository'
import { WorkflowRepository } from './database/WorkflowRepository'
import { WorkflowDefinitionRepository } from './database/WorkflowDefinitionRepository'
import { WorkflowRunRepository } from './database/WorkflowRunRepository'
import { WorkflowRunNodeRepository } from './database/WorkflowRunNodeRepository'
import { WorkflowRunReviewRepository } from './database/WorkflowRunReviewRepository'
import { TaskNodeRepository } from './database/TaskNodeRepository'
import { AgentToolConfigRepository } from './database/AgentToolConfigRepository'
import { AutomationRepository } from './database/AutomationRepository'
import { WorkflowDefinitionGenerationService } from './WorkflowDefinitionGenerationService'
import { WorkflowDefinitionService } from './WorkflowDefinitionService'
import { WorkflowRunService } from './WorkflowRunService'
import type { WorkflowSchedulerService } from './WorkflowSchedulerService'
import {
  getWorkflowCurrentNodeId,
  getWorkflowNodeOrderMap
} from './workflow-graph'
import type { CreateProjectInput, Project, UpdateProjectInput } from '../types/project'
import type {
  CreateTaskInput,
  Task,
  TaskNode,
  TaskNodeStatus,
  UpdateTaskInput
} from '../types/task'
import type {
  Automation,
  AutomationRun,
  CreateAutomationInput,
  UpdateAutomationInput,
  UpdateAutomationRunInput,
  ReservedAutomationRun
} from '../types/automation'
import type {
  CreateWorkflowTemplateInput,
  UpdateWorkflowTemplateInput,
  WorkflowTemplate
} from '../types/workflow'
import type {
  CreateWorkflowDefinitionInput,
  GenerateWorkflowDefinitionInput,
  GeneratedWorkflowDefinitionResult,
  UpdateWorkflowDefinitionInput,
  WorkflowDefinition
} from '../types/workflow-definition'
import type { WorkflowRun, WorkflowRunNode } from '../types/workflow-run'

const TASK_NODE_STATUS_VALUES = ['todo', 'in_progress', 'in_review', 'done', 'failed'] as const
type TaskNodeStatusValue = (typeof TASK_NODE_STATUS_VALUES)[number]

export const composeTaskNodePrompt = (
  taskPrompt: string | null | undefined,
  nodePrompt: string | null | undefined
): string => {
  const basePrompt = taskPrompt ?? ''
  const templatePrompt = nodePrompt ?? ''

  if (basePrompt && templatePrompt) {
    return `${basePrompt}\n\n${templatePrompt}`
  }

  return basePrompt || templatePrompt
}

export class DatabaseService {
  private db: Database.Database
  private connection: DatabaseConnection
  private taskRepo: TaskRepository
  private taskNodeRepo: TaskNodeRepository
  private projectRepo: ProjectRepository
  private workflowRepo: WorkflowRepository
  private workflowRunNodeRepo: WorkflowRunNodeRepository
  private agentToolConfigRepo: AgentToolConfigRepository
  private automationRepo: AutomationRepository
  private taskExecutionService: TaskExecutionService
  private workflowDefinitionService: WorkflowDefinitionService
  private workflowDefinitionGenerationService: WorkflowDefinitionGenerationService
  private workflowRunService: WorkflowRunService
  private workflowSchedulerService: WorkflowSchedulerService | null = null
  private taskNodeStatusListeners: Array<(node: TaskNode) => void> = []
  private dbPath: string

  constructor() {
    const appPaths = getAppPaths()
    this.dbPath = appPaths.getDatabaseFile()
    console.log('[DatabaseService] Initializing database at:', this.dbPath)

    this.connection = new DatabaseConnection(this.dbPath)
    this.db = this.connection.open()
    this.connection.initTables()

    this.taskRepo = new TaskRepository(this.db)
    this.taskNodeRepo = new TaskNodeRepository(this.db)
    this.projectRepo = new ProjectRepository(this.db)
    this.workflowRepo = new WorkflowRepository(this.db)
    const workflowDefinitionRepo = new WorkflowDefinitionRepository(this.db)
    const workflowRunRepo = new WorkflowRunRepository(this.db)
    this.workflowRunNodeRepo = new WorkflowRunNodeRepository(this.db)
    const workflowRunReviewRepo = new WorkflowRunReviewRepository(this.db)
    this.agentToolConfigRepo = new AgentToolConfigRepository(this.db)
    this.automationRepo = new AutomationRepository(this.db)
    this.taskExecutionService = new TaskExecutionService(this.taskRepo, this.taskNodeRepo)
    this.workflowDefinitionService = new WorkflowDefinitionService(workflowDefinitionRepo)
    this.workflowDefinitionGenerationService = new WorkflowDefinitionGenerationService()
    this.workflowRunService = new WorkflowRunService(
      this.taskRepo,
      workflowDefinitionRepo,
      workflowRunRepo,
      this.workflowRunNodeRepo,
      workflowRunReviewRepo
    )
  }

  onTaskNodeStatusChange(listener: (node: TaskNode) => void): () => void {
    this.taskNodeStatusListeners.push(listener)
    return () => {
      this.taskNodeStatusListeners = this.taskNodeStatusListeners.filter(
        (registered) => registered !== listener
      )
    }
  }

  setWorkflowSchedulerService(service: WorkflowSchedulerService): void {
    this.workflowSchedulerService = service
  }

  // ============ Task 操作 ============
  createTask(input: CreateTaskInput): Task {
    const task = this.taskRepo.createTask(input)

    const existingNodes = this.taskNodeRepo.getTaskNodes(task.id)
    if (existingNodes.length === 0 && task.task_mode === 'conversation') {
      this.taskNodeRepo.createConversationNode({
        task_id: task.id,
        prompt: task.prompt
      })

      this.taskExecutionService.syncTaskStatus(task.id)
    }

    return this.taskRepo.getTask(task.id)!
  }

  getTask(id: string): Task | null {
    return this.taskRepo.getTask(id)
  }

  getAllTasks(): Task[] {
    return this.taskRepo.getAllTasks()
  }

  getTasksByProjectId(projectId: string): Task[] {
    return this.taskRepo.getTasksByProjectId(projectId)
  }

  updateTask(id: string, updates: UpdateTaskInput): Task | null {
    return this.taskRepo.updateTask(id, updates)
  }

  deleteTask(id: string): boolean {
    return this.taskRepo.deleteTask(id)
  }

  // ============ Task Node 操作 ============
  createConversationNode(
    taskId: string,
    prompt: string,
    cliToolId?: string | null,
    agentToolConfigId?: string | null
  ): TaskNode {
    const node = this.taskNodeRepo.createConversationNode({
      task_id: taskId,
      prompt,
      cli_tool_id: cliToolId ?? null,
      agent_tool_config_id: agentToolConfigId ?? null
    })
    this.taskExecutionService.syncTaskStatus(taskId)
    this.notifyTaskNodeStatusChange(node)
    return node
  }

  createTaskNodesFromTemplate(
    taskId: string,
    templateId: string,
    fallbackRuntime?: {
      cliToolId?: string | null
      agentToolConfigId?: string | null
    }
  ): TaskNode[] {
    const template = this.getWorkflowTemplate(templateId)
    if (!template) {
      throw new Error(`Workflow template not found: ${templateId}`)
    }

    const task = this.getTask(taskId)
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }

    const nodes = template.nodes
      .slice()
      .sort((left, right) => left.node_order - right.node_order)
      .map((node, index) => ({
        id: newUlid(),
        task_id: taskId,
        node_order: Number.isFinite(node.node_order) ? node.node_order : index + 1,
        name: node.name,
        prompt: composeTaskNodePrompt(task.prompt, node.prompt),
        cli_tool_id: node.cli_tool_id ?? fallbackRuntime?.cliToolId ?? null,
        agent_tool_config_id: node.agent_tool_config_id ?? fallbackRuntime?.agentToolConfigId ?? null,
        requires_approval: Boolean(node.requires_approval)
      }))

    const createdNodes = this.taskNodeRepo.createNodesFromTemplate(taskId, nodes)
    this.taskExecutionService.syncTaskStatus(taskId)
    return createdNodes
  }

  getTaskNodes(taskId: string): TaskNode[] {
    const workflowRun = this.workflowRunService.getRunByTask(taskId)
    if (workflowRun) {
      return this.mapWorkflowRunNodesToTaskNodes(workflowRun, this.workflowRunService.listRunNodes(workflowRun.id))
    }
    return this.taskNodeRepo.getTaskNodes(taskId)
  }

  getTaskNode(nodeId: string): TaskNode | null {
    const taskNode = this.taskNodeRepo.getTaskNode(nodeId)
    if (taskNode) return taskNode

    const workflowNode = this.workflowRunNodeRepo.getRunNode(nodeId)
    if (!workflowNode) return null

    const workflowRun = this.workflowRunService.getRun(workflowNode.workflow_run_id)
    if (!workflowRun) return null

    const orderMap = getWorkflowNodeOrderMap(workflowRun.definition_snapshot)
    return this.mapWorkflowRunNodeToTaskNode(workflowRun.task_id, workflowNode, orderMap)
  }

  getCurrentTaskNode(taskId: string): TaskNode | null {
    const workflowRun = this.workflowRunService.getRunByTask(taskId)
    if (workflowRun) {
      const nodes = this.workflowRunService.listRunNodes(workflowRun.id)
      const currentNodeId = getWorkflowCurrentNodeId(workflowRun.definition_snapshot, nodes)
      if (!currentNodeId) return null

      const currentNode = nodes.find((node) => node.id === currentNodeId)
      if (!currentNode) return null

      const orderMap = getWorkflowNodeOrderMap(workflowRun.definition_snapshot)
      return this.mapWorkflowRunNodeToTaskNode(taskId, currentNode, orderMap)
    }
    return this.taskNodeRepo.getCurrentTaskNode(taskId)
  }

  updateCurrentTaskNodeRuntime(
    taskId: string,
    updates: {
      session_id?: string | null
      resume_session_id?: string | null
      cli_tool_id?: string | null
      agent_tool_config_id?: string | null
    }
  ): TaskNode | null {
    const workflowRun = this.workflowRunService.getRunByTask(taskId)
    if (workflowRun) {
      const currentNode = this.getCurrentTaskNode(taskId)
      const updated = this.workflowRunNodeRepo.updateRunNodeRuntime(
        workflowRun.id,
        currentNode?.id ?? null,
        updates
      )
      if (updated) {
        this.notifyTaskNodeStatusChange(this.getTaskNode(updated.id)!)
      }
      return updated ? this.getTaskNode(updated.id) : null
    }

    const updated = this.taskNodeRepo.updateTaskNodeRuntime(taskId, updates)
    if (updated) {
      this.taskExecutionService.syncTaskStatus(updated.task_id)
      this.notifyTaskNodeStatusChange(updated)
    }
    return updated
  }

  updateTaskNodeResumeSessionId(nodeId: string, resumeSessionId: string | null): TaskNode | null {
    const workflowNode = this.workflowRunNodeRepo.getRunNode(nodeId)
    if (workflowNode) {
      const updated = this.workflowRunNodeRepo.setNodeResumeSessionId(nodeId, resumeSessionId)
      if (updated) {
        this.notifyTaskNodeStatusChange(this.getTaskNode(updated.id)!)
      }
      return updated ? this.getTaskNode(updated.id) : null
    }

    const updated = this.taskNodeRepo.setNodeResumeSessionId(nodeId, resumeSessionId)
    if (updated) {
      this.notifyTaskNodeStatusChange(updated)
    }
    return updated
  }

  getTaskNodesByStatus(taskId: string, status: TaskNodeStatus): TaskNode[] {
    if (!TASK_NODE_STATUS_VALUES.includes(status as TaskNodeStatusValue)) {
      throw new Error(`Unsupported task node status: ${status}`)
    }

    const workflowRun = this.workflowRunService.getRunByTask(taskId)
    if (workflowRun) {
      return this.getTaskNodes(taskId).filter((node) => node.status === status)
    }
    return this.taskNodeRepo.getTaskNodesByStatus(taskId, status)
  }

  getInProgressTaskNodes(): TaskNode[] {
    const taskNodes = this.taskNodeRepo.getInProgressNodes()
    const workflowNodes = this.workflowRunNodeRepo
      .getAllNodesByStatus('running')
      .map((node) => {
        const run = this.workflowRunService.getRun(node.workflow_run_id)
        if (!run) return null
        return this.mapWorkflowRunNodeToTaskNode(
          run.task_id,
          node,
          getWorkflowNodeOrderMap(run.definition_snapshot)
        )
      })
      .filter((node): node is TaskNode => Boolean(node))

    return [...taskNodes, ...workflowNodes]
  }

  updateTaskNodeSession(nodeId: string, sessionId: string | null): TaskNode | null {
    const workflowNode = this.workflowRunNodeRepo.getRunNode(nodeId)
    if (workflowNode) {
      const updated = this.workflowRunNodeRepo.setNodeSessionId(nodeId, sessionId)
      if (updated) {
        this.notifyTaskNodeStatusChange(this.getTaskNode(updated.id)!)
      }
      return updated ? this.getTaskNode(updated.id) : null
    }

    const updated = this.taskNodeRepo.setNodeSessionId(nodeId, sessionId)
    if (updated) {
      this.taskExecutionService.syncTaskStatus(updated.task_id)
      this.notifyTaskNodeStatusChange(updated)
    }
    return updated
  }

  startTaskExecution(taskId: string): TaskNode | null {
    const updated = this.taskExecutionService.startTaskExecution(taskId)
    if (updated) this.notifyTaskNodeStatusChange(updated)
    return updated
  }

  stopTaskExecution(taskId: string): TaskNode | null {
    const updated = this.taskExecutionService.stopTaskExecution(taskId)
    if (updated) this.notifyTaskNodeStatusChange(updated)
    return updated
  }

  stopTaskNodeExecution(nodeId: string, reason?: string): TaskNode | null {
    const workflowNode = this.workflowRunNodeRepo.getRunNode(nodeId)
    if (workflowNode) {
      const updated = this.workflowRunNodeRepo.markFailed(
        nodeId,
        'cancelled',
        reason ?? 'stopped_by_user'
      )
      if (updated) {
        this.workflowRunService.syncRunStatus(updated.workflow_run_id)
        this.notifyTaskNodeStatusChange(this.getTaskNode(updated.id)!)
        void this.workflowSchedulerService?.onNodeUpdated(updated.id)
      }
      return updated ? this.getTaskNode(updated.id) : null
    }

    const updated = this.taskExecutionService.stopTaskNodeExecution(nodeId, reason)
    if (updated) this.notifyTaskNodeStatusChange(updated)
    return updated
  }

  completeTaskNode(
    nodeId: string,
    result: {
      resultSummary?: string | null
      cost?: number | null
      duration?: number | null
      sessionId?: string | null
      allowConversationCompletion?: boolean
    } = {}
  ): TaskNode | null {
    const workflowNode = this.workflowRunNodeRepo.getRunNode(nodeId)
    if (workflowNode) {
      const updated = workflowNode.requires_approval_after_run
        ? this.workflowRunNodeRepo.markReview(nodeId, {
            result_summary: result.resultSummary ?? null,
            cost: result.cost ?? null,
            duration: result.duration ?? null,
            session_id: result.sessionId ?? null
          })
        : this.workflowRunNodeRepo.markDone(nodeId, {
            result_summary: result.resultSummary ?? null,
            cost: result.cost ?? null,
            duration: result.duration ?? null,
            session_id: result.sessionId ?? null
          })

      if (updated) {
        this.workflowRunService.syncRunStatus(updated.workflow_run_id)
        const mapped = this.getTaskNode(updated.id)!
        this.notifyTaskNodeStatusChange(mapped)
        void this.workflowSchedulerService?.onNodeUpdated(updated.id)
        return mapped
      }
      return null
    }

    const updated = this.taskExecutionService.completeTaskNode(nodeId, result)
    if (updated) this.notifyTaskNodeStatusChange(updated)
    return updated
  }

  markTaskNodeErrorReview(nodeId: string, error: string): TaskNode | null {
    const workflowNode = this.workflowRunNodeRepo.getRunNode(nodeId)
    if (workflowNode) {
      const updated = this.workflowRunNodeRepo.markFailed(nodeId, 'execution_error', error)

      if (updated) {
        this.workflowRunService.syncRunStatus(updated.workflow_run_id)
        const mapped = this.getTaskNode(updated.id)!
        this.notifyTaskNodeStatusChange(mapped)
        void this.workflowSchedulerService?.onNodeUpdated(updated.id)
        return mapped
      }
      return null
    }

    const updated = this.taskExecutionService.markTaskNodeErrorReview(nodeId, error)
    if (updated) this.notifyTaskNodeStatusChange(updated)
    return updated
  }

  approveTaskNode(nodeId: string): TaskNode | null {
    const workflowNode = this.workflowRunNodeRepo.getRunNode(nodeId)
    if (workflowNode) {
      const updated = this.workflowRunService.approveNode(nodeId)
      if (updated) {
        const mapped = this.getTaskNode(updated.id)!
        this.notifyTaskNodeStatusChange(mapped)
        void this.workflowSchedulerService?.onNodeUpdated(updated.id)
        return mapped
      }
      return null
    }

    const updated = this.taskExecutionService.approveTaskNode(nodeId)
    if (updated) this.notifyTaskNodeStatusChange(updated)
    return updated
  }

  rerunTaskNode(nodeId: string): TaskNode | null {
    const workflowNode = this.workflowRunNodeRepo.getRunNode(nodeId)
    if (workflowNode) {
      const updated = this.workflowRunService.retryNode(nodeId)
      if (updated) {
        const mapped = this.getTaskNode(updated.id)!
        this.notifyTaskNodeStatusChange(mapped)
        void this.workflowSchedulerService?.onNodeUpdated(updated.id)
        return mapped
      }
      return null
    }

    const updated = this.taskExecutionService.rerunTaskNode(nodeId)
    if (updated) this.notifyTaskNodeStatusChange(updated)
    return updated
  }

  getTaskIdBySessionId(sessionId: string): string | null {
    return (
      this.taskNodeRepo.getTaskIdBySessionId(sessionId) ??
      this.workflowRunNodeRepo.getTaskIdBySessionId(sessionId)
    )
  }

  getCombinedPromptForTaskNode(taskNodeId: string): string | null {
    const node = this.getTaskNode(taskNodeId)
    if (!node) return null

    const nodePrompt = node.prompt?.trim()
    return nodePrompt || null
  }

  // ============ Agent Tool Config 操作 ============
  listAgentToolConfigs(toolId?: string) {
    return this.agentToolConfigRepo.list(toolId)
  }

  getAgentToolConfig(id: string) {
    return this.agentToolConfigRepo.get(id)
  }

  getDefaultAgentToolConfig(toolId: string) {
    return this.agentToolConfigRepo.getDefault(toolId)
  }

  createAgentToolConfig(input: {
    id: string
    tool_id: string
    name: string
    description?: string | null
    config_json: string
    is_default?: number
  }) {
    return this.agentToolConfigRepo.create(input)
  }

  updateAgentToolConfig(
    id: string,
    updates: {
      name?: string
      description?: string | null
      config_json?: string
      is_default?: number
    }
  ) {
    return this.agentToolConfigRepo.update(id, updates)
  }

  deleteAgentToolConfig(id: string) {
    return this.agentToolConfigRepo.delete(id)
  }

  setDefaultAgentToolConfig(id: string) {
    return this.agentToolConfigRepo.setDefault(id)
  }

  // ============ Project 操作 ============
  createProject(input: CreateProjectInput): Project {
    return this.projectRepo.createProject(input)
  }

  getProject(id: string): Project | null {
    return this.projectRepo.getProject(id)
  }

  getProjectByPath(path: string): Project | null {
    return this.projectRepo.getProjectByPath(path)
  }

  getAllProjects(): Project[] {
    return this.projectRepo.getAllProjects()
  }

  updateProject(id: string, updates: UpdateProjectInput): Project | null {
    return this.projectRepo.updateProject(id, updates)
  }

  deleteProject(id: string): boolean {
    const project = this.projectRepo.getProject(id)
    if (!project) return false

    this.taskRepo.deleteTasksByProjectId(id)
    this.workflowRepo.deleteWorkflowTemplatesByProject(id)
    this.workflowDefinitionService.deleteDefinitionsByProject(id)

    return this.projectRepo.deleteProject(id)
  }

  // ============ Workflow Template 操作 ============
  createWorkflowTemplate(input: CreateWorkflowTemplateInput): WorkflowTemplate {
    return this.workflowRepo.createWorkflowTemplate(input)
  }

  getGlobalWorkflowTemplates(): WorkflowTemplate[] {
    return this.workflowRepo.getGlobalWorkflowTemplates()
  }

  getWorkflowTemplatesByProject(projectId: string): WorkflowTemplate[] {
    return this.workflowRepo.getWorkflowTemplatesByProject(projectId)
  }

  getWorkflowTemplate(id: string): WorkflowTemplate | null {
    return this.workflowRepo.getWorkflowTemplate(id)
  }

  updateWorkflowTemplate(input: UpdateWorkflowTemplateInput): WorkflowTemplate {
    return this.workflowRepo.updateWorkflowTemplate(input)
  }

  deleteWorkflowTemplate(id: string, scope: 'global' | 'project'): boolean {
    return this.workflowRepo.deleteWorkflowTemplate(id, scope)
  }

  copyGlobalWorkflowToProject(globalTemplateId: string, projectId: string): WorkflowTemplate {
    return this.workflowRepo.copyGlobalWorkflowToProject(globalTemplateId, projectId)
  }

  // ============ Workflow Definition / Run 操作 ============
  listWorkflowDefinitions(filter?: {
    scope?: 'global' | 'project'
    projectId?: string | null
  }): WorkflowDefinition[] {
    return this.workflowDefinitionService.listDefinitions(filter)
  }

  getWorkflowDefinition(id: string): WorkflowDefinition | null {
    return this.workflowDefinitionService.getDefinition(id)
  }

  createWorkflowDefinition(input: CreateWorkflowDefinitionInput): WorkflowDefinition {
    return this.workflowDefinitionService.createDefinition(input)
  }

  generateWorkflowDefinition(
    input: GenerateWorkflowDefinitionInput
  ): GeneratedWorkflowDefinitionResult {
    return this.workflowDefinitionGenerationService.generateDefinition(input)
  }

  updateWorkflowDefinition(input: UpdateWorkflowDefinitionInput): WorkflowDefinition {
    return this.workflowDefinitionService.updateDefinition(input)
  }

  deleteWorkflowDefinition(id: string): boolean {
    return this.workflowDefinitionService.deleteDefinition(id)
  }

  createWorkflowRunForTask(input: {
    taskId: string
    workflowDefinitionId: string
  }): WorkflowRun {
    return this.workflowRunService.createRunForTask(input)
  }

  getWorkflowRun(id: string): WorkflowRun | null {
    return this.workflowRunService.getRun(id)
  }

  getWorkflowRunByTask(taskId: string): WorkflowRun | null {
    return this.workflowRunService.getRunByTask(taskId)
  }

  listWorkflowRunNodes(workflowRunId: string): WorkflowRunNode[] {
    return this.workflowRunService.listRunNodes(workflowRunId)
  }

  getWorkflowRunNode(nodeId: string): WorkflowRunNode | null {
    return this.workflowRunNodeRepo.getRunNode(nodeId)
  }

  listRunningWorkflowNodes(): WorkflowRunNode[] {
    return this.workflowRunNodeRepo.getAllNodesByStatus('running')
  }

  async startWorkflowRun(workflowRunId: string): Promise<WorkflowRun | null> {
    await this.workflowSchedulerService?.startRun(workflowRunId)
    return this.workflowRunService.getRun(workflowRunId)
  }

  approveWorkflowRunNode(
    workflowRunNodeId: string,
    input?: {
      comment?: string | null
      reviewed_by?: string | null
      reviewed_at?: string
    }
  ): WorkflowRunNode | null {
    const updated = this.workflowRunService.approveNode(workflowRunNodeId, input)
    if (updated) {
      this.notifyTaskNodeStatusChange(this.getTaskNode(updated.id)!)
      void this.workflowSchedulerService?.onNodeUpdated(updated.id)
    }
    return updated
  }

  retryWorkflowRunNode(workflowRunNodeId: string): WorkflowRunNode | null {
    const updated = this.workflowRunService.retryNode(workflowRunNodeId)
    if (updated) {
      this.notifyTaskNodeStatusChange(this.getTaskNode(updated.id)!)
      void this.workflowSchedulerService?.onNodeUpdated(updated.id)
    }
    return updated
  }

  async stopWorkflowRun(workflowRunId: string): Promise<WorkflowRun | null> {
    if (this.workflowSchedulerService) {
      await this.workflowSchedulerService.stopRun(workflowRunId)
      return this.workflowRunService.getRun(workflowRunId)
    }
    return this.workflowRunService.stopRun(workflowRunId)
  }

  markWorkflowRunStarted(workflowRunId: string): WorkflowRun | null {
    return this.workflowRunService.startRun(workflowRunId)
  }

  markWorkflowRunStopped(workflowRunId: string): WorkflowRun | null {
    return this.workflowRunService.stopRun(workflowRunId)
  }

  markWorkflowRunNodeRunning(nodeId: string): WorkflowRunNode | null {
    const updated = this.workflowRunNodeRepo.markRunning(nodeId)
    if (updated) {
      this.workflowRunService.syncRunStatus(updated.workflow_run_id)
      this.notifyTaskNodeStatusChange(this.getTaskNode(updated.id)!)
      return updated
    }
    return null
  }

  syncWorkflowRunStatus(workflowRunId: string): WorkflowRun | null {
    return this.workflowRunService.syncRunStatus(workflowRunId)
  }

  // ============ Automation 操作 =========
  createAutomation(input: CreateAutomationInput): Automation {
    return this.automationRepo.createAutomation(input)
  }

  getAutomation(id: string): Automation | null {
    return this.automationRepo.getAutomation(id)
  }

  listAutomations(): Automation[] {
    return this.automationRepo.listAutomations()
  }

  updateAutomation(id: string, updates: UpdateAutomationInput): Automation | null {
    return this.automationRepo.updateAutomation(id, updates)
  }

  deleteAutomation(id: string): boolean {
    return this.automationRepo.deleteAutomation(id)
  }

  setAutomationEnabled(id: string, enabled: boolean): Automation | null {
    return this.automationRepo.setAutomationEnabled(id, enabled)
  }

  listDueAutomations(referenceTimeIso: string): Automation[] {
    return this.automationRepo.listDueAutomations(referenceTimeIso)
  }

  reserveDueAutomationRun(params: {
    automationId: string
    expectedScheduledAt: string
    nextRunAt: string
    triggeredAt: string
  }): ReservedAutomationRun | null {
    return this.automationRepo.reserveDueAutomationRun(params)
  }

  getRunningAutomationRun(automationId: string): AutomationRun | null {
    return this.automationRepo.getRunningRunByAutomationId(automationId)
  }

  createAutomationRun(input: {
    automation_id: string
    scheduled_at: string
    triggered_at: string
    status: 'running' | 'success' | 'failed' | 'skipped'
    task_id?: string | null
    task_node_id?: string | null
    session_id?: string | null
    error_message?: string | null
    finished_at?: string | null
  }): AutomationRun {
    return this.automationRepo.createAutomationRun(input)
  }

  updateAutomationRun(id: string, updates: UpdateAutomationRunInput): AutomationRun | null {
    return this.automationRepo.updateAutomationRun(id, updates)
  }

  getAutomationRun(id: string): AutomationRun | null {
    return this.automationRepo.getAutomationRun(id)
  }

  listAutomationRuns(automationId: string, limit = 100): AutomationRun[] {
    return this.automationRepo.listAutomationRuns(automationId, limit)
  }

  updateAutomationLastRun(
    automationId: string,
    updates: {
      last_run_at?: string | null
      last_status?: 'running' | 'success' | 'failed' | 'skipped' | null
    }
  ): Automation | null {
    return this.automationRepo.updateAutomationLastRun(automationId, updates)
  }

  markStaleRunningAutomationRunsFailed(errorMessage = 'interrupted_by_app_restart'): number {
    return this.automationRepo.markStaleRunningRunsFailed(errorMessage)
  }

  private mapWorkflowRunNodesToTaskNodes(run: WorkflowRun, nodes: WorkflowRunNode[]): TaskNode[] {
    const orderMap = getWorkflowNodeOrderMap(run.definition_snapshot)
    return nodes
      .map((node) => this.mapWorkflowRunNodeToTaskNode(run.task_id, node, orderMap))
      .sort((left, right) => left.node_order - right.node_order)
  }

  private mapWorkflowRunNodeToTaskNode(
    taskId: string,
    node: WorkflowRunNode,
    orderMap: Map<string, number>
  ): TaskNode {
    return {
      id: node.id,
      task_id: taskId,
      node_order: orderMap.get(node.definition_node_id) ?? Number.MAX_SAFE_INTEGER,
      name: node.name,
      prompt: node.prompt ?? node.command ?? '',
      cli_tool_id: node.cli_tool_id,
      agent_tool_config_id: node.agent_tool_config_id,
      requires_approval: node.requires_approval_after_run ? 1 : 0,
      status: this.mapWorkflowNodeStatusToTaskNodeStatus(node.status),
      session_id: node.session_id,
      resume_session_id: node.resume_session_id,
      result_summary: node.result_summary,
      error_message: node.error_message,
      cost: node.cost,
      duration: node.duration,
      started_at: node.started_at,
      completed_at: node.completed_at,
      created_at: node.created_at,
      updated_at: node.updated_at
    }
  }

  private mapWorkflowNodeStatusToTaskNodeStatus(status: WorkflowRunNode['status']): TaskNodeStatus {
    switch (status) {
      case 'waiting':
        return 'todo'
      case 'running':
        return 'in_progress'
      case 'review':
        return 'in_review'
      case 'done':
        return 'done'
      case 'failed':
        return 'failed'
    }
  }


  // ============ 清理和关闭 ============
  close(): void {
    console.log('[DatabaseService] Closing database connection')
    this.connection.close()
  }

  dispose(): void {
    this.close()
  }

  private notifyTaskNodeStatusChange(node: TaskNode): void {
    this.taskNodeStatusListeners.forEach((listener) => {
      try {
        listener(node)
      } catch (error) {
        console.error('[DatabaseService] Task node status listener failed:', error)
      }
    })
  }
}
