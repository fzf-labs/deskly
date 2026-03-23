import { Sparkles } from 'lucide-react'

import { Dialog, DialogContent } from '@/components/ui/dialog'

import { TaskComposer } from './TaskComposer'

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: string
  projectPath?: string
  projectType?: 'normal' | 'git'
  onTaskCreated?: (task: any) => void
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  projectId,
  projectPath,
  projectType = 'normal',
  onTaskCreated
}: CreateTaskDialogProps) {
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
            projectPath={projectPath}
            projectType={projectType}
            titleRequired
            titlePlaceholder="标题"
            promptPlaceholder="提示词"
            autoFocus
            className="w-full"
            onCreated={async (task) => {
              onTaskCreated?.(task)
              onOpenChange(false)
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
