import { getAppPaths } from './AppPaths'
import { ProjectService } from '../services/ProjectService'
import { GitService } from '../services/GitService'
import { CLIProcessService } from '../services/CLIProcessService'
import { AgentCLIToolDetectorService } from '../services/AgentCLIToolDetectorService'
import { AgentCLIToolConfigService } from '../services/AgentCLIToolConfigService'
import { SystemCliToolService } from '../services/SystemCliToolService'
import { EditorService } from '../services/EditorService'
import { PreviewConfigService } from '../services/PreviewConfigService'
import { PreviewService } from '../services/PreviewService'
import { NotificationService } from '../services/NotificationService'
import { DatabaseService } from '../services/DatabaseService'
import { SettingsService } from '../services/SettingsService'
import { TaskService } from '../services/TaskService'
import { AgentToolProfileService } from '../services/AgentToolProfileService'
import { TaskNodeRuntimeService } from '../services/TaskNodeRuntimeService'
import { WorkflowRunLifecycleService } from '../services/WorkflowRunLifecycleService'
import { CliSessionService } from '../services/cli/CliSessionService'
import { TerminalService } from '../services/terminal/TerminalService'
import { AutomationRunnerService } from '../services/AutomationRunnerService'
import { AutomationService } from '../services/AutomationService'
import { WorkflowSchedulerService } from '../services/WorkflowSchedulerService'
import { WorkflowDefinitionGenerationService } from '../services/WorkflowDefinitionGenerationService'
import { PromptOptimizationService } from '../services/PromptOptimizationService'
import { AiAuthoringService } from '../services/AiAuthoringService'
import { AppContext, AppServices } from './AppContext'

type CoreServices = Pick<
  AppServices,
  'databaseService' | 'settingsService' | 'agentToolProfileService'
>
type AiAuthoringServices = Pick<AppServices, 'aiAuthoringService'>
type ProjectGitServices = Pick<AppServices, 'projectService' | 'gitService'>
type CliSessionServices = Pick<
  AppServices,
  | 'cliProcessService'
  | 'cliToolDetectorService'
  | 'cliToolConfigService'
  | 'systemCliToolService'
  | 'cliSessionService'
>
type WorkspaceToolServices = Pick<
  AppServices,
  'editorService' | 'previewConfigService' | 'previewService'
>
type TaskWorkflowServices = Pick<
  AppServices,
  'taskService' | 'taskNodeRuntimeService' | 'workflowRunLifecycleService' | 'terminalService'
>
type WorkflowSchedulerServices = Pick<AppServices, 'workflowSchedulerService'>
type AutomationNotificationServices = Pick<
  AppServices,
  'notificationService' | 'automationRunnerService' | 'automationService'
>

const createCoreServices = (): CoreServices => {
  const settingsService = new SettingsService()
  const databaseService = new DatabaseService()

  return {
    settingsService,
    databaseService,
    agentToolProfileService: new AgentToolProfileService(
      databaseService.getAgentToolConfigRepository()
    )
  }
}

const createProjectGitServices = (databaseService: DatabaseService): ProjectGitServices => ({
  projectService: new ProjectService(databaseService),
  gitService: new GitService()
})

const createCliSessionServices = ({
  databaseService,
  agentToolProfileService,
  taskNodeRuntimeService,
  settingsService
}: CoreServices & Pick<TaskWorkflowServices, 'taskNodeRuntimeService'>): CliSessionServices => {
  const cliProcessService = new CLIProcessService()
  const cliToolDetectorService = new AgentCLIToolDetectorService()
  const cliToolConfigService = new AgentCLIToolConfigService()
  const systemCliToolService = new SystemCliToolService()
  const cliSessionService = new CliSessionService(
    cliToolConfigService,
    agentToolProfileService,
    databaseService,
    taskNodeRuntimeService,
    settingsService
  )

  return {
    cliProcessService,
    cliToolDetectorService,
    cliToolConfigService,
    systemCliToolService,
    cliSessionService
  }
}

const createWorkspaceToolServices = (): WorkspaceToolServices => ({
  editorService: new EditorService(),
  previewConfigService: new PreviewConfigService(),
  previewService: new PreviewService()
})

const createAiAuthoringServices = ({
  databaseService,
  settingsService,
  agentToolProfileService,
  cliSessionService,
  cliToolDetectorService
}: CoreServices &
  Pick<CliSessionServices, 'cliSessionService' | 'cliToolDetectorService'>): AiAuthoringServices => {
  const workflowDefinitionGenerationService = new WorkflowDefinitionGenerationService()
  workflowDefinitionGenerationService.setCliRuntime(
    cliSessionService,
    cliToolDetectorService,
    databaseService.getWorkflowDefinitionService(),
    settingsService
  )

  const promptOptimizationService = new PromptOptimizationService()
  promptOptimizationService.setCliRuntime(cliSessionService, cliToolDetectorService, settingsService)

  return {
    aiAuthoringService: new AiAuthoringService(
      workflowDefinitionGenerationService,
      promptOptimizationService,
      agentToolProfileService
    )
  }
}

const createTaskWorkflowServices = ({
  databaseService,
  settingsService,
  gitService
}: CoreServices &
  Pick<ProjectGitServices, 'gitService'>): TaskWorkflowServices => {
  const taskNodeRuntimeService = new TaskNodeRuntimeService(
    databaseService.getTaskRepository(),
    databaseService.getWorkflowRunService(),
    databaseService.getWorkflowRunNodeRepository()
  )
  const workflowRunLifecycleService = new WorkflowRunLifecycleService(
    databaseService.getWorkflowRunService(),
    databaseService.getWorkflowRunNodeRepository(),
    {
      getTaskNode: (nodeId) => taskNodeRuntimeService.getTaskNode(nodeId),
      notifyTaskNodeStatusChange: (node) => taskNodeRuntimeService.notifyTaskNodeStatusChange(node)
    }
  )

  return {
    taskService: new TaskService(databaseService, gitService, settingsService),
    taskNodeRuntimeService,
    workflowRunLifecycleService,
    terminalService: new TerminalService()
  }
}

