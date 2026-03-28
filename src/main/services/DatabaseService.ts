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
import { WorkflowDefinitionService } from './WorkflowDefinitionService'
import { WorkflowRunService } from './WorkflowRunService'
import type { CreateProjectInput, Project, UpdateProjectInput } from '../types/project'
import type {
  CreateTaskInput,
  Task,
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
  UpdateWorkflowDefinitionInput,
  WorkflowDefinition
} from '../types/workflow-definition'
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
  private automationRepo: AutomationRepository
  private workflowDefinitionService: WorkflowDefinitionService
  private workflowRunService: WorkflowRunService
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
    this.automationRepo = new AutomationRepository(this.db)
    this.workflowDefinitionService = new WorkflowDefinitionService(workflowDefinitionRepo)
    this.workflowRunService = new WorkflowRunService(
      this.taskRepo,
      workflowDefinitionRepo,
      workflowRunRepo,
      this.workflowRunNodeRepo,
      workflowRunReviewRepo
    )
  }

  getWorkflowDefinitionService(): WorkflowDefinitionService {
    return this.workflowDefinitionService
  }

  getTaskRepository(): TaskRepository {
    return this.taskRepo
  }

  getWorkflowRunService(): WorkflowRunService {
    return this.workflowRunService
  }

  getWorkflowRunNodeRepository(): WorkflowRunNodeRepository {
    return this.workflowRunNodeRepo
  }

  getAgentToolConfigRepository(): AgentToolConfigRepository {
    return this.agentToolConfigRepo
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
