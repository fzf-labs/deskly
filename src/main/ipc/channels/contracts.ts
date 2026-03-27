import type {
  CliSessionStartOptions,
  LogStreamSubscriptionResult,
  OutputSnapshot,
  TerminalSessionStartResult
} from '../../../shared/contracts/cli-session'
import type { NotificationOptions, NotificationSoundSettings } from '../../../shared/contracts/notification'
import type { CheckProjectPathResult } from '../../../shared/contracts/project'
import type { OptimizePromptInput } from '../../../shared/contracts/prompt'
import type { AppSettings } from '../../../shared/contracts/settings'
import type { FileStat, OpenDialogOptions, SaveDialogOptions } from '../../../shared/contracts/system'
import type {
  CompleteTaskNodeResultInput,
  CreateTaskOptions,
  UpdateCurrentTaskNodeRuntimeInput
} from '../../../shared/contracts/task'
import type {
  RunAutomationNowResult
} from '../../../shared/contracts/automation'
import type {
  ApproveWorkflowRunNodeInput,
  CreateWorkflowRunForTaskInput,
  GenerateWorkflowDefinitionInput,
  WorkflowDefinitionFilter
} from '../../../shared/contracts/workflow'

export type IpcContract<Args extends unknown[] = unknown[], Result = unknown> = {
  args: Args
  result: Result
}

type UnknownRecord = Record<string, unknown>

export type { OutputSnapshot }

export interface IpcContracts {
  'app:getVersion': IpcContract<[], string>

  'projects:getAll': IpcContract<[], unknown[]>
  'projects:get': IpcContract<[string], unknown>
  'projects:add': IpcContract<[UnknownRecord], unknown>
  'projects:update': IpcContract<[string, UnknownRecord], unknown>
  'projects:delete': IpcContract<[string], boolean>
  'projects:checkPath': IpcContract<[string], CheckProjectPathResult>

  'git:checkInstalled': IpcContract<[], unknown>
  'git:clone': IpcContract<[string, string], unknown>
  'git:init': IpcContract<[string], unknown>
  'git:listWorktrees': IpcContract<[string], unknown>
  'git:addWorktree': IpcContract<[string, string, string, boolean, string?], unknown>
  'git:removeWorktree': IpcContract<[string, string, boolean], unknown>
  'git:pruneWorktrees': IpcContract<[string], unknown>
  'git:getDiff': IpcContract<[string, string?], unknown>
  'git:getStagedDiff': IpcContract<[string, string?], unknown>
  'git:getBranches': IpcContract<[string], unknown>
  'git:getCurrentBranch': IpcContract<[string], unknown>
  'git:getChangedFiles': IpcContract<[string], unknown>
  'git:getBranchDiffFiles': IpcContract<[string, string, string?], unknown>
  'git:getBranchDiff': IpcContract<[string, string, string?, string?], unknown>
  'git:stageFiles': IpcContract<[string, string[]], unknown>
  'git:unstageFiles': IpcContract<[string, string[]], unknown>
  'git:commit': IpcContract<[string, string], unknown>
  'git:mergeBranch': IpcContract<[string, string], unknown>
  'git:getConflictFiles': IpcContract<[string], unknown>
  'git:abortMerge': IpcContract<[string], unknown>
  'git:getConflictContent': IpcContract<[string, string], unknown>
  'git:resolveConflict': IpcContract<[string, string, 'ours' | 'theirs'], unknown>
  'git:rebaseBranch': IpcContract<[string, string], unknown>
  'git:rebaseContinue': IpcContract<[string], unknown>
  'git:rebaseAbort': IpcContract<[string], unknown>
  'git:rebaseSkip': IpcContract<[string], unknown>
  'git:getRemoteUrl': IpcContract<[string, string?], unknown>
  'git:pushBranch': IpcContract<[string, string, string?, boolean?], unknown>
  'git:getCommitLog': IpcContract<[string, number?], unknown>
  'git:getParsedDiff': IpcContract<[string, string?], unknown>
  'git:getParsedStagedDiff': IpcContract<[string, string?], unknown>
  'git:checkoutBranch': IpcContract<[string, string], unknown>
  'git:createBranch': IpcContract<[string, string], unknown>

  'cli:startSession': IpcContract<[string, string, string[], string?], unknown>
  'cli:stopSession': IpcContract<[string], unknown>
  'cli:getOutput': IpcContract<[string], OutputSnapshot>

