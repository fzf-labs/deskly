import { AlertTriangle, Check, Circle, Clock } from 'lucide-react'

import { cn } from '@/lib/utils'

interface TaskNode {
  id: string
  name: string
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'failed'
  node_order: number
}

interface WorkflowProgressBarProps {
  nodes: TaskNode[]
  currentNodeIndex: number
}

export function WorkflowProgressBar({ nodes, currentNodeIndex }: WorkflowProgressBarProps) {
  const completedCount = nodes.filter((node) => node.status === 'done').length
  const progress = nodes.length > 0 ? (completedCount / nodes.length) * 100 : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {completedCount}/{nodes.length}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {nodes.map((node, index) => (
          <TaskNodeStatusBadge key={node.id} node={node} isCurrent={index === currentNodeIndex} />
        ))}
      </div>
    </div>
  )
}

interface TaskNodeStatusBadgeProps {
  node: TaskNode
  isCurrent: boolean
}

function TaskNodeStatusBadge({ node, isCurrent }: TaskNodeStatusBadgeProps) {
  const statusConfig = {
    todo: {
      icon: Circle,
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-muted-foreground',
      ring: ''
    },
    in_progress: {
      icon: Clock,
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-600 dark:text-blue-400',
      ring: 'ring-2 ring-blue-500'
    },
    in_review: {
      icon: Clock,
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-600 dark:text-amber-400',
      ring: 'ring-2 ring-amber-500'
    },
    done: {
      icon: Check,
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      text: 'text-emerald-600 dark:text-emerald-400',
      ring: ''
    },
    failed: {
      icon: AlertTriangle,
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-600 dark:text-red-400',
      ring: 'ring-2 ring-red-500'
    }
  }

  const config = statusConfig[node.status]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-full px-2 py-1 text-xs',
        config.bg,
        config.text,
        isCurrent && config.ring
      )}
    >
      <Icon className="size-3" />
      <span className="max-w-20 truncate">{node.name}</span>
    </div>
  )
}
