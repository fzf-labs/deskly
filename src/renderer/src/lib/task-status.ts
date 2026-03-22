import { AlertTriangle, CheckCircle, Clock, Play } from 'lucide-react'

import type { TaskStatus } from '@/data'

type TaskStatusIcon = typeof Clock

export interface TaskStatusUiConfig {
  icon: TaskStatusIcon
  label: string
  badgeColor: string
  dotColor: string
  subtleTextColor: string
}

export const taskStatusUi: Record<TaskStatus, TaskStatusUiConfig> = {
  todo: {
    icon: Clock,
    label: 'Todo',
    badgeColor: 'text-slate-500 bg-slate-500/10',
    dotColor: 'bg-slate-400',
    subtleTextColor: 'text-slate-500'
  },
  in_progress: {
    icon: Play,
    label: 'In Progress',
    badgeColor: 'text-blue-500 bg-blue-500/10',
    dotColor: 'bg-blue-500',
    subtleTextColor: 'text-blue-500'
  },
  in_review: {
    icon: Clock,
    label: 'In Review',
    badgeColor: 'text-amber-500 bg-amber-500/10',
    dotColor: 'bg-amber-500',
    subtleTextColor: 'text-amber-600'
  },
  done: {
    icon: CheckCircle,
    label: 'Done',
    badgeColor: 'text-green-500 bg-green-500/10',
    dotColor: 'bg-emerald-500',
    subtleTextColor: 'text-emerald-600'
  },
  failed: {
    icon: AlertTriangle,
    label: 'Failed',
    badgeColor: 'text-red-500 bg-red-500/10',
    dotColor: 'bg-red-500',
    subtleTextColor: 'text-red-600'
  }
}
