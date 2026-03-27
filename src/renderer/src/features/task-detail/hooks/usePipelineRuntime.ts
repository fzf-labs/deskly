import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'

import { db, type Task, type WorkflowRun } from '@/data'
import type { AgentMessage } from '@features/cli-session'

import type {
  ExecutionStatus,
  LanguageStrings,
  PipelineDisplayStatus,
  PipelineStatus,
  PipelineTemplate,
  WorkflowCurrentNode
} from '../types'

interface UsePipelineRuntimeInput {
  taskId?: string
  task: Task | null
  messages: AgentMessage[]
  setMessages: Dispatch<SetStateAction<AgentMessage[]>>
  t: LanguageStrings
  isRunning: boolean
  cliStatus: ExecutionStatus
  useCliSession: boolean
  backendWorkflowRun: WorkflowRun | null
  workflowCurrentNode: WorkflowCurrentNode | null
  startupError: string | null
  normalizedTaskStatus: PipelineDisplayStatus
  pipelineStageIndex: number
  setPipelineStageIndex: Dispatch<SetStateAction<number>>
  pipelineStageMessageStart: number
  setPipelineStageMessageStart: Dispatch<SetStateAction<number>>
  resolveTaskNodePrompt: (taskNodeId?: string | null, nodeIndex?: number | null) => Promise<string>
  buildCliPrompt: (nodePrompt?: string) => string
  appendCliUserLog: (content: string, sessionIdOverride?: string | null) => Promise<string | null>
  runCliPrompt: (prompt?: string, sessionIdOverride?: string | null) => Promise<void>
}

