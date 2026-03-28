import type Database from 'better-sqlite3'
import { getAppPaths } from '../app/AppPaths'
import { DatabaseConnection } from './database/DatabaseConnection'
import { TaskRepository } from './database/TaskRepository'
import { ProjectRepository } from './database/ProjectRepository'
import { WorkflowDefinitionRepository } from './database/WorkflowDefinitionRepository'
import { WorkflowRunRepository } from './database/WorkflowRunRepository'
import { WorkflowRunNodeRepository } from './database/WorkflowRunNodeRepository'
import { WorkflowRunReviewRepository } from './database/WorkflowRunReviewRepository'
import { AgentToolConfigRepository } from './database/AgentToolConfigRepository'
import { AutomationRepository } from './database/AutomationRepository'
import { WorkflowDefinitionGenerationService } from './WorkflowDefinitionGenerationService'
import { WorkflowDefinitionService } from './WorkflowDefinitionService'
import { WorkflowRunService } from './WorkflowRunService'
import { PromptOptimizationService } from './PromptOptimizationService'
import { AgentToolProfileService } from './AgentToolProfileService'
import { WorkflowRunLifecycleService } from './WorkflowRunLifecycleService'
import { AiAuthoringService } from './AiAuthoringService'
import { TaskNodeRuntimeService } from './TaskNodeRuntimeService'
import type { WorkflowSchedulerService } from './WorkflowSchedulerService'
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
  CreateWorkflowDefinitionInput,
  GenerateWorkflowDefinitionInput,
  GeneratedWorkflowDefinitionResult,
  UpdateWorkflowDefinitionInput,
  WorkflowDefinition
} from '../types/workflow-definition'
import type { OptimizePromptInput, OptimizePromptResult } from '../types/prompt-optimization'
import type { WorkflowRun, WorkflowRunNode } from '../types/workflow-run'

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
  private projectRepo: ProjectRepository
  private workflowRunNodeRepo: WorkflowRunNodeRepository
  private agentToolConfigRepo: AgentToolConfigRepository
  private agentToolProfileService: AgentToolProfileService
  private automationRepo: AutomationRepository
  private workflowDefinitionService: WorkflowDefinitionService
  private workflowDefinitionGenerationService: WorkflowDefinitionGenerationService
  private promptOptimizationService: PromptOptimizationService
  private aiAuthoringService: AiAuthoringService
  private workflowRunService: WorkflowRunService
  private workflowRunLifecycleService: WorkflowRunLifecycleService
  private taskNodeRuntimeService: TaskNodeRuntimeService
  private dbPath: string

  constructor() {
    const appPaths = getAppPaths()
    this.dbPath = appPaths.getDatabaseFile()
    console.log('[DatabaseService] Initializing database at:', this.dbPath)

    this.connection = new DatabaseConnection(this.dbPath)
    this.db = this.connection.open()
    this.connection.initTables()

    this.taskRepo = new TaskRepository(this.db)
    this.projectRepo = new ProjectRepository(this.db)
    const workflowDefinitionRepo = new WorkflowDefinitionRepository(this.db)
    const workflowRunRepo = new WorkflowRunRepository(this.db)
    this.workflowRunNodeRepo = new WorkflowRunNodeRepository(this.db)
    const workflowRunReviewRepo = new WorkflowRunReviewRepository(this.db)
    this.agentToolConfigRepo = new AgentToolConfigRepository(this.db)
    this.agentToolProfileService = new AgentToolProfileService(this.agentToolConfigRepo)
    this.automationRepo = new AutomationRepository(this.db)
    this.workflowDefinitionService = new WorkflowDefinitionService(workflowDefinitionRepo)
    this.workflowDefinitionGenerationService = new WorkflowDefinitionGenerationService()
    this.promptOptimizationService = new PromptOptimizationService()
    this.aiAuthoringService = new AiAuthoringService(
      this.workflowDefinitionGenerationService,
      this.promptOptimizationService,
      this.agentToolProfileService
    )
    this.workflowRunService = new WorkflowRunService(
      this.taskRepo,
      workflowDefinitionRepo,
      workflowRunRepo,
      this.workflowRunNodeRepo,
      workflowRunReviewRepo
    )
    this.taskNodeRuntimeService = new TaskNodeRuntimeService(
      this.taskRepo,
      this.workflowRunService,
      this.workflowRunNodeRepo
    )
    this.workflowRunLifecycleService = new WorkflowRunLifecycleService(
      this.workflowRunService,
      this.workflowRunNodeRepo,
      {
        getTaskNode: (nodeId) => this.taskNodeRuntimeService.getTaskNode(nodeId),
        notifyTaskNodeStatusChange: (node) =>
          this.taskNodeRuntimeService.notifyTaskNodeStatusChange(node)
      }
    )
  }

  onTaskNodeStatusChange(listener: (node: TaskNode) => void): () => void {
    return this.taskNodeRuntimeService.onTaskNodeStatusChange(listener)
  }

  setWorkflowSchedulerService(service: WorkflowSchedulerService): void {
    this.taskNodeRuntimeService.setWorkflowSchedulerService(service)
    this.workflowRunLifecycleService.setWorkflowSchedulerService(service)
  }

  getAgentToolProfileService(): AgentToolProfileService {
    return this.agentToolProfileService
  }

  getWorkflowRunLifecycleService(): WorkflowRunLifecycleService {
    return this.workflowRunLifecycleService
  }

  getTaskNodeRuntimeService(): TaskNodeRuntimeService {
    return this.taskNodeRuntimeService
  }

  getWorkflowDefinitionService(): WorkflowDefinitionService {
    return this.workflowDefinitionService
  }

  getWorkflowDefinitionGenerationService(): WorkflowDefinitionGenerationService {
    return this.workflowDefinitionGenerationService
  }

  getPromptOptimizationService(): PromptOptimizationService {
    return this.promptOptimizationService
  }

  getAiAuthoringService(): AiAuthoringService {
    return this.aiAuthoringService
  }

  // ============ Task 操作 ============
  createTask(input: CreateTaskInput): Task {
    const task = this.taskRepo.createTask(input)
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

  getTaskNodes(taskId: string): TaskNode[] {
    return this.taskNodeRuntimeService.getTaskNodes(taskId)
  }

  getTaskNode(nodeId: string): TaskNode | null {
    return this.taskNodeRuntimeService.getTaskNode(nodeId)
  }

  getCurrentTaskNode(taskId: string): TaskNode | null {
    return this.taskNodeRuntimeService.getCurrentTaskNode(taskId)
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
    return this.taskNodeRuntimeService.updateCurrentTaskNodeRuntime(taskId, updates)
  }

  updateTaskNodeResumeSessionId(nodeId: string, resumeSessionId: string | null): TaskNode | null {
    return this.taskNodeRuntimeService.updateTaskNodeResumeSessionId(nodeId, resumeSessionId)
  }

  getTaskNodesByStatus(taskId: string, status: TaskNodeStatus): TaskNode[] {
    return this.taskNodeRuntimeService.getTaskNodesByStatus(taskId, status)
  }

  getInProgressTaskNodes(): TaskNode[] {
    return this.taskNodeRuntimeService.getInProgressTaskNodes()
  }

  updateTaskNodeSession(nodeId: string, sessionId: string | null): TaskNode | null {
    return this.taskNodeRuntimeService.updateTaskNodeSession(nodeId, sessionId)
  }

  startTaskExecution(taskId: string): TaskNode | null {
    return this.taskNodeRuntimeService.startTaskExecution(taskId)
  }

  stopTaskExecution(taskId: string): TaskNode | null {
    return this.taskNodeRuntimeService.stopTaskExecution(taskId)
  }

  stopTaskNodeExecution(nodeId: string, reason?: string): TaskNode | null {
    return this.taskNodeRuntimeService.stopTaskNodeExecution(nodeId, reason)
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
    return this.taskNodeRuntimeService.completeTaskNode(nodeId, result)
  }

  markTaskNodeErrorReview(nodeId: string, error: string): TaskNode | null {
    return this.taskNodeRuntimeService.markTaskNodeErrorReview(nodeId, error)
  }

  approveTaskNode(nodeId: string): TaskNode | null {
    return this.taskNodeRuntimeService.approveTaskNode(nodeId)
  }

  rerunTaskNode(nodeId: string): TaskNode | null {
    return this.taskNodeRuntimeService.rerunTaskNode(nodeId)
  }

  getTaskIdBySessionId(sessionId: string): string | null {
    return this.taskNodeRuntimeService.getTaskIdBySessionId(sessionId)
  }

  getCombinedPromptForTaskNode(taskNodeId: string): string | null {
    return this.taskNodeRuntimeService.getCombinedPromptForTaskNode(taskNodeId)
  }

  // ============ Agent Tool Config 操作 ============
  listAgentToolConfigs(toolId?: string) {
    return this.agentToolProfileService.list(toolId)
  }

  getAgentToolConfig(id: string) {
    return this.agentToolProfileService.get(id)
  }

  getDefaultAgentToolConfig(toolId: string) {
    return this.agentToolProfileService.getDefault(toolId)
  }

  createAgentToolConfig(input: {
    id: string
    tool_id: string
    name: string
    description?: string | null
    config_json: string
    is_default?: number
  }) {
    return this.agentToolProfileService.create(input)
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
    return this.agentToolProfileService.update(id, updates)
  }

  deleteAgentToolConfig(id: string) {
    return this.agentToolProfileService.delete(id)
  }

  setDefaultAgentToolConfig(id: string) {
    return this.agentToolProfileService.setDefault(id)
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
    this.workflowDefinitionService.deleteDefinitionsByProject(id)

    return this.projectRepo.deleteProject(id)
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

  async generateWorkflowDefinition(
    input: GenerateWorkflowDefinitionInput
  ): Promise<GeneratedWorkflowDefinitionResult> {
    return await this.aiAuthoringService.generateWorkflowDefinition(input)
  }

  async optimizePrompt(input: OptimizePromptInput): Promise<OptimizePromptResult> {
    return await this.aiAuthoringService.optimizePrompt(input)
  }

  updateWorkflowDefinition(input: UpdateWorkflowDefinitionInput): WorkflowDefinition {
    return this.workflowDefinitionService.updateDefinition(input)
  }

  deleteWorkflowDefinition(id: string): boolean {
    return this.workflowDefinitionService.deleteDefinition(id)
  }

  createWorkflowRunForTask(input: {
    taskId: string
    workflowDefinitionId?: string | null
    definition?: import('../types/workflow-definition').WorkflowDefinitionDocument
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
    return await this.workflowRunLifecycleService.startRun(workflowRunId)
  }

  approveWorkflowRunNode(
    workflowRunNodeId: string,
    input?: {
      comment?: string | null
      reviewed_by?: string | null
      reviewed_at?: string
    }
  ): WorkflowRunNode | null {
    return this.workflowRunLifecycleService.approveNode(workflowRunNodeId, input)
  }

  retryWorkflowRunNode(workflowRunNodeId: string): WorkflowRunNode | null {
    return this.workflowRunLifecycleService.retryNode(workflowRunNodeId)
  }

  async stopWorkflowRun(workflowRunId: string): Promise<WorkflowRun | null> {
    return await this.workflowRunLifecycleService.stopRun(workflowRunId)
  }

  markWorkflowRunStarted(workflowRunId: string): WorkflowRun | null {
    return this.workflowRunLifecycleService.markRunStarted(workflowRunId)
  }

  markWorkflowRunStopped(workflowRunId: string): WorkflowRun | null {
    return this.workflowRunLifecycleService.markRunStopped(workflowRunId)
  }

  markWorkflowRunNodeRunning(nodeId: string): WorkflowRunNode | null {
    return this.workflowRunLifecycleService.markNodeRunning(nodeId)
  }

  syncWorkflowRunStatus(workflowRunId: string): WorkflowRun | null {
    return this.workflowRunLifecycleService.syncRunStatus(workflowRunId)
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

  // ============ 清理和关闭 ============
  close(): void {
    console.log('[DatabaseService] Closing database connection')
    this.connection.close()
  }

  dispose(): void {
    this.close()
  }
}
