import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Clock, GitBranch, Play, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TaskWithWorktree as Task } from '@shared/contracts/task'

import { deleteTaskWithSideEffects } from '../usecases/task-mutations'

interface TaskListProps {
  projectId?: string
  onTaskSelect?: (task: Task) => void
  className?: string
}

const statusIcons = {
  todo: Clock,
  in_progress: Play,
  in_review: Clock,
  done: CheckCircle,
  failed: AlertTriangle
}

const statusColors = {
  todo: 'text-muted-foreground',
  in_progress: 'text-blue-500',
  in_review: 'text-amber-500',
  done: 'text-green-500',
  failed: 'text-red-500'
}

function normalizeTaskStatus(status: string): keyof typeof statusIcons {
  if (['todo', 'in_progress', 'in_review', 'done', 'failed'].includes(status)) {
    return status as keyof typeof statusIcons
  }
  return 'todo'
}

export function TaskList({ projectId, onTaskSelect, className }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const data = projectId
        ? await window.api.task.getByProject(projectId)
        : await window.api.task.getAll()
      setTasks(data)
    } catch (error) {
      console.error('Failed to load tasks:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadTasks()
  }, [loadTasks])

  const handleDelete = async (taskId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      await deleteTaskWithSideEffects(taskId, true)
      setTasks((prev) => prev.filter((task) => task.id !== taskId))
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="text-muted-foreground">Loading tasks...</div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="text-muted-foreground">No tasks yet</div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {tasks.map((task) => {
        const normalizedStatus = normalizeTaskStatus(task.status)
        const StatusIcon = statusIcons[normalizedStatus] || Clock
        const statusColor = statusColors[normalizedStatus] || 'text-muted-foreground'

        return (
          <div
            key={task.id}
            onClick={() => onTaskSelect?.(task)}
            className="group flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
          >
            <StatusIcon className={cn('mt-0.5 h-5 w-5 shrink-0', statusColor)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{task.title || task.prompt}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                {task.branchName && (
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    {task.branchName}
                  </span>
                )}
                <span>{new Date(task.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(event) => void handleDelete(task.id, event)}
              className="shrink-0 opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
