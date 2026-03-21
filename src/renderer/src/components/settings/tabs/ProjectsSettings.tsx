import { useMemo, useState } from 'react';
import { MoreVertical } from 'lucide-react';

import { CreateProjectDialog, ProjectEditDialog } from '@/components/projects/ProjectDialogs';
import { EmptyStatePanel } from '@/components/shared/page-shell';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjects, type Project } from '@/hooks/useProjects';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/providers/language-provider';

export function ProjectsSettings() {
  const { t, tt } = useLanguage();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);

  const { projects, currentProject, addProject, updateProject, deleteProject, setCurrentProjectId } =
    useProjects();

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [projects]
  );

  const handleDeleteProject = async (project: Project) => {
    if (confirm(tt('settings.projectsDeleteConfirm', { name: project.name }))) {
      await deleteProject(project.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-foreground text-xl font-semibold">{t.settings.projects}</h2>
          <p className="text-muted-foreground text-sm leading-6">
            {t.settings.projectsDescription}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>{t.settings.projectsCreate}</Button>
      </div>

      {sortedProjects.length === 0 ? (
        <EmptyStatePanel
          title={t.settings.projectsEmptyTitle}
          description={t.settings.projectsEmptyDescription}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sortedProjects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => setCurrentProjectId(project.id)}
              className={cn(
                'surface-card rounded-[24px] border bg-card/92 px-4 py-4 text-left transition-colors hover:bg-card',
                currentProject?.id === project.id
                  ? 'border-primary/60 ring-primary/10 ring-1'
                  : 'border-border/70'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="truncate text-sm font-semibold">{project.name}</div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(event) => event.stopPropagation()}
                          className="text-muted-foreground hover:bg-muted flex size-6 items-center justify-center rounded-md transition-colors"
                          aria-label={t.common.edit}
                        >
                          <MoreVertical className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditProject(project);
                          }}
                        >
                          {t.common.edit}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDeleteProject(project);
                          }}
                        >
                          {t.common.delete}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="text-muted-foreground mt-1 truncate text-xs">{project.path}</div>
                  <div className="text-muted-foreground mt-1 truncate text-xs">
                    {project.description || t.settings.projectsNoDescription}
                  </div>
                  <div className="text-muted-foreground mt-2 text-[11px]">
                    {tt('settings.projectsUpdatedAt', {
                      value: new Date(project.updatedAt).toLocaleString(),
                    })}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onAddProject={addProject}
        onSetCurrentProject={setCurrentProjectId}
      />
      <ProjectEditDialog
        project={editProject}
        onOpenChange={(open) => !open && setEditProject(null)}
        onUpdate={updateProject}
      />
    </div>
  );
}
