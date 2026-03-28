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
import { CliSessionService } from '../services/cli/CliSessionService'
import { TerminalService } from '../services/terminal/TerminalService'
import { AutomationRunnerService } from '../services/AutomationRunnerService'
import { AutomationService } from '../services/AutomationService'
import { WorkflowSchedulerService } from '../services/WorkflowSchedulerService'
import { AppContext, AppServices } from './AppContext'

type CoreServices = Pick<
  AppServices,
  | 'databaseService'
  | 'settingsService'
  | 'agentToolProfileService'
  | 'taskNodeRuntimeService'
  | 'workflowRunLifecycleService'
  | 'aiAuthoringService'
>
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
  'taskService' | 'workflowSchedulerService' | 'terminalService'
>
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
    agentToolProfileService: databaseService.getAgentToolProfileService(),
    taskNodeRuntimeService: databaseService.getTaskNodeRuntimeService(),
    workflowRunLifecycleService: databaseService.getWorkflowRunLifecycleService(),
    aiAuthoringService: databaseService.getAiAuthoringService()
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
}: CoreServices): CliSessionServices => {
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

const createTaskWorkflowServices = ({
  databaseService,
  agentToolProfileService,
  taskNodeRuntimeService,
  workflowRunLifecycleService,
  settingsService,
  gitService,
  cliSessionService
}: CoreServices &
  Pick<ProjectGitServices, 'gitService'> &
  Pick<CliSessionServices, 'cliSessionService'>): TaskWorkflowServices => ({
  taskService: new TaskService(databaseService, gitService, settingsService),
  workflowSchedulerService: new WorkflowSchedulerService(
    databaseService,
    agentToolProfileService,
    taskNodeRuntimeService,
    cliSessionService,
    workflowRunLifecycleService
  ),
  terminalService: new TerminalService()
})

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

const wireAiRuntimeServices = ({
  databaseService,
  settingsService,
  cliSessionService,
  cliToolDetectorService
}: Pick<
  AppServices,
  'databaseService' | 'settingsService' | 'cliSessionService' | 'cliToolDetectorService'
>) => {
  databaseService
    .getWorkflowDefinitionGenerationService()
    .setCliRuntime(
      cliSessionService,
      cliToolDetectorService,
      databaseService.getWorkflowDefinitionService(),
      settingsService
    )
  databaseService
    .getPromptOptimizationService()
    .setCliRuntime(cliSessionService, cliToolDetectorService, settingsService)
}

const wireWorkflowRuntimeServices = ({
  databaseService,
  workflowSchedulerService
}: Pick<AppServices, 'databaseService' | 'workflowSchedulerService'>) => {
  databaseService.setWorkflowSchedulerService(workflowSchedulerService)
}

export const createAppContext = (): AppContext => {
  const appPaths = getAppPaths()

  const coreServices = createCoreServices()
  const projectGitServices = createProjectGitServices(coreServices.databaseService)
  const cliSessionServices = createCliSessionServices(coreServices)
  const workspaceToolServices = createWorkspaceToolServices()
  const taskWorkflowServices = createTaskWorkflowServices({
    ...coreServices,
    gitService: projectGitServices.gitService,
    cliSessionService: cliSessionServices.cliSessionService
  })

  wireAiRuntimeServices({
    databaseService: coreServices.databaseService,
    settingsService: coreServices.settingsService,
    cliSessionService: cliSessionServices.cliSessionService,
    cliToolDetectorService: cliSessionServices.cliToolDetectorService
  })

  wireWorkflowRuntimeServices({
    databaseService: coreServices.databaseService,
    workflowSchedulerService: taskWorkflowServices.workflowSchedulerService
  })

  const automationNotificationServices = createAutomationNotificationServices({
    databaseService: coreServices.databaseService,
    taskNodeRuntimeService: coreServices.taskNodeRuntimeService,
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
    aiAuthoringService: coreServices.aiAuthoringService,
    databaseService: coreServices.databaseService,
    settingsService: coreServices.settingsService,
    taskService: taskWorkflowServices.taskService,
    taskNodeRuntimeService: coreServices.taskNodeRuntimeService,
    workflowRunLifecycleService: coreServices.workflowRunLifecycleService,
    cliSessionService: cliSessionServices.cliSessionService,
    workflowSchedulerService: taskWorkflowServices.workflowSchedulerService,
    terminalService: taskWorkflowServices.terminalService,
    automationRunnerService: automationNotificationServices.automationRunnerService,
    automationService: automationNotificationServices.automationService
  }

  const serviceOrder = [
    coreServices.databaseService,
    coreServices.agentToolProfileService,
    coreServices.aiAuthoringService,
    coreServices.taskNodeRuntimeService,
    coreServices.workflowRunLifecycleService,
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
    taskWorkflowServices.workflowSchedulerService,
    taskWorkflowServices.terminalService,
    automationNotificationServices.automationRunnerService,
    automationNotificationServices.automationService
  ]

  return new AppContext(appPaths, services, serviceOrder)
}
