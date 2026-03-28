import { Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Dialog, DialogContent } from '@/components/ui/dialog'

import { TaskComposer } from './TaskComposer'
import { GENERATED_WORKFLOW_REVIEW_ROUTE } from '../model/task-create'

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: string
  projectName?: string
  projectPath?: string
  projectType?: 'normal' | 'git'
  onTaskCreated?: (task: any) => void
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  projectPath,
  projectType = 'normal',
  onTaskCreated
}: CreateTaskDialogProps) {
  const navigate = useNavigate()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="bg-muted flex size-10 items-center justify-center rounded-full">
              <Sparkles className="size-5" />
            </div>
            <h2 className="text-foreground text-3xl font-semibold tracking-tight">
              我能为你做什么？
            </h2>
          </div>

          <TaskComposer
            active={open}
            resetOnActivate
            projectId={projectId}
            projectName={projectName}
            projectPath={projectPath}
            projectType={projectType}
            titleRequired
            titlePlaceholder="标题"
            promptPlaceholder="提示词"
            autoFocus
            className="w-full"
            onOpenGeneratedWorkflowReview={async (request) => {
              onOpenChange(false)
              navigate(GENERATED_WORKFLOW_REVIEW_ROUTE, {
                state: {
                  ...request,
                  returnTo: '/board'
                }
              })
            }}
            onCreated={async (task, context) => {
              onTaskCreated?.(task)
              onOpenChange(false)

              if (context.navigateToTaskDetail) {
                navigate(`/task/${(task as { id: string }).id}`, {
                  state: {
                    prompt: context.prompt,
                    attachments: context.attachments,
                    startError: context.startError
                  }
                })
              }
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
