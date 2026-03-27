import { Clock } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Task } from '@/data'
import type { AgentMessage } from '@features/cli-session'

import { statusConfig } from '../constants'
import type {
  CLIToolInfo,
  ExecutionStatus,
  LanguageStrings,
  PipelineDisplayStatus,
  PipelineStatus,
  PipelineTemplate,
  TaskMetaRow,
  WorkflowCurrentNode,
  WorkflowGraph,
  WorkflowNode,
  WorkflowReviewNode
} from '../types'
import { filterVisibleMetaRows } from '../types'

interface UseTaskDetailViewModelInput {
  taskId?: string
  task: Task | null
  initialPrompt: string
  messages: AgentMessage[]
  isRunning: boolean
  cliStatus: ExecutionStatus
  useCliSession: boolean
  cliTools: CLIToolInfo[]
  executionLogToolId: string
  pipelineTemplate: PipelineTemplate | null
  pipelineStatus: PipelineStatus
  workflowGraph: WorkflowGraph
  workflowCurrentNode: WorkflowCurrentNode | null
  currentTaskNode: WorkflowReviewNode | null
  selectedWorkflowNode: WorkflowNode | null
  t: LanguageStrings
}

export function useTaskDetailViewModel({
  taskId,
  task,
  initialPrompt,
  messages,
  isRunning,
  cliStatus,
  useCliSession,
  cliTools,
  executionLogToolId,
  pipelineTemplate,
  pipelineStatus,
  workflowGraph,
  workflowCurrentNode,
  currentTaskNode,
  selectedWorkflowNode,
  t
}: UseTaskDetailViewModelInput) {
  const [hasStartedOnce, setHasStartedOnce] = useState(false)

  const normalizedTaskStatus = useMemo<PipelineDisplayStatus>(() => {
    const rawStatus = task?.status
    if (!rawStatus) {
      return 'todo'
    }

    if (['todo', 'in_progress', 'in_review', 'done', 'failed'].includes(rawStatus)) {
      return rawStatus as PipelineDisplayStatus
    }

    return 'todo'
  }, [task?.status])

  const isCliTaskReviewPending = useMemo(
    () => Boolean(useCliSession && task?.task_mode !== 'workflow' && task?.status === 'in_review'),
    [task?.status, task?.task_mode, useCliSession]
  )

  useEffect(() => {
    if (task?.status && normalizedTaskStatus !== 'todo') {
      setHasStartedOnce(true)
    }
  }, [normalizedTaskStatus, task?.status])

  useEffect(() => {
    if (messages.length > 0) {
      setHasStartedOnce(true)
    }
  }, [messages.length])

  useEffect(() => {
    setHasStartedOnce(false)
  }, [taskId])

  const markStartedOnce = useCallback(() => {
    setHasStartedOnce(true)
  }, [])

  const displayTitle = task?.title || task?.prompt || initialPrompt

  const startDisabled = useMemo(() => {
    if (!taskId) {
      return true
    }

    if (task?.task_mode === 'workflow') {
      return (
        !pipelineTemplate ||
        pipelineStatus !== 'idle' ||
        isRunning ||
        (useCliSession && cliStatus === 'running')
      )
    }

    if (useCliSession) {
      return cliStatus === 'running'
    }

    return isRunning
  }, [
    cliStatus,
    isRunning,
    pipelineStatus,
    pipelineTemplate,
    task?.task_mode,
    taskId,
    useCliSession
  ])

  const hasExecuted = useMemo(() => {
    if (messages.length > 0 || hasStartedOnce || isRunning) {
      return true
    }

    if (!task) {
      return false
    }

    return Boolean(task.status && normalizedTaskStatus !== 'todo')
  }, [hasStartedOnce, isRunning, messages.length, normalizedTaskStatus, task])

  const showStartButton = !hasExecuted

  const displayStatus = useMemo<PipelineDisplayStatus | null>(() => {
    if (!task?.status) {
      return null
    }

    return normalizedTaskStatus
  }, [normalizedTaskStatus, task?.status])

  const statusInfo = displayStatus ? statusConfig[displayStatus] : null
  const StatusIcon = statusInfo?.icon || Clock

  const executionStatus = useMemo<ExecutionStatus>(() => {
    if (useCliSession) {
      return cliStatus
    }

    return isRunning ? 'running' : 'idle'
  }, [cliStatus, isRunning, useCliSession])

  const cliStatusInfo = useMemo(() => {
    const statusMap = {
      idle: { label: t.task.cliStatusIdle || 'Idle', color: 'text-muted-foreground bg-muted/60' },
      running: {
        label: t.task.cliStatusRunning || 'Running',
        color: 'text-blue-600 bg-blue-500/10'
      },
      stopped: {
        label: t.task.cliStatusStopped || 'Stopped',
        color: 'text-emerald-600 bg-emerald-500/10'
      },
      error: { label: t.task.cliStatusError || 'Error', color: 'text-red-600 bg-red-500/10' }
    }

    return statusMap[executionStatus]
  }, [
    executionStatus,
    t.task.cliStatusError,
    t.task.cliStatusIdle,
    t.task.cliStatusRunning,
    t.task.cliStatusStopped
  ])

  const showWorkflowCard = useMemo(() => Boolean(task?.task_mode === 'workflow'), [task?.task_mode])

  const workflowSummary = useMemo(() => {
    if (!showWorkflowCard) {
      return null
    }

    const nodes = [...workflowGraph.nodes].sort((left, right) => left.node_order - right.node_order)
    const total = nodes.length
    const completed = nodes.filter((node) => node.status === 'done').length
    const inProgress = nodes.filter((node) => node.status === 'in_progress').length
    const inReview = nodes.filter((node) => node.status === 'in_review').length
    const failed = nodes.filter((node) => node.status === 'failed').length
    const pending = Math.max(total - completed - inProgress - inReview - failed, 0)

    const runtimeNodeId = workflowCurrentNode?.id ?? currentTaskNode?.id ?? null
    const currentGraphNode =
      (runtimeNodeId ? nodes.find((node) => node.id === runtimeNodeId) : null) ??
      nodes.find((node) => node.isCurrent) ??
      nodes.find((node) => node.status === 'in_review' || node.status === 'in_progress') ??
      nodes[0] ??
      null

    return {
      total,
      completed,
      pending,
      inProgress,
      inReview,
      failed,
      currentNodeName: currentTaskNode?.name ?? currentGraphNode?.name ?? null,
      currentNodeStatus: currentTaskNode?.status ?? currentGraphNode?.status ?? null
    }
  }, [currentTaskNode, showWorkflowCard, workflowCurrentNode?.id, workflowGraph.nodes])

  const selectedWorkflowNodeIsDone = useMemo(
    () => Boolean(task?.task_mode === 'workflow' && selectedWorkflowNode?.status === 'done'),
    [selectedWorkflowNode?.status, task?.task_mode]
  )

  const selectedWorkflowNodeIsFailed = useMemo(
    () => Boolean(task?.task_mode === 'workflow' && selectedWorkflowNode?.status === 'failed'),
    [selectedWorkflowNode?.status, task?.task_mode]
  )

  const showActionButton = showStartButton || isCliTaskReviewPending || selectedWorkflowNodeIsFailed
  const actionKind = selectedWorkflowNodeIsFailed
    ? ('retry' as const)
    : isCliTaskReviewPending
      ? ('complete' as const)
      : ('start' as const)

  const actionLabel = selectedWorkflowNodeIsFailed
    ? 'Retry node'
    : isCliTaskReviewPending
      ? t.task.completeTask || 'Complete task'
      : t.task.startExecution || 'Start'

  const actionDisabled = selectedWorkflowNodeIsFailed
    ? false
    : isCliTaskReviewPending
      ? false
      : startDisabled

  const isTaskDone = task?.status === 'done'
  const replyDisabled = Boolean(isTaskDone || selectedWorkflowNodeIsDone)

  const replyPlaceholder = useMemo(() => {
    if (isTaskDone) {
      return '任务已结束'
    }

    if (selectedWorkflowNodeIsDone) {
      return '当前节点已结束，请切换到进行中的节点继续提问'
    }

    return '有疑问，继续问我…'
  }, [isTaskDone, selectedWorkflowNodeIsDone])

  const cliToolName = useMemo(() => {
    if (!executionLogToolId) {
      return null
    }

    const match = cliTools.find((tool) => tool.id === executionLogToolId)
    return match?.displayName || match?.name || executionLogToolId
  }, [cliTools, executionLogToolId])

  const cliToolLabel = cliToolName || t.task.detailCli || 'CLI'

  const metaRows = useMemo<TaskMetaRow[]>(
    () => [
      {
        key: 'status',
        icon: StatusIcon,
        value: statusInfo ? (
          <span className="text-foreground text-xs font-medium">{statusInfo.label}</span>
        ) : null,
        visible: Boolean(statusInfo)
      }
    ],
    [statusInfo, StatusIcon]
  )

  const visibleMetaRows = filterVisibleMetaRows(metaRows)
  const replyIsRunning = useMemo(() => (useCliSession ? cliStatus === 'running' : isRunning), [
    cliStatus,
    isRunning,
    useCliSession
  ])

  return {
    normalizedTaskStatus,
    isCliTaskReviewPending,
    markStartedOnce,
    displayTitle,
    startDisabled,
    showWorkflowCard,
    workflowSummary,
    selectedWorkflowNodeIsDone,
    selectedWorkflowNodeIsFailed,
    showActionButton,
    actionKind,
    actionLabel,
    actionDisabled,
    replyDisabled,
    replyPlaceholder,
    cliToolLabel,
    cliStatusInfo,
    visibleMetaRows,
    replyIsRunning
  }
}
