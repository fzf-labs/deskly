import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { buildSettingsRoute } from '@/components/settings'
import {
  buildWorkflowDefinitionFromForm,
  type WorkflowTemplateFormValues,
  WorkflowTemplateEditor,
  workflowDefinitionToFormValues
} from '@/components/pipeline'
import { Button } from '@/components/ui/button'
import {
  EmptyStatePanel,
  PageBody,
  PageFrame,
  PageHeader,
  SurfaceCard
} from '@/components/shared/page-shell'
import { db, type WorkflowDefinition, type WorkflowDefinitionScope } from '@/data'
import { useProjects } from '@/hooks/useProjects'
import { useLanguage } from '@/providers/language-provider'

const getRequestedScope = (value: string | null): WorkflowDefinitionScope =>
  value === 'global' ? 'global' : 'project'

export function WorkflowTemplateEditorPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { currentProject, loading: projectsLoading } = useProjects()

  const requestedScope = getRequestedScope(searchParams.get('scope'))
  const templateId = searchParams.get('templateId')
  const returnTo =
    searchParams.get('returnTo') ||
    (requestedScope === 'global' ? buildSettingsRoute('pipelineTemplates') : '/pipeline-templates')

  const [loadingTemplate, setLoadingTemplate] = useState(Boolean(templateId))
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<WorkflowDefinition | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadTemplate = async () => {
      if (!templateId) {
        setEditingTemplate(null)
        setLoadingError(null)
        setLoadingTemplate(false)
        return
      }

      setLoadingTemplate(true)
      setLoadingError(null)

      try {
        const template = await db.getWorkflowDefinition(templateId)

        if (cancelled) return

        if (!template) {
          setEditingTemplate(null)
          setLoadingError('Workflow template not found.')
          return
        }

        setEditingTemplate(template)
      } catch (err) {
        if (cancelled) return
        setEditingTemplate(null)
        setLoadingError(String(err))
      } finally {
        if (!cancelled) {
          setLoadingTemplate(false)
        }
      }
    }

    void loadTemplate()

    return () => {
      cancelled = true
    }
  }, [templateId])

  const editorScope = editingTemplate?.scope ?? requestedScope
  const targetProjectId =
    editorScope === 'project' ? (editingTemplate?.project_id ?? currentProject?.id ?? null) : null

  const subtitle = useMemo(() => {
    if (editorScope === 'global') {
      return t.settings.globalPipelineTemplatesTitle
    }

    return currentProject?.name || t.task.pipelineTemplateNoProjectTitle
  }, [
    currentProject?.name,
    editorScope,
    t.settings.globalPipelineTemplatesTitle,
    t.task.pipelineTemplateNoProjectTitle
  ])

  const title = editingTemplate
    ? t.task.pipelineTemplateEditTitle
    : t.task.pipelineTemplateCreateTitle

  const handleBack = useCallback(() => {
    navigate(returnTo)
  }, [navigate, returnTo])

  const handleSubmit = useCallback(
    async (values: WorkflowTemplateFormValues) => {
      const definition = buildWorkflowDefinitionFromForm(values)

      if (editorScope === 'project' && !targetProjectId) {
        throw new Error(t.task.pipelineTemplateNoProject)
      }

      if (editingTemplate) {
        await db.updateWorkflowDefinition({
          id: editingTemplate.id,
          scope: editorScope,
          project_id: targetProjectId,
          name: values.name,
          description: values.description,
          definition
        })
      } else {
        await db.createWorkflowDefinition({
          scope: editorScope,
          project_id: targetProjectId,
          name: values.name,
          description: values.description,
          definition
        })
      }

      navigate(returnTo, { replace: true })
    },
    [
      editingTemplate,
      editorScope,
      navigate,
      returnTo,
      t.task.pipelineTemplateNoProject,
      targetProjectId
    ]
  )

  if (projectsLoading || loadingTemplate) {
    return (
      <PageFrame>
        <PageHeader title={title} subtitle={subtitle} />
        <PageBody>
          <div className="text-muted-foreground">{t.common.loading}</div>
        </PageBody>
      </PageFrame>
    )
  }

  if (loadingError) {
    return (
      <PageFrame>
        <PageHeader title={title} subtitle={subtitle} />
        <PageBody>
          <EmptyStatePanel
            title={title}
            description={loadingError}
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

  if (editorScope === 'project' && !targetProjectId) {
    return (
      <PageFrame>
        <PageHeader title={title} subtitle={t.task.pipelineTemplateNoProjectTitle} />
        <PageBody>
          <EmptyStatePanel
            title={t.task.pipelineTemplateNoProjectTitle}
            description={t.task.pipelineTemplateNoProject}
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
      <PageHeader title={title} subtitle={subtitle} />
      <PageBody className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SurfaceCard className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] p-5 md:p-6">
          <WorkflowTemplateEditor
            initialValues={editingTemplate ? workflowDefinitionToFormValues(editingTemplate) : null}
            onCancel={handleBack}
            onSubmit={handleSubmit}
          />
        </SurfaceCard>
      </PageBody>
    </PageFrame>
  )
}
