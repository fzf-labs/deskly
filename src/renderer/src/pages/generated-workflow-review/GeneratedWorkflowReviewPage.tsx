import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import {
  buildWorkflowDefinitionFromForm,
  WorkflowTemplateEditor,
  type WorkflowTemplateFormValues
} from '@/components/pipeline'
import { Button } from '@/components/ui/button'
import {
  EmptyStatePanel,
  PageBody,
  PageFrame,
  PageHeader
} from '@/components/shared/page-shell'
import { db } from '@/data'
import { getSettings } from '@/data/settings'
import type { MessageAttachment } from '@/hooks/useAgent'
import { notifyTasksChanged } from '@/lib/task-events'
import { useLanguage } from '@/providers/language-provider'
import {
  buildTaskCreatePayload,
  resolveWorkflowGenerationToolId,
  type GeneratedWorkflowReviewRequest
} from '@/components/task/task-create-utils'

type GeneratedWorkflowReviewLocationState = GeneratedWorkflowReviewRequest & {
  returnTo?: string
}

const buildInitialValues = (title: string): WorkflowTemplateFormValues => ({
  name: title,
  description: undefined,
  nodes: []
})

export function GeneratedWorkflowReviewPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as GeneratedWorkflowReviewLocationState | null

  const handleBack = useCallback(() => {
    if (state?.returnTo) {
      navigate(state.returnTo)
      return
    }
    navigate(-1)
  }, [navigate, state?.returnTo])

  const handleSubmit = useCallback(
    async (values: WorkflowTemplateFormValues) => {
      if (!state) {
        throw new Error(t.task.generatedWorkflowReviewMissingDraft)
      }

      const settings = getSettings()
      const worktreeBranchPrefix = settings.gitWorktreeBranchPrefix || 'WT-'
      const worktreeRootPath = settings.gitWorktreeDir || '~/.deskly/worktrees'

      const createdTask = await window.api.task.create(
        buildTaskCreatePayload({
          createMode: 'generated-workflow',
          title: state.title,
          prompt: state.prompt,
          projectId: state.projectId,
          projectPath: state.projectPath,
          createWorktree: Boolean(state.projectType === 'git' && state.projectPath),
          baseBranch: state.projectType === 'git' ? state.baseBranch || undefined : undefined,
          worktreeBranchPrefix,
          worktreeRootPath,
          cliToolId: state.cliToolId || undefined,
          agentToolConfigId: state.agentToolConfigId || undefined,
          workflowDefinition: buildWorkflowDefinitionFromForm(values)
        })
      )

      notifyTasksChanged()

      let startError: string | undefined
      try {
        await db.startTaskExecution(createdTask.id)
        notifyTasksChanged()
      } catch (startExecutionError) {
        console.error('[GeneratedWorkflowReviewPage] Failed to auto-start generated workflow task:', {
          taskId: createdTask.id,
          error: startExecutionError
        })
        startError = t.task.createTaskAutoStartFailed
      }

      navigate(`/task/${createdTask.id}`, {
        state: {
          prompt: state.prompt,
          attachments: state.attachments as MessageAttachment[] | undefined,
          startError
        }
      })
    },
    [navigate, state, t.task.createTaskAutoStartFailed, t.task.generatedWorkflowReviewMissingDraft]
  )

  const pageSubtitle = state?.projectName || t.task.generatedWorkflowReviewPageSubtitle

  if (!state?.projectId || !state.prompt.trim() || !state.title.trim()) {
    return (
      <PageFrame>
        <PageHeader
          title={t.task.generatedWorkflowReviewPageTitle}
          subtitle={pageSubtitle}
        />
        <PageBody>
          <EmptyStatePanel
            title={t.task.generatedWorkflowReviewMissingDraftTitle}
            description={t.task.generatedWorkflowReviewMissingDraft}
            action={
              <Button variant="outline" onClick={handleBack}>
                {t.common.cancel}
              </Button>
            }
          />
        </PageBody>
      </PageFrame>
    )
  }

  return (
    <PageFrame>
      <PageHeader
        title={t.task.generatedWorkflowReviewPageTitle}
        subtitle={pageSubtitle}
      />
      <PageBody className="page-shell-scroll-no-gutter flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0 md:px-0">
        <WorkflowTemplateEditor
          mode="task-draft"
          initialValues={buildInitialValues(state.title)}
          initialGenerationPrompt={state.prompt}
          preferredGenerationToolId={resolveWorkflowGenerationToolId(state.cliToolId)}
          preferredGenerationAgentToolConfigId={state.agentToolConfigId}
          nodeRuntimeDefaults={{
            cliToolId: state.cliToolId,
            agentToolConfigId: state.agentToolConfigId
          }}
          submitLabel={t.task.generatedWorkflowConfirmButton}
          savingLabel={t.task.generatedWorkflowConfirmLoading}
          onCancel={handleBack}
          onSubmit={handleSubmit}
        />
      </PageBody>
    </PageFrame>
  )
}
