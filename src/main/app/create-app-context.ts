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

type CoreServices = Pick<AppServices, 'databaseService' | 'settingsService'>
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

const createCoreServices = (): CoreServices => ({
  settingsService: new SettingsService(),
  databaseService: new DatabaseService()
})

const createProjectGitServices = (databaseService: DatabaseService): ProjectGitServices => ({
  projectService: new ProjectService(databaseService),
  gitService: new GitService()
})

const createCliSessionServices = ({
  databaseService,
  settingsService
}: CoreServices): CliSessionServices => {
  const cliProcessService = new CLIProcessService()
  const cliToolDetectorService = new AgentCLIToolDetectorService()
  const cliToolConfigService = new AgentCLIToolConfigService()
  const systemCliToolService = new SystemCliToolService()
  const cliSessionService = new CliSessionService(
    cliToolConfigService,
    databaseService,
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
  settingsService,
  gitService,
  cliSessionService
}: CoreServices &
  Pick<ProjectGitServices, 'gitService'> &
  Pick<CliSessionServices, 'cliSessionService'>): TaskWorkflowServices => ({
  taskService: new TaskService(databaseService, gitService, settingsService),
  workflowSchedulerService: new WorkflowSchedulerService(databaseService, cliSessionService),
  terminalService: new TerminalService()
})

const createAutomationNotificationServices = ({
  databaseService,
  taskService,
  cliSessionService
}: Pick<AppServices, 'databaseService' | 'taskService' | 'cliSessionService'>): AutomationNotificationServices => {
  const notificationService = new NotificationService()
  const automationRunnerService = new AutomationRunnerService(
    databaseService,
    taskService,
    cliSessionService
  )

  return {
    notificationService,
    automationRunnerService,
    automationService: new AutomationService(databaseService, automationRunnerService)
  }
}

const wireDatabaseRuntime = ({
  databaseService,
  settingsService,
  cliSessionService,
  cliToolDetectorService,
  workflowSchedulerService
}: Pick<
  AppServices,
  | 'databaseService'
  | 'settingsService'
  | 'cliSessionService'
  | 'cliToolDetectorService'
  | 'workflowSchedulerService'
>) => {
  databaseService.setRuntimeServices({
    cliSessionService,
    cliToolDetectorService,
    settingsService,
    workflowSchedulerService
  })
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

  wireDatabaseRuntime({
    databaseService: coreServices.databaseService,
    settingsService: coreServices.settingsService,
    cliSessionService: cliSessionServices.cliSessionService,
    cliToolDetectorService: cliSessionServices.cliToolDetectorService,
    workflowSchedulerService: taskWorkflowServices.workflowSchedulerService
  })

  const automationNotificationServices = createAutomationNotificationServices({
    databaseService: coreServices.databaseService,
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
    databaseService: coreServices.databaseService,
    settingsService: coreServices.settingsService,
    taskService: taskWorkflowServices.taskService,
    cliSessionService: cliSessionServices.cliSessionService,
    workflowSchedulerService: taskWorkflowServices.workflowSchedulerService,
    terminalService: taskWorkflowServices.terminalService,
    automationRunnerService: automationNotificationServices.automationRunnerService,
    automationService: automationNotificationServices.automationService
  }

  const serviceOrder = [
    coreServices.databaseService,
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