  'terminal:startSession': IpcContract<[string, string, number?, number?, string?], TerminalSessionStartResult>
  'terminal:write': IpcContract<[string, string], unknown>
  'terminal:resize': IpcContract<[string, number, number], unknown>
  'terminal:signal': IpcContract<[string, string?], unknown>
  'terminal:kill': IpcContract<[string], unknown>
  'terminal:detach': IpcContract<[string], unknown>
  'terminal:killByWorkspaceId': IpcContract<[string], { killed: number; failed: number }>

  'cliSession:startSession': IpcContract<[string, string, string, CliSessionStartOptions?], unknown>
  'cliSession:stopSession': IpcContract<[string], unknown>
  'cliSession:sendInput': IpcContract<[string, string], unknown>
  'cliSession:getSessions': IpcContract<[], unknown[]>
  'cliSession:getSession': IpcContract<[string], unknown>

  'logStream:subscribe': IpcContract<[string], LogStreamSubscriptionResult>
  'logStream:unsubscribe': IpcContract<[string], LogStreamSubscriptionResult>
  'logStream:getHistory': IpcContract<[string, (string | null)?, (string | null)?], unknown[]>

  'cliTools:getAll': IpcContract<[], unknown[]>
  'cliTools:getSnapshot': IpcContract<[], unknown[]>
  'cliTools:refresh': IpcContract<[UnknownRecord?], unknown[]>
  'cliTools:detect': IpcContract<[string, UnknownRecord?], unknown>
  'cliTools:detectAll': IpcContract<[UnknownRecord?], unknown[]>

  'cliToolConfig:get': IpcContract<[string], UnknownRecord>
  'cliToolConfig:save': IpcContract<[string, UnknownRecord], unknown>

  'systemCliTools:getAll': IpcContract<[], unknown[]>
  'systemCliTools:getSnapshot': IpcContract<[], unknown[]>
  'systemCliTools:refresh': IpcContract<[UnknownRecord?], unknown[]>
  'systemCliTools:detect': IpcContract<[string, UnknownRecord?], unknown>
  'systemCliTools:detectAll': IpcContract<[UnknownRecord?], unknown[]>

  'editor:getAvailable': IpcContract<[], unknown[]>
  'editor:openProject': IpcContract<[string, string], unknown>

  'previewConfig:getAll': IpcContract<[], unknown[]>
  'previewConfig:getByProject': IpcContract<[string], unknown[]>
  'previewConfig:get': IpcContract<[string], unknown>
  'previewConfig:add': IpcContract<[UnknownRecord], unknown>
  'previewConfig:update': IpcContract<[string, UnknownRecord], unknown>
  'previewConfig:delete': IpcContract<[string], unknown>

  'preview:start': IpcContract<[string, string, string, string[], string?, Record<string, string>?], unknown>
  'preview:stop': IpcContract<[string], unknown>
  'preview:getInstance': IpcContract<[string], unknown>
  'preview:getAllInstances': IpcContract<[], unknown[]>
  'preview:getOutput': IpcContract<[string, number?], string[]>
  'preview:clearInstance': IpcContract<[string], unknown>

  'notification:show': IpcContract<[NotificationOptions], boolean>
  'notification:setEnabled': IpcContract<[boolean], unknown>
  'notification:isEnabled': IpcContract<[], boolean>
  'notification:setSoundEnabled': IpcContract<[boolean], unknown>
  'notification:isSoundEnabled': IpcContract<[], boolean>
  'notification:setSoundSettings': IpcContract<[NotificationSoundSettings], unknown>
  'notification:getSoundSettings': IpcContract<[], import('../../../shared/contracts/notification').NotificationSoundSettingsState>

  'db:createTask': IpcContract<[UnknownRecord], unknown>
  'db:getTask': IpcContract<[string], unknown>
  'db:getAllTasks': IpcContract<[], unknown[]>
  'db:updateTask': IpcContract<[string, UnknownRecord], unknown>
  'db:deleteTask': IpcContract<[string], unknown>
  'db:getTasksByProjectId': IpcContract<[string], unknown[]>
  'db:listAgentToolConfigs': IpcContract<[string?], unknown[]>
  'db:getAgentToolConfig': IpcContract<[string], unknown>
  'db:createAgentToolConfig': IpcContract<[UnknownRecord], unknown>
  'db:updateAgentToolConfig': IpcContract<[string, UnknownRecord], unknown>
  'db:deleteAgentToolConfig': IpcContract<[string], unknown>
  'db:setDefaultAgentToolConfig': IpcContract<[string], unknown>
  'db:getTaskNodes': IpcContract<[string], unknown[]>
  'db:getTaskNode': IpcContract<[string], unknown>
  'db:getCurrentTaskNode': IpcContract<[string], unknown>
  'db:updateCurrentTaskNodeRuntime': IpcContract<[string, UpdateCurrentTaskNodeRuntimeInput], unknown>
  'db:getTaskNodesByStatus': IpcContract<[string, string], unknown[]>
  'db:completeTaskNode': IpcContract<[string, CompleteTaskNodeResultInput?], unknown>
  'db:markTaskNodeErrorReview': IpcContract<[string, string], unknown>
  'db:approveTaskNode': IpcContract<[string], unknown>
  'db:rerunTaskNode': IpcContract<[string], unknown>
  'db:stopTaskNodeExecution': IpcContract<[string, string?], unknown>