export function usePipelineRuntime({
  taskId,
  task,
  messages,
  setMessages,
  t,
  isRunning,
  cliStatus,
  useCliSession,
  backendWorkflowRun,
  workflowCurrentNode,
  startupError,
  normalizedTaskStatus,
  pipelineStageIndex,
  setPipelineStageIndex,
  pipelineStageMessageStart,
  setPipelineStageMessageStart,
  resolveTaskNodePrompt,
  buildCliPrompt,
  appendCliUserLog,
  runCliPrompt
}: UsePipelineRuntimeInput) {
  const [pipelineTemplate, setPipelineTemplate] = useState<PipelineTemplate | null>(null)
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>('idle')

  useEffect(() => {
    if (!taskId || task?.task_mode !== 'workflow') {
      setPipelineTemplate(null)
      setPipelineStatus('idle')
      return
    }

    let active = true
    const loadTemplate = async () => {
      try {
        const nodes = (await db.getTaskNodes(taskId)) as Array<{
          id: string
          node_order: number
          name?: string
          prompt?: string
          requires_approval?: boolean | number
        }>

        if (!nodes.length) {
          if (active) {
            setPipelineTemplate(null)
            setPipelineStatus('idle')
          }
          return
        }

        const sortedNodes = [...nodes].sort((left, right) => left.node_order - right.node_order)

        if (active) {
          setPipelineTemplate({
            id: taskId,
            name: t.task.workflowCardTitle || 'Workflow',
            description: null,
            scope: 'project',
            project_id: task?.project_id ?? null,
            created_at: '',
            updated_at: '',
            nodes: sortedNodes.map((node, index) => ({
              id: node.id,
              template_id: taskId,
              node_order: Number.isFinite(node.node_order) ? node.node_order : index + 1,
              name: node.name || `${t.task.stageLabel} ${index + 1}`,
              prompt: node.prompt || '',
              requires_approval: Boolean(node.requires_approval),
              created_at: '',
              updated_at: ''
            }))
          })
          setPipelineStageIndex(0)
          setPipelineStatus('idle')
        }
      } catch {
        if (active) {
          setPipelineTemplate(null)
          setPipelineStatus('idle')
        }
      }
    }

    void loadTemplate()

    return () => {
      active = false
    }
  }, [setPipelineStageIndex, t.task.stageLabel, t.task.workflowCardTitle, task?.project_id, task?.task_mode, taskId])

  const appendPipelineNotice = useCallback(
    async (content: string) => {
      if (taskId) {
        setMessages((previous) => [...previous, { type: 'text', content }])
      }
    },
    [setMessages, taskId]
  )

  const startPipelineStage = useCallback(
    async (index: number, approvalNote?: string) => {
      if (!pipelineTemplate || !taskId) {
        return
      }

      const stage = pipelineTemplate.nodes?.[index]
      if (!stage) {
        setPipelineStatus('completed')
        await appendPipelineNotice(t.task.pipelineCompleted)
        return
      }

      const resolvedPrompt = await resolveTaskNodePrompt(stage.id, index)
      const stagePrompt = buildCliPrompt(resolvedPrompt)
      if (!stagePrompt) {
        return
      }

      const prompt = approvalNote
        ? `${stagePrompt}\n\n${t.task.pipelineApprovalNotePrefix}: ${approvalNote}`
        : stagePrompt

      setPipelineStageIndex(index)
      setPipelineStatus('running')
      setPipelineStageMessageStart(messages.length)

      if (useCliSession) {
        try {
          const sessionId = await appendCliUserLog(prompt)
          await runCliPrompt(prompt, sessionId)
        } catch {
          setPipelineStatus('failed')
        }
        return
      }

      setPipelineStatus('failed')
      await appendPipelineNotice(t.common.errors.serverNotRunning || 'CLI session is not running.')
    },
    [
      appendCliUserLog,
      appendPipelineNotice,
      buildCliPrompt,
      messages.length,
      pipelineTemplate,
      resolveTaskNodePrompt,
      runCliPrompt,
      setPipelineStageIndex,
      setPipelineStageMessageStart,
      t.common.errors.serverNotRunning,
      t.task.pipelineApprovalNotePrefix,
      t.task.pipelineCompleted,
      taskId,
      useCliSession
    ]
  )

  const startNextPipelineStage = useCallback(
    async (approvalNote?: string) => {
      await startPipelineStage(pipelineStageIndex + 1, approvalNote)
    },
    [pipelineStageIndex, startPipelineStage]
  )

  useEffect(() => {
    if (backendWorkflowRun) {
      return
    }

    if (!pipelineTemplate || pipelineStatus !== 'idle' || isRunning) {
      return
    }

    if (useCliSession && cliStatus === 'running') {
      return
    }

    if (!taskId || messages.length > 0) {
      return
    }

    if (normalizedTaskStatus !== 'in_progress') {
      return
    }

    let active = true
    const maybeStart = async () => {
      try {
        const currentNode = (await db.getCurrentTaskNode(taskId)) as {
          status?: PipelineDisplayStatus
          session_id?: string | null
        } | null
        if (!currentNode || currentNode.status !== 'in_progress' || currentNode.session_id) {
          return
        }
      } catch {
        return
      }

      if (!active) {
        return
      }

      startPipelineStage(workflowCurrentNode?.index ?? 0).catch(() => {})
    }

    void maybeStart()

    return () => {
      active = false
    }
  }, [
    backendWorkflowRun,
    cliStatus,
    isRunning,
    messages.length,
    normalizedTaskStatus,
    pipelineStatus,
    pipelineTemplate,
    startPipelineStage,
    taskId,
    useCliSession,
    workflowCurrentNode?.index
  ])

  useEffect(() => {
    if (backendWorkflowRun) {
      return
    }

    if (!pipelineTemplate || pipelineStatus !== 'running' || isRunning) {
      return
    }

    const stageMessages = messages.slice(pipelineStageMessageStart)
    let outcome: (typeof stageMessages)[number] | undefined

    for (let index = stageMessages.length - 1; index >= 0; index -= 1) {
      if (stageMessages[index].type === 'result' || stageMessages[index].type === 'error') {
        outcome = stageMessages[index]
        break
      }
    }

    if (!outcome || !taskId) {
      return
    }

    const stage = pipelineTemplate.nodes?.[pipelineStageIndex]
    const stageName = stage?.name || `${t.task.stageLabel} ${pipelineStageIndex + 1}`

    if (outcome.type === 'result' && outcome.subtype === 'success') {
      setPipelineStatus('waiting_approval')
      void appendPipelineNotice(t.task.pipelineStageCompleted.replace('{name}', stageName))
    } else {
      setPipelineStatus('failed')
      void appendPipelineNotice(t.task.pipelineStageFailed.replace('{name}', stageName))
    }
  }, [
    appendPipelineNotice,
    backendWorkflowRun,
    isRunning,
    messages,
    pipelineStageIndex,
    pipelineStageMessageStart,
    pipelineStatus,
    pipelineTemplate,
    t.task.pipelineStageCompleted,
    t.task.pipelineStageFailed,
    t.task.stageLabel,
    taskId
  ])

  const pipelineBanner = useMemo(() => {
    if (startupError) {
      return startupError
    }

    if (!pipelineTemplate) {
      return null
    }

    const stage = pipelineTemplate.nodes?.[pipelineStageIndex]
    const stageName = stage?.name || `${t.task.stageLabel} ${pipelineStageIndex + 1}`

    if (pipelineStatus === 'waiting_approval') {
      return t.task.pipelineStageCompleted.replace('{name}', stageName)
    }

    if (pipelineStatus === 'failed') {
      return t.task.pipelineStageFailed.replace('{name}', stageName)
    }

    if (pipelineStatus === 'completed') {
      return t.task.pipelineCompleted
    }

    return null
  }, [
    pipelineStageIndex,
    pipelineStatus,
    pipelineTemplate,
    startupError,
    t.task.pipelineCompleted,
    t.task.pipelineStageCompleted,
    t.task.pipelineStageFailed,
    t.task.stageLabel
  ])

  return {
    pipelineTemplate,
    pipelineStatus,
    pipelineBanner,
    setPipelineStatus,
    startPipelineStage,
    startNextPipelineStage
  }
}
