import { useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react'

import { db, type Task, type WorkflowRun, type WorkflowRunNode } from '@/data'
import type { AgentMessage, CLISessionHandle, MessageAttachment } from '@features/cli-session'

import type {
  CurrentNodeRuntime,
  LanguageStrings,
  PipelineStatus,
  PipelineTemplate,
  WorkflowNode
} from '../types'

interface UseTaskDetailActionsInput {
  activeTaskId: string | null
  taskId?: string
  task: Task | null
  selectedWorkflowNode: WorkflowNode | null
  selectedWorkflowNodeIsFailed: boolean
  isRunning: boolean
  useCliSession: boolean
  currentNodeRuntime: CurrentNodeRuntime
  backendWorkflowRun: WorkflowRun | null
  pipelineTemplate: PipelineTemplate | null
  pipelineStatus: PipelineStatus
  useCliSessionPanel: boolean
  cliSessionRef: RefObject<CLISessionHandle | null>
  setTask: Dispatch<SetStateAction<Task | null>>
  setMessages: Dispatch<SetStateAction<AgentMessage[]>>
  setStartupError: Dispatch<SetStateAction<string | null>>
  setBackendWorkflowRun: Dispatch<SetStateAction<WorkflowRun | null>>
  setWorkflowRunNodes: Dispatch<SetStateAction<WorkflowRunNode[]>>
  stopAgent: () => Promise<void>
  stopCli: () => Promise<void>
  loadCurrentNodeRuntime: () => Promise<CurrentNodeRuntime>
  ensureConversationRuntime: (
    taskRecord?: Task | null,
    preferredSessionId?: string | null
  ) => Promise<CurrentNodeRuntime>
  loadMessages: (taskId: string) => Promise<void>
  loadWorkflowStatus: () => Promise<void>
  markStartedOnce: () => void
  resolveCurrentNodePrompt: () => Promise<string>
  buildCliPrompt: (nodePrompt?: string) => string
  startPipelineStage: (index: number, approvalNote?: string) => Promise<void>
  startNextPipelineStage: (approvalNote?: string) => Promise<void>
  appendCliUserLog: (content: string, sessionIdOverride?: string | null) => Promise<string | null>
  appendCliSystemLog: (
    content: string,
    sessionIdOverride?: string | null
  ) => Promise<string | null>
  runCliPrompt: (prompt?: string, sessionIdOverride?: string | null) => Promise<void>
  t: LanguageStrings
}

export function useTaskDetailActions({
  activeTaskId,
  taskId,
  task,
  selectedWorkflowNode,
  selectedWorkflowNodeIsFailed,
  isRunning,
  useCliSession,
  currentNodeRuntime,
  backendWorkflowRun,
  pipelineTemplate,
  pipelineStatus,
  useCliSessionPanel,
  cliSessionRef,
  setTask,
  setMessages,
  setStartupError,
  setBackendWorkflowRun,
  setWorkflowRunNodes,
  stopAgent,
  stopCli,
  loadCurrentNodeRuntime,
  ensureConversationRuntime,
  loadMessages,
  loadWorkflowStatus,
  markStartedOnce,
  resolveCurrentNodePrompt,
  buildCliPrompt,
  startPipelineStage,
  startNextPipelineStage,
  appendCliUserLog,
  appendCliSystemLog,
  runCliPrompt,
  t
}: UseTaskDetailActionsInput) {
  const serverNotRunningMessage =
    t.common.errors.serverNotRunning || 'CLI session is not running.'

  const refreshTaskRecord = useCallback(async (currentTaskId: string) => {
    try {
      const refreshedTask = await db.getTask(currentTaskId)
      if (refreshedTask) {
        setTask(refreshedTask)
      }
    } catch {
      /* ignore */
    }
  }, [setTask])

  const stopAndRefreshTask = useCallback(async () => {
    if (!taskId) {
      return
    }

    try {
      await db.stopTaskExecution(taskId)
    } catch {
      /* ignore */
    }

    await refreshTaskRecord(taskId)
  }, [refreshTaskRecord, taskId])

  const handleReply = useCallback(
    async (text: string, messageAttachments?: MessageAttachment[]) => {
      if (!(text.trim() || (messageAttachments && messageAttachments.length > 0)) || !taskId) {
        return
      }

      let latestRuntime = await loadCurrentNodeRuntime()
      if (task?.task_mode === 'conversation' && !latestRuntime.cliToolId) {
        latestRuntime = await ensureConversationRuntime(task)
      }

      const shouldUseCliSession =
        task?.task_mode === 'workflow' ? useCliSessionPanel : Boolean(latestRuntime.cliToolId)

      if (!shouldUseCliSession && isRunning) {
        return
      }

      if (shouldUseCliSession) {
        if (task?.task_mode === 'workflow' && selectedWorkflowNode?.status === 'done') {
          return
        }

        const content = text.trim()
        let sessionId: string | null = null
        if (content) {
          sessionId = await appendCliUserLog(content)
        }

        if (task?.task_mode !== 'workflow' && task?.status === 'in_review') {
          try {
            const reviewNode = (await db.getCurrentTaskNode(taskId)) as {
              id?: string
              status?: string
            } | null
            if (reviewNode?.id && reviewNode.status === 'in_review') {
              await db.rerunTaskNode(reviewNode.id)
            }
            await refreshTaskRecord(taskId)
          } catch {
            /* ignore */
          }
        }

        if (
          task?.task_mode === 'workflow' &&
          selectedWorkflowNode?.id &&
          selectedWorkflowNode.status === 'failed'
        ) {
          try {
            await db.rerunTaskNode(selectedWorkflowNode.id)
            await refreshTaskRecord(taskId)
          } catch {
            /* ignore */
          }
        }

        try {
          if (content) {
            if (!cliSessionRef.current) {
              throw new Error('CLI session not initialized')
            }
            await runCliPrompt(content, sessionId)
          }
        } catch {
          await appendCliSystemLog(serverNotRunningMessage, sessionId)
        }

        return
      }

      if (activeTaskId !== taskId) {
        await loadMessages(taskId)
      }

      if (pipelineTemplate && (pipelineStatus === 'waiting_approval' || pipelineStatus === 'failed')) {
        const approvalNote = text.trim()
        if (approvalNote) {
          setMessages((previous) => [...previous, { type: 'user', content: approvalNote }])
        }
        await startNextPipelineStage(approvalNote)
        return
      }

      setMessages((previous) => [
        ...previous,
        {
          type: 'error',
          message: serverNotRunningMessage
        }
      ])
    },
    [
      activeTaskId,
      appendCliSystemLog,
      appendCliUserLog,
      cliSessionRef,
      ensureConversationRuntime,
      isRunning,
      loadCurrentNodeRuntime,
      loadMessages,
      pipelineStatus,
      pipelineTemplate,
      refreshTaskRecord,
      runCliPrompt,
      selectedWorkflowNode,
      serverNotRunningMessage,
      setMessages,
      startNextPipelineStage,
      task,
      taskId,
      useCliSessionPanel
    ]
  )

  const handleStartTask = useCallback(async () => {
    if (!taskId) {
      return
    }

    if (selectedWorkflowNodeIsFailed && selectedWorkflowNode?.id) {
      await db.rerunTaskNode(selectedWorkflowNode.id)
      await loadCurrentNodeRuntime()
      await loadWorkflowStatus()
      await refreshTaskRecord(taskId)
      return
    }

    setStartupError(null)
    markStartedOnce()

    let latestRuntime = currentNodeRuntime

    try {
      await db.startTaskExecution(taskId)
      latestRuntime = await loadCurrentNodeRuntime()

      if (task?.task_mode === 'conversation' && !latestRuntime.cliToolId) {
        latestRuntime = await ensureConversationRuntime(task)
      }

      await refreshTaskRecord(taskId)

      const workflowRun = await db.getWorkflowRunByTask(taskId)
      setBackendWorkflowRun(workflowRun)

      if (workflowRun) {
        const runNodes = await db.listWorkflowRunNodes(workflowRun.id)
        setWorkflowRunNodes(Array.isArray(runNodes) ? runNodes : [])
      } else {
        setWorkflowRunNodes([])
      }
    } catch {
      /* ignore */
    }

    if (task?.task_mode === 'workflow') {
      if (backendWorkflowRun) {
        await loadCurrentNodeRuntime()
        await loadWorkflowStatus()
        return
      }

      if (!pipelineTemplate || pipelineStatus !== 'idle' || isRunning) {
        return
      }

      await startPipelineStage(0)
      return
    }

    if (latestRuntime.cliToolId) {
      try {
        if (!cliSessionRef.current) {
          throw new Error('CLI session not initialized')
        }

        const prompt = buildCliPrompt(await resolveCurrentNodePrompt())
        let sessionId: string | null = null
        if (prompt) {
          sessionId = await appendCliUserLog(prompt)
        }
        await runCliPrompt(prompt || undefined, sessionId)
      } catch {
        await appendCliSystemLog(serverNotRunningMessage)
      }
      return
    }

    setMessages((previous) => [
      ...previous,
      {
        type: 'error',
        message: serverNotRunningMessage
      }
    ])
  }, [
    appendCliSystemLog,
    appendCliUserLog,
    backendWorkflowRun,
    buildCliPrompt,
    cliSessionRef,
    currentNodeRuntime,
    ensureConversationRuntime,
    isRunning,
    loadCurrentNodeRuntime,
    loadWorkflowStatus,
    markStartedOnce,
    pipelineStatus,
    pipelineTemplate,
    refreshTaskRecord,
    resolveCurrentNodePrompt,
    runCliPrompt,
    selectedWorkflowNode,
    selectedWorkflowNodeIsFailed,
    serverNotRunningMessage,
    setBackendWorkflowRun,
    setMessages,
    setStartupError,
    setWorkflowRunNodes,
    startPipelineStage,
    task,
    taskId
  ])

  const handleApproveCliTask = useCallback(async () => {
    if (!taskId) {
      return
    }

    try {
      const reviewNode = (await db.getCurrentTaskNode(taskId)) as {
        id?: string
        status?: string
      } | null
      if (reviewNode?.id && reviewNode.status === 'in_review') {
        await db.approveTaskNode(reviewNode.id)
      }
      await refreshTaskRecord(taskId)
    } catch {
      /* ignore */
    }
  }, [refreshTaskRecord, taskId])

  const handleStopExecution = useCallback(async () => {
    if (useCliSession) {
      await stopCli()
      await stopAndRefreshTask()
      return
    }

    await stopAgent()
    await stopAndRefreshTask()
  }, [stopAgent, stopAndRefreshTask, stopCli, useCliSession])

  return {
    handleReply,
    handleStartTask,
    handleApproveCliTask,
    handleStopExecution
  }
}