  'workflow:listDefinitions': IpcContract<[WorkflowDefinitionFilter?], unknown[]>
  'workflow:getDefinition': IpcContract<[string], unknown>
  'workflow:generateDefinition': IpcContract<[GenerateWorkflowDefinitionInput], unknown>
  'workflow:createDefinition': IpcContract<[UnknownRecord], unknown>
  'workflow:updateDefinition': IpcContract<[UnknownRecord], unknown>
  'workflow:deleteDefinition': IpcContract<[string], boolean>
  'workflow:createRunForTask': IpcContract<[CreateWorkflowRunForTaskInput], unknown>
  'workflow:getRun': IpcContract<[string], unknown>
  'workflow:getRunByTask': IpcContract<[string], unknown>
  'workflow:listRunNodes': IpcContract<[string], unknown[]>
  'workflow:startRun': IpcContract<[string], unknown>
  'workflow:approveNode': IpcContract<[string, ApproveWorkflowRunNodeInput?], unknown>
  'workflow:retryNode': IpcContract<[string], unknown>
  'workflow:stopRun': IpcContract<[string], unknown>

  'prompt:optimize': IpcContract<[OptimizePromptInput], unknown>

  'fs:readFile': IpcContract<[string], Uint8Array>
  'fs:readTextFile': IpcContract<[string], string>
  'fs:writeFile': IpcContract<[string, Uint8Array | string], unknown>
  'fs:writeTextFile': IpcContract<[string, string], unknown>
  'fs:appendTextFile': IpcContract<[string, string], unknown>
  'fs:stat': IpcContract<[string], FileStat>
  'fs:readDir': IpcContract<[string, { maxDepth?: number }?], unknown[]>
  'fs:exists': IpcContract<[string], boolean>
  'fs:remove': IpcContract<[string, { recursive?: boolean }?], unknown>
  'fs:mkdir': IpcContract<[string], unknown>

  'dialog:save': IpcContract<[SaveDialogOptions], string | null>
  'dialog:open': IpcContract<[OpenDialogOptions], string | string[] | null>

  'shell:openUrl': IpcContract<[string], unknown>
  'shell:openPath': IpcContract<[string], unknown>
  'shell:showItemInFolder': IpcContract<[string], unknown>

  'path:appConfigDir': IpcContract<[], string>
  'path:tempDir': IpcContract<[], string>
  'path:resourcesDir': IpcContract<[], string>
  'path:appPath': IpcContract<[], string>
  'path:desklyDataDir': IpcContract<[], string>
  'path:homeDir': IpcContract<[], string>

  'settings:get': IpcContract<[], AppSettings>
  'settings:update': IpcContract<[Partial<AppSettings>], AppSettings>
  'settings:reset': IpcContract<[], AppSettings>

  'task:create': IpcContract<[CreateTaskOptions], unknown>
  'task:get': IpcContract<[string], unknown>
  'task:getAll': IpcContract<[], unknown[]>
  'task:getByProject': IpcContract<[string], unknown[]>
  'task:updateStatus': IpcContract<[string, string], unknown>
  'task:delete': IpcContract<[string, boolean?], unknown>
  'task:startExecution': IpcContract<[string], unknown>
  'task:stopExecution': IpcContract<[string], unknown>

  'automation:create': IpcContract<[UnknownRecord], unknown>
  'automation:update': IpcContract<[string, UnknownRecord], unknown>
  'automation:delete': IpcContract<[string], boolean>
  'automation:get': IpcContract<[string], unknown>
  'automation:list': IpcContract<[], unknown[]>
  'automation:setEnabled': IpcContract<[string, boolean], unknown>
  'automation:runNow': IpcContract<[string], RunAutomationNowResult>
  'automation:listRuns': IpcContract<[string, number?], unknown[]>
}

export type IpcContractChannel = keyof IpcContracts
export type IpcArgs<C extends IpcContractChannel> = IpcContracts[C]['args']
export type IpcResult<C extends IpcContractChannel> = IpcContracts[C]['result']
