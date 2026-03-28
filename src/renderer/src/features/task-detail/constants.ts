import { taskStatusUi, type TaskStatusUiConfig } from '@features/tasks'
import type { PipelineDisplayStatus } from './types';

export const statusConfig: Record<
  PipelineDisplayStatus,
  TaskStatusUiConfig
> = Object.fromEntries(
  Object.entries(taskStatusUi).map(([status, config]) => [
    status,
    {
      icon: config.icon,
      label: config.label,
      color: config.badgeColor
    }
  ])
) as Record<PipelineDisplayStatus, TaskStatusUiConfig & { color: string }>
