import type { MessageAttachment } from '@features/cli-session'
import { PromptOptimizeButton } from '@/components/shared/PromptOptimizeButton'
import { getEnabledDefaultCliToolId, getSettings } from '@/data/settings'

import type { GeneratedWorkflowReviewRequest } from '../model/task-create'

import { TaskCreateMenu } from './TaskCreateMenu'
import { TaskComposerInput } from './TaskComposerInput'
import { useTaskComposer } from '../hooks/useTaskComposer'

interface TaskComposerProps {
  active?: boolean
  resetOnActivate?: boolean
  projectId?: string
  projectName?: string
  projectPath?: string
  projectType?: 'normal' | 'git'
  titleRequired?: boolean
  titlePlaceholder?: string
  promptPlaceholder?: string
  autoFocus?: boolean
  className?: string
  onOpenGeneratedWorkflowReview?: (request: GeneratedWorkflowReviewRequest) => void | Promise<void>
  onCreated?: (
    task: unknown,
    context: {
      prompt: string
      attachments?: MessageAttachment[]
      navigateToTaskDetail?: boolean
      startError?: string
    }
  ) => void | Promise<void>
}

export function TaskComposer({
  active = true,
  resetOnActivate = false,
  projectId,
  projectName,
  projectPath,
  projectType = 'normal',
  titleRequired = false,
  titlePlaceholder = '标题',
  promptPlaceholder = '提示词',
  autoFocus = false,
  className,
  onOpenGeneratedWorkflowReview,
  onCreated
}: TaskComposerProps) {
  const composer = useTaskComposer({
    active,
    resetOnActivate,
    projectId,
    projectName,
    projectPath,
    projectType,
    titleRequired
  })

  const isConversationMode = composer.createMode === 'conversation'
  const optimizePromptSource = isConversationMode
    ? composer.compiledConversationPrompt
    : composer.prompt

  return (
    <>
      <TaskComposerInput
        inputMode="slash-rich"
        value={composer.prompt}
        onValueChange={composer.setPrompt}
        promptNodes={composer.promptNodes}
        onPromptNodesChange={composer.setPromptNodes}
        slashItems={composer.slashItems}
        slashLoading={composer.slashLoading}
        slashEnabled={
          isConversationMode &&
          Boolean(composer.selectedCliToolId || getEnabledDefaultCliToolId(getSettings()))
        }
        titleValue={titleRequired ? composer.title : undefined}
        onTitleChange={titleRequired ? composer.setTitle : undefined}
        titlePlaceholder={titlePlaceholder}
        requireTitle={titleRequired}
        placeholder={promptPlaceholder}
        className={className}
        autoFocus={autoFocus}
        disabled={composer.loading}
        operationBar={
          <TaskCreateMenu
            createMode={composer.createMode}
            onCreateModeChange={composer.setCreateMode}
            canUseProjectWorkflowModes={Boolean(projectId)}
            cliTools={composer.cliTools}
            selectedCliToolId={composer.selectedCliToolId}
            onSelectCliToolId={composer.setSelectedCliToolId}
            cliConfigs={composer.cliConfigs}
            selectedCliConfigId={composer.selectedCliConfigId}
            onSelectCliConfigId={composer.setSelectedCliConfigId}
            workflowTemplates={composer.workflowDefinitions}
            selectedTemplateId={composer.selectedTemplateId}
            onSelectTemplateId={composer.setSelectedTemplateId}
            isGitProject={composer.isGitProject}
            branches={composer.branches}
            selectedBaseBranch={composer.selectedBaseBranch}
            onSelectBaseBranch={composer.setSelectedBaseBranch}
          />
        }
        submitLeftBar={
          <PromptOptimizeButton
            prompt={optimizePromptSource}
            contextType="task"
            name={titleRequired ? composer.title || null : null}
            toolId={composer.selectedCliToolId || getEnabledDefaultCliToolId(getSettings()) || null}
            agentToolConfigId={
              composer.selectedCliConfigId ||
              composer.cliConfigs.find((config) => config.is_default)?.id ||
              null
            }
            disabled={composer.loading}
            onApply={(optimizedPrompt) => {
              composer.setPrompt(optimizedPrompt)
              composer.setError(null)
            }}
            onError={(message) => composer.setError(message)}
          />
        }
        onSubmit={async ({ text, attachments, promptNodes }) => {
          const result = await composer.createTask(text, attachments, promptNodes)
          if (!result) return
          if (result.reviewRequest) {
            await onOpenGeneratedWorkflowReview?.(result.reviewRequest)
            return
          }
          if (!result.task || !result.context) return
          await onCreated?.(result.task, result.context)
        }}
      />

      {composer.error && <div className="mt-3 text-sm text-red-500">{composer.error}</div>}
    </>
  )
}
