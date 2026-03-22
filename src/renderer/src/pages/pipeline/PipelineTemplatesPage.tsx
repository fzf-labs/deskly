import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { MoreVertical } from 'lucide-react'
import { useProjects } from '@/hooks/useProjects'
import { db, type WorkflowDefinition } from '@/data'
import { useLanguage } from '@/providers/language-provider'
import { EmptyStatePanel, PageBody, PageFrame, PageHeader } from '@/components/shared/page-shell'
import {
  buildWorkflowDefinitionFromForm,
  WorkflowTemplateDialog,
  type WorkflowTemplateFormValues,
  workflowDefinitionToFormValues
} from '@/components/pipeline'
import { Select } from '@/components/ui/select'

export function PipelineTemplatesPage() {
  const { t } = useLanguage()
  const { currentProject } = useProjects()
  const [templates, setTemplates] = useState<WorkflowDefinition[]>([])
  const [globalTemplates, setGlobalTemplates] = useState<WorkflowDefinition[]>([])
  const [copyTemplateId, setCopyTemplateId] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<WorkflowDefinition | null>(null)

  const projectId = currentProject?.id

  const loadTemplates = useCallback(async () => {
    if (!projectId) {
      setTemplates([])
      return
    }
    const list = (await db.listWorkflowDefinitions({
      scope: 'project',
      projectId
    })) as WorkflowDefinition[]
    setTemplates(list)
  }, [projectId])

  const loadGlobalTemplates = useCallback(async () => {
    const list = (await db.listWorkflowDefinitions({ scope: 'global' })) as WorkflowDefinition[]
    setGlobalTemplates(list)
  }, [])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    setCopyTemplateId('')
  }, [projectId])

  useEffect(() => {
    void loadGlobalTemplates()
  }, [loadGlobalTemplates])

  const handleCreate = () => {
    setEditingTemplate(null)
    setDialogOpen(true)
  }

  const handleEdit = (template: WorkflowDefinition) => {
    setEditingTemplate(template)
    setDialogOpen(true)
  }

  const handleSubmit = async (values: WorkflowTemplateFormValues) => {
    if (!projectId) return
    const definition = buildWorkflowDefinitionFromForm(values)
    if (editingTemplate) {
      await db.updateWorkflowDefinition({
        id: editingTemplate.id,
        scope: 'project',
        project_id: projectId,
        name: values.name,
        description: values.description,
        definition
      })
    } else {
      await db.createWorkflowDefinition({
        scope: 'project',
        project_id: projectId,
        name: values.name,
        description: values.description,
        definition
      })
    }
    await loadTemplates()
  }

  const handleDelete = async (template: WorkflowDefinition) => {
    if (!confirm(t.task.pipelineTemplateDeleteConfirm.replace('{name}', template.name))) {
      return
    }
    await db.deleteWorkflowDefinition(template.id)
    await loadTemplates()
  }

  const handleCopyFromGlobal = async () => {
    if (!projectId || !copyTemplateId) return
    const source = await db.getWorkflowDefinition(copyTemplateId)
    if (!source) return
    await db.createWorkflowDefinition({
      scope: 'project',
      project_id: projectId,
      name: source.name,
      description: source.description,
      definition: source.definition
    })
    setCopyTemplateId('')
    await loadTemplates()
  }

  const stageCount = (template: WorkflowDefinition) =>
    t.task.pipelineTemplateStageCount.replace('{count}', `${template.definition.nodes?.length || 0}`)

  const dialogTitle = editingTemplate
    ? t.task.pipelineTemplateEditTitle
    : t.task.pipelineTemplateCreateTitle

  return (
    <PageFrame>
      <PageHeader
        title={t.task.pipelineTemplatePageTitle}
        subtitle={currentProject ? currentProject.name : t.task.pipelineTemplateNoProjectTitle}
        actions={
          <Button onClick={handleCreate} disabled={!projectId}>
            {t.task.createTemplateButton}
          </Button>
        }
      />

      <PageBody className="space-y-4">
        {currentProject && (
          <div className="surface-card flex flex-wrap items-center gap-3 rounded-[24px] border border-border/70 bg-card/92 px-4 py-4">
            <div className="text-sm font-medium">{t.task.pipelineTemplateCopyLabel}</div>
            <Select
              value={copyTemplateId}
              onValueChange={setCopyTemplateId}
              placeholder={t.task.pipelineTemplateCopyPlaceholder}
              triggerClassName="min-w-[220px] rounded-full px-4"
              options={globalTemplates.map((template) => ({
                value: template.id,
                label: template.name
              }))}
            />
            <Button variant="outline" onClick={handleCopyFromGlobal} disabled={!copyTemplateId}>
              {t.task.pipelineTemplateCopyButton}
            </Button>
            {globalTemplates.length === 0 && (
              <span className="text-muted-foreground text-xs">
                {t.task.pipelineTemplateGlobalEmpty}
              </span>
            )}
          </div>
        )}

        {!currentProject ? (
          <EmptyStatePanel
            title={t.task.pipelineTemplateNoProjectTitle}
            description={t.task.pipelineTemplateNoProject}
          />
        ) : templates.length === 0 ? (
          <EmptyStatePanel
            title={t.task.pipelineTemplateEmptyTitle}
            description={t.task.pipelineTemplateEmptyDescription}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="surface-card rounded-[24px] border border-border/70 bg-card/92 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold truncate">{template.name}</div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground hover:bg-muted flex size-6 items-center justify-center rounded-md transition-colors"
                          >
                            <MoreVertical className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(template)}>
                            {t.common.edit}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(template)}
                          >
                            {t.common.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="text-muted-foreground mt-1 truncate text-xs">
                      {template.description || t.task.pipelineTemplateNoDescription}
                    </div>
                    <div className="text-muted-foreground mt-2 text-xs">{stageCount(template)}</div>
                    <div className="text-muted-foreground mt-1 text-[11px]">
                      {t.task.pipelineTemplateUpdatedAt.replace(
                        '{time}',
                        new Date(template.updated_at).toLocaleString()
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageBody>

      <WorkflowTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogTitle}
        initialValues={
          editingTemplate ? workflowDefinitionToFormValues(editingTemplate) : null
        }
        onSubmit={handleSubmit}
      />
    </PageFrame>
  )
}
