import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { MoreVertical } from 'lucide-react'
import { useProjects } from '@/hooks/useProjects'
import { db, type WorkflowDefinition } from '@/data'
import { useConfirm } from '@/providers/feedback-provider'
import { useLanguage } from '@/providers/language-provider'
import { EmptyStatePanel, PageBody, PageFrame, PageHeader } from '@/components/shared/page-shell'
import { Select } from '@/components/ui/select'

import { buildWorkflowTemplateEditorRoute } from '../ui/routes'

export function PipelineTemplatesPage() {
  const { t } = useLanguage()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { currentProject } = useProjects()
  const [templates, setTemplates] = useState<WorkflowDefinition[]>([])
  const [globalTemplates, setGlobalTemplates] = useState<WorkflowDefinition[]>([])
  const [copyTemplateId, setCopyTemplateId] = useState('')
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)

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
    navigate(
      buildWorkflowTemplateEditorRoute({
        scope: 'project'
      })
    )
  }

  const handleEdit = (template: WorkflowDefinition) => {
    navigate(
      buildWorkflowTemplateEditorRoute({
        scope: 'project',
        templateId: template.id
      })
    )
  }

  const handleDelete = async (template: WorkflowDefinition) => {
    const confirmed = await confirm({
      title: t.common.delete,
      description: t.task.pipelineTemplateDeleteConfirm.replace('{name}', template.name),
      confirmText: t.common.delete,
      cancelText: t.common.cancel,
      tone: 'danger'
    })

    if (!confirmed) {
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
    setCopyDialogOpen(false)
    await loadTemplates()
  }

  const stageCount = (template: WorkflowDefinition) =>
    t.task.pipelineTemplateStageCount.replace(
      '{count}',
      `${template.definition.nodes?.length || 0}`
    )
  return (
    <PageFrame>
      <PageHeader
        title={t.task.pipelineTemplatePageTitle}
        subtitle={currentProject ? currentProject.name : t.task.pipelineTemplateNoProjectTitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCopyDialogOpen(true)}
              disabled={!projectId}
            >
              {t.task.pipelineTemplateCopyLabel}
            </Button>
            <Button onClick={handleCreate} disabled={!projectId}>
              {t.task.createTemplateButton}
            </Button>
          </div>
        }
      />

      <PageBody className="space-y-4">
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

      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.task.pipelineTemplateCopyLabel}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {globalTemplates.length === 0 ? (
              <div className="text-muted-foreground text-sm">{t.task.pipelineTemplateGlobalEmpty}</div>
            ) : (
              <div>
                <label className="text-sm font-medium">{t.task.pipelineTemplateCopyPlaceholder}</label>
                <div className="mt-1.5">
                  <Select
                    value={copyTemplateId}
                    onValueChange={setCopyTemplateId}
                    placeholder={t.task.pipelineTemplateCopyPlaceholder}
                    options={globalTemplates.map((template) => ({
                      value: template.id,
                      label: template.name
                    }))}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button onClick={() => void handleCopyFromGlobal()} disabled={!copyTemplateId}>
                {t.task.pipelineTemplateCopyButton}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageFrame>
  )
}
