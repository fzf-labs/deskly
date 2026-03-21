import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyStatePanel, PageBody, PageFrame, PageHeader } from '@/components/shared/page-shell'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useProjects, type Project } from '@/hooks/useProjects'
import { CreateProjectDialog, ProjectEditDialog } from '@/components/projects/ProjectDialogs'
import { MoreVertical } from 'lucide-react'

export function ProjectsPage() {
  const navigate = useNavigate()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)

  const { projects, addProject, updateProject, deleteProject, setCurrentProjectId } = useProjects()

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [projects]
  )

  const handleDeleteProject = async (project: Project) => {
    if (confirm(`确定要删除项目“${project.name}”吗？`)) {
      await deleteProject(project.id)
    }
  }

  const handleOpenProject = (project: Project) => {
    setCurrentProjectId(project.id)
    navigate('/tasks')
  }

  return (
    <PageFrame>
      <PageHeader
        title="项目管理"
        subtitle="在这里创建、编辑或删除项目。"
        actions={<Button onClick={() => setCreateDialogOpen(true)}>新建项目</Button>}
      />
      <PageBody>
        {sortedProjects.length === 0 ? (
          <EmptyStatePanel
            title="暂无项目"
            description="创建一个项目来开始使用 Deskly。项目可以是本地目录或通过仓库克隆。"
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {sortedProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => handleOpenProject(project)}
                className="surface-card rounded-[24px] border border-border/70 bg-card/92 px-4 py-4 text-left transition-colors hover:bg-card"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold truncate">{project.name}</div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(event) => event.stopPropagation()}
                            className="text-muted-foreground hover:bg-muted flex size-6 items-center justify-center rounded-md transition-colors"
                          >
                            <MoreVertical className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(event) => {
                              event.stopPropagation()
                              setEditProject(project)
                            }}
                          >
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleDeleteProject(project)
                            }}
                          >
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="text-muted-foreground mt-1 truncate text-xs">
                      {project.path}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs truncate">
                      {project.description || '暂无描述'}
                    </div>
                    <div className="text-muted-foreground mt-2 text-[11px]">
                      最近更新：{new Date(project.updatedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </PageBody>

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
    </PageFrame>
  )
}
