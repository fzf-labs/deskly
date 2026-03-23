import type { MessageAttachment } from '@/hooks/useAgent'
import { PromptOptimizeButton } from '@/components/shared/PromptOptimizeButton'
import { ChatInput } from '@/components/shared/ChatInput'
import { getEnabledDefaultCliToolId, getSettings } from '@/data/settings'

import { TaskCreateMenu } from './TaskCreateMenu'
import { useTaskComposer } from './useTaskComposer'

interface TaskComposerProps {
  active?: boolean
  resetOnActivate?: boolean
  projectId?: string
  projectPath?: string
  projectType?: 'normal' | 'git'
  titleRequired?: boolean
  titlePlaceholder?: string
  promptPlaceholder?: string
  autoFocus?: boolean
  className?: string
  onCreated?: (
    task: unknown,
    context: { prompt: string; attachments?: MessageAttachment[] }
  ) => void | Promise<void>
}

export function TaskComposer({
  active = true,
  resetOnActivate = false,
  projectId,
  projectPath,
  projectType = 'normal',
  titleRequired = false,
  titlePlaceholder = '标题',
  promptPlaceholder = '提示词',
  autoFocus = false,
  className,
  onCreated
}: TaskComposerProps) {
  const composer = useTaskComposer({
    active,
    resetOnActivate,
    projectId,
    projectPath,
    projectType,
    titleRequired
  })

  return (
    <>
      <ChatInput
        variant="home"
        value={composer.prompt}
        onValueChange={composer.setPrompt}
        titleValue={titleRequired ? composer.title : undefined}
        onTitleChange={titleRequired ? composer.setTitle : undefined}
        titlePlaceholder={titlePlaceholder}
        requireTitle={titleRequired}
        placeholder={promptPlaceholder}
        onSubmit={async (text, attachments) => {
          const result = await composer.createTask(text, attachments)
          if (!result) return
          await onCreated?.(result.task, result.context)
        }}
        className={className}
        autoFocus={autoFocus}
        disabled={composer.loading}
        operationBar={
          <TaskCreateMenu
            taskMode={composer.taskMode}
            onTaskModeChange={composer.setTaskMode}
            canUseWorkflowMode={Boolean(projectId)}
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
            prompt={composer.prompt}
            contextType="task"
            name={titleRequired ? composer.title || null : null}
            toolId={
              composer.selectedCliToolId || getEnabledDefaultCliToolId(getSettings()) || null
            }
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
      />

      {composer.error && <div className="mt-3 text-sm text-red-500">{composer.error}</div>}
    </>
  )
}
