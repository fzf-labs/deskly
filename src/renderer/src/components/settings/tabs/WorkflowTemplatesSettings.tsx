import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import { db } from '@/data';
import { useLanguage } from '@/providers/language-provider';
import {
  buildWorkflowDefinitionFromForm,
  WorkflowTemplateDialog,
  type WorkflowTemplateFormValues,
  workflowDefinitionToFormValues,
} from '@/components/pipeline';
import type { WorkflowDefinition } from '@/data';

export function WorkflowTemplatesSettings() {
  const { t } = useLanguage();
  const [templates, setTemplates] = useState<WorkflowDefinition[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<WorkflowDefinition | null>(null);

  const loadTemplates = async () => {
    const list = (await db.listWorkflowDefinitions({
      scope: 'global',
    })) as WorkflowDefinition[];
    setTemplates(list);
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const handleCreate = () => {
    setEditingTemplate(null);
    setDialogOpen(true);
  };

  const handleEdit = (template: WorkflowDefinition) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: WorkflowTemplateFormValues) => {
    const definition = buildWorkflowDefinitionFromForm(values);
    if (editingTemplate) {
      await db.updateWorkflowDefinition({
        id: editingTemplate.id,
        scope: 'global',
        name: values.name,
        description: values.description,
        definition,
      });
    } else {
      await db.createWorkflowDefinition({
        scope: 'global',
        name: values.name,
        description: values.description,
        definition,
      });
    }
    await loadTemplates();
  };

  const handleDelete = async (template: WorkflowDefinition) => {
    if (
      !confirm(
        t.task.pipelineTemplateDeleteConfirm.replace('{name}', template.name)
      )
    ) {
      return;
    }
    await db.deleteWorkflowDefinition(template.id);
    await loadTemplates();
  };

  const nodeCount = (template: WorkflowDefinition) =>
    t.task.pipelineTemplateStageCount.replace(
      '{count}',
      `${template.definition.nodes?.length || 0}`
    );

  const dialogTitle = editingTemplate
    ? t.task.pipelineTemplateEditTitle
    : t.task.pipelineTemplateCreateTitle;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">
            {t.settings.globalPipelineTemplatesTitle}
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {t.settings.globalPipelineTemplatesDescription}
          </p>
        </div>
        <Button onClick={handleCreate}>{t.task.createTemplateButton}</Button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {t.settings.globalPipelineTemplatesEmpty}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-md border bg-card px-3 py-2 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold truncate">
                      {template.name}
                    </div>
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
                        <DropdownMenuItem
                          onClick={() => handleEdit(template)}
                        >
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
                  <div className="text-muted-foreground mt-2 text-xs">
                    {nodeCount(template)}
                  </div>
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

      <WorkflowTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogTitle}
        initialValues={
          editingTemplate
            ? workflowDefinitionToFormValues(editingTemplate)
            : null
        }
        onSubmit={handleSubmit}
      />
    </div>
  );
}
