import type { MessageAttachment } from '@features/cli-session'
import type { WorkflowDefinitionDocument } from '@/data'

export type TaskCreateMode = 'conversation' | 'workflow' | 'generated-workflow'
export type PersistedTaskMode = 'conversation' | 'workflow'
export type WorkflowGenerationToolId = 'claude-code' | 'codex'
export const GENERATED_WORKFLOW_REVIEW_ROUTE = '/generated-workflow-review'

export interface TaskCreateRequest {
  title: string
  prompt: string
  taskMode: PersistedTaskMode
  projectId?: string
  projectPath?: string
  createWorktree?: boolean
  baseBranch?: string
  worktreePrefix?: string
  branchPrefix?: string
  worktreeRootPath?: string
  cliToolId?: string
  agentToolConfigId?: string
  workflowDefinitionId?: string
  workflowDefinition?: WorkflowDefinitionDocument
}

export interface GeneratedWorkflowReviewRequest {
  title: string
  prompt: string
  attachments?: MessageAttachment[]
  projectId: string
  projectName?: string
  projectPath?: string
  projectType?: 'normal' | 'git'
  baseBranch?: string
  cliToolId: string
  agentToolConfigId: string
  returnTo?: string
}

interface BuildTaskCreatePayloadInput extends Omit<TaskCreateRequest, 'taskMode'> {
  createMode: TaskCreateMode
}

export const isProjectWorkflowTaskCreateMode = (mode: TaskCreateMode): boolean =>
  mode === 'workflow' || mode === 'generated-workflow'

export const resolvePersistedTaskMode = (mode: TaskCreateMode): PersistedTaskMode =>
  mode === 'conversation' ? 'conversation' : 'workflow'

export const isWorkflowGenerationToolId = (
  toolId: string | null | undefined
): toolId is WorkflowGenerationToolId => toolId === 'claude-code' || toolId === 'codex'

export const resolveWorkflowGenerationToolId = (
  toolId: string | null | undefined
): WorkflowGenerationToolId | undefined => (isWorkflowGenerationToolId(toolId) ? toolId : undefined)

export const deriveTaskTitle = (prompt: string, fallback = 'New thread'): string =>
  prompt
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
    ?.slice(0, 80) || fallback

export const buildTaskCreatePayload = ({
  createMode,
  workflowDefinitionId,
  workflowDefinition,
  ...input
}: BuildTaskCreatePayloadInput): TaskCreateRequest => ({
  ...input,
  taskMode: resolvePersistedTaskMode(createMode),
  workflowDefinitionId: createMode === 'conversation' ? undefined : workflowDefinitionId,
  workflowDefinition: createMode === 'conversation' ? undefined : workflowDefinition
})
