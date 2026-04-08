import type { AppPaths } from '../app/AppPaths'
import type { ProjectService } from '../services/ProjectService'
import type { GitService } from '../services/GitService'
import type { CLIProcessService } from '../services/CLIProcessService'
import type { AgentCLIToolDetectorService } from '../services/AgentCLIToolDetectorService'
import type { AgentCLIToolConfigService } from '../services/AgentCLIToolConfigService'
import type { SystemCliToolService } from '../services/SystemCliToolService'
import type { EditorService } from '../services/EditorService'
import type { PreviewConfigService } from '../services/PreviewConfigService'
import type { PreviewDetectionService } from '../services/PreviewDetectionService'
import type { PreviewService } from '../services/PreviewService'
import type { NotificationService } from '../services/NotificationService'
import type { AgentToolProfileService } from '../services/AgentToolProfileService'
import type { AiAuthoringService } from '../services/AiAuthoringService'
import type { DatabaseService } from '../services/DatabaseService'
import type { SettingsService } from '../services/SettingsService'
import type { TaskService } from '../services/TaskService'
import type { TaskNodeRuntimeService } from '../services/TaskNodeRuntimeService'
import type { WorkflowRunLifecycleService } from '../services/WorkflowRunLifecycleService'
import type { CliSessionService } from '../services/cli/CliSessionService'
import type { TerminalService } from '../services/terminal/TerminalService'
import type { AutomationService } from '../services/AutomationService'
import type { IpcMainInvokeEvent } from 'electron'
import type { Validator } from '../utils/ipc-response'
import type { IpcArgs, IpcContractChannel, IpcResult } from './channels'

export interface IpcServices {
  projectService: ProjectService
  gitService: GitService
  cliProcessService: CLIProcessService
  cliToolDetectorService: AgentCLIToolDetectorService
  cliToolConfigService: AgentCLIToolConfigService
  systemCliToolService: SystemCliToolService
  editorService: EditorService
  previewConfigService: PreviewConfigService
  previewDetectionService: PreviewDetectionService
  previewService: PreviewService
  notificationService: NotificationService
  agentToolProfileService: AgentToolProfileService
  aiAuthoringService: AiAuthoringService
  databaseService: DatabaseService
  settingsService: SettingsService
  taskService: TaskService
  taskNodeRuntimeService: TaskNodeRuntimeService
  workflowRunLifecycleService: WorkflowRunLifecycleService
  cliSessionService: CliSessionService
  terminalService: TerminalService
  automationService: AutomationService
}

export interface IpcDependencies {
  services: IpcServices
  appPaths: AppPaths
  resolveProjectIdForSession: (sessionId: string) => string | null
}

export interface IpcHelpers {
  handle: <C extends IpcContractChannel>(
    channel: C,
    validators: ReadonlyArray<Validator<unknown>>,
    handler: (
      event: IpcMainInvokeEvent,
      ...args: IpcArgs<C>
    ) => Promise<IpcResult<C>> | IpcResult<C>
  ) => void
  v: typeof import('../utils/ipc-response').v
  fileDataValidator: Validator<Uint8Array | string>
  getFsAllowlistRoots: () => string[]
  confirmDestructiveOperation: (
    event: IpcMainInvokeEvent,
    action: string,
    targetPath: string
  ) => Promise<void>
  taskStatusValues: readonly ['todo', 'in_progress', 'in_review', 'done', 'failed']
  taskNodeStatusValues: readonly ['todo', 'in_progress', 'in_review', 'done', 'failed']
}

export interface IpcModuleContext extends IpcDependencies, IpcHelpers {}