const createWorkflowSchedulerServices = ({
  databaseService,
  agentToolProfileService,
  taskNodeRuntimeService,
  workflowRunLifecycleService,
  cliSessionService
}: CoreServices &
  Pick<TaskWorkflowServices, 'taskNodeRuntimeService' | 'workflowRunLifecycleService'> &
  Pick<CliSessionServices, 'cliSessionService'>): WorkflowSchedulerServices => {
  const workflowSchedulerService = new WorkflowSchedulerService(
    databaseService,
    agentToolProfileService,
    taskNodeRuntimeService,
    cliSessionService,
    workflowRunLifecycleService
  )

  taskNodeRuntimeService.setWorkflowSchedulerService(workflowSchedulerService)
  workflowRunLifecycleService.setWorkflowSchedulerService(workflowSchedulerService)

  return {
    workflowSchedulerService
  }
}

const createAutomationNotificationServices = ({
  databaseService,
  taskNodeRuntimeService,
  taskService,
  cliSessionService
}: Pick<
  AppServices,
  'databaseService' | 'taskNodeRuntimeService' | 'taskService' | 'cliSessionService'
>): AutomationNotificationServices => {
  const notificationService = new NotificationService()
  const automationRunnerService = new AutomationRunnerService(
    databaseService,
    taskNodeRuntimeService,
    taskService,
    cliSessionService
  )

  return {
    notificationService,
    automationRunnerService,
    automationService: new AutomationService(databaseService, automationRunnerService)
  }
}

export const createAppContext = (): AppContext => {
  const appPaths = getAppPaths()

  const coreServices = createCoreServices()
  const projectGitServices = createProjectGitServices(coreServices.databaseService)
  const taskWorkflowServices = createTaskWorkflowServices({
    ...coreServices,
    gitService: projectGitServices.gitService
  })
  const cliSessionServices = createCliSessionServices({
    ...coreServices,
    taskNodeRuntimeService: taskWorkflowServices.taskNodeRuntimeService
  })
  const workflowSchedulerServices = createWorkflowSchedulerServices({
    ...coreServices,
    taskNodeRuntimeService: taskWorkflowServices.taskNodeRuntimeService,
    workflowRunLifecycleService: taskWorkflowServices.workflowRunLifecycleService,
    cliSessionService: cliSessionServices.cliSessionService
  })
  const aiAuthoringServices = createAiAuthoringServices({
    ...coreServices,
    cliSessionService: cliSessionServices.cliSessionService,
    cliToolDetectorService: cliSessionServices.cliToolDetectorService
  })
  const workspaceToolServices = createWorkspaceToolServices()

  const automationNotificationServices = createAutomationNotificationServices({
    databaseService: coreServices.databaseService,
    taskNodeRuntimeService: taskWorkflowServices.taskNodeRuntimeService,
    taskService: taskWorkflowServices.taskService,
    cliSessionService: cliSessionServices.cliSessionService
  })

  const services: AppServices = {
    projectService: projectGitServices.projectService,
    gitService: projectGitServices.gitService,
    cliProcessService: cliSessionServices.cliProcessService,
    cliToolDetectorService: cliSessionServices.cliToolDetectorService,
    cliToolConfigService: cliSessionServices.cliToolConfigService,
    systemCliToolService: cliSessionServices.systemCliToolService,
    editorService: workspaceToolServices.editorService,
    previewConfigService: workspaceToolServices.previewConfigService,
    previewService: workspaceToolServices.previewService,
    notificationService: automationNotificationServices.notificationService,
    agentToolProfileService: coreServices.agentToolProfileService,
    aiAuthoringService: aiAuthoringServices.aiAuthoringService,
    databaseService: coreServices.databaseService,
    settingsService: coreServices.settingsService,
    taskService: taskWorkflowServices.taskService,
    taskNodeRuntimeService: taskWorkflowServices.taskNodeRuntimeService,
    workflowRunLifecycleService: taskWorkflowServices.workflowRunLifecycleService,
    cliSessionService: cliSessionServices.cliSessionService,
    workflowSchedulerService: workflowSchedulerServices.workflowSchedulerService,
    terminalService: taskWorkflowServices.terminalService,
    automationRunnerService: automationNotificationServices.automationRunnerService,
    automationService: automationNotificationServices.automationService
  }

  const serviceOrder = [
    coreServices.databaseService,
    coreServices.agentToolProfileService,
    aiAuthoringServices.aiAuthoringService,
    projectGitServices.projectService,
    projectGitServices.gitService,
    cliSessionServices.cliProcessService,
    cliSessionServices.cliToolDetectorService,
    cliSessionServices.cliToolConfigService,
    cliSessionServices.systemCliToolService,
    cliSessionServices.cliSessionService,
    workspaceToolServices.editorService,
    workspaceToolServices.previewConfigService,
    workspaceToolServices.previewService,
    automationNotificationServices.notificationService,
    coreServices.settingsService,
    taskWorkflowServices.taskService,
    taskWorkflowServices.taskNodeRuntimeService,
    taskWorkflowServices.workflowRunLifecycleService,
    workflowSchedulerServices.workflowSchedulerService,
    taskWorkflowServices.terminalService,
    automationNotificationServices.automationRunnerService,
    automationNotificationServices.automationService
  ]

  return new AppContext(appPaths, services, serviceOrder)
}
