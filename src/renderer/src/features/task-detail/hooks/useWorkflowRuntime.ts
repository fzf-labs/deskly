import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

import { db, type Task, type WorkflowRun, type WorkflowRunNode } from '@/data'

import { sortWorkflowNodes } from '../model/workflow-selectors'
import type {
  CurrentNodeRuntime,
  ExecutionStatus,
  LanguageStrings,
  PipelineDisplayStatus,
  WorkflowCurrentNode,
  WorkflowNode,
  WorkflowReviewNode
} from '../types'

interface UseWorkflowRuntimeInput {
  taskId?: string
  useCliSession: boolean
  backendWorkflowRun: WorkflowRun | null
  workflowRunNodes: WorkflowRunNode[]
  t: LanguageStrings
  cliStatus: ExecutionStatus
  isRunning: boolean
  loadCurrentNodeRuntime: () => Promise<CurrentNodeRuntime>
  refreshTask: () => Promise<void>
  setTask: Dispatch<SetStateAction<Task | null>>
  setPipelineStageIndex: Dispatch<SetStateAction<number>>
}

export function useWorkflowRuntime({
  taskId,
  useCliSession,
  backendWorkflowRun,
  workflowRunNodes,
  t,
  cliStatus,
  isRunning,
  loadCurrentNodeRuntime,
  refreshTask,
  setTask,
  setPipelineStageIndex
}: UseWorkflowRuntimeInput) {
  const [currentTaskNode, setCurrentTaskNode] = useState<WorkflowReviewNode | null>(null)
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>([])
  const [workflowCurrentNode, setWorkflowCurrentNode] = useState<WorkflowCurrentNode | null>(null)
  const [selectedWorkflowNodeId, setSelectedWorkflowNodeId] = useState<string | null>(null)
  const [isWorkflowExpanded, setIsWorkflowExpanded] = useState(false)

  const isMountedRef = useRef(true)
  const workflowPrevTaskIdRef = useRef<string | undefined>(undefined)
  const lastAutoRunTaskNodeIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (workflowPrevTaskIdRef.current !== taskId) {
      if (workflowPrevTaskIdRef.current !== undefined) {
        setCurrentTaskNode(null)
        setWorkflowNodes([])
        setWorkflowCurrentNode(null)
        setSelectedWorkflowNodeId(null)
        setIsWorkflowExpanded(false)
        lastAutoRunTaskNodeIdRef.current = null
      }

      workflowPrevTaskIdRef.current = taskId
    }
  }, [taskId])

  const resolveTaskNodePrompt = useCallback(
    async (taskNodeId?: string | null, nodeIndex?: number | null) => {
      const sortedNodes = sortWorkflowNodes(workflowNodes)
      const fromState =
        (taskNodeId ? sortedNodes.find((node) => node.id === taskNodeId) : null) ||
        (typeof nodeIndex === 'number' ? sortedNodes[nodeIndex] : null) ||
        sortedNodes.find((node) => node.node_order === nodeIndex)

      if (fromState?.prompt?.trim()) {
        return fromState.prompt.trim()
      }

      if (!taskId) {
        return ''
      }

      try {
        const nodes = (await db.getTaskNodes(taskId)) as Array<{
          id: string
          node_order: number
          prompt?: string
        }>
        const byId = taskNodeId ? nodes.find((node) => node.id === taskNodeId) : null
        const byIndex =
          typeof nodeIndex === 'number' ? sortWorkflowNodes(nodes as WorkflowNode[])[nodeIndex] : null

        return (byId?.prompt || byIndex?.prompt || '').trim()
      } catch {
        return ''
      }
    },
    [taskId, workflowNodes]
  )

  const resolveCurrentNodePrompt = useCallback(async () => {
    if (!taskId) {
      return ''
    }

    try {
      const currentNode = (await db.getCurrentTaskNode(taskId)) as {
        id?: string
        node_order?: number
        prompt?: string
      } | null

      if (currentNode?.prompt?.trim()) {
        return currentNode.prompt.trim()
      }

      if (currentNode?.id) {
        const resolved = await resolveTaskNodePrompt(
          currentNode.id,
          typeof currentNode.node_order === 'number'
            ? Math.max(currentNode.node_order - 1, 0)
            : null
        )
        if (resolved.trim()) {
          return resolved.trim()
        }
      }
    } catch {
      // ignore
    }

    if (workflowCurrentNode?.id) {
      const fallback = await resolveTaskNodePrompt(
        workflowCurrentNode.id,
        workflowCurrentNode.index
      )
      return fallback.trim()
    }

    return ''
  }, [resolveTaskNodePrompt, taskId, workflowCurrentNode?.id, workflowCurrentNode?.index])

  const loadWorkflowStatus = useCallback(async () => {
    if (!taskId) {
      return
    }

    try {
      const nodes = (await db.getTaskNodes(taskId)) as Array<{
        id: string
        node_order: number
        status: PipelineDisplayStatus
        name?: string
        prompt?: string
        session_id?: string | null
        cli_tool_id?: string | null
        agent_tool_config_id?: string | null
      }>

      if (!nodes.length) {
        if (isMountedRef.current) {
          setCurrentTaskNode(null)
          setWorkflowNodes([])
          setWorkflowCurrentNode(null)
          setSelectedWorkflowNodeId(null)
        }
        return
      }

      const sortedNodes = sortWorkflowNodes(nodes as WorkflowNode[])
      const runtimeCurrentNode = (await db.getCurrentTaskNode(taskId)) as {
        id: string
        status: PipelineDisplayStatus
        name?: string
      } | null
      const currentNode = runtimeCurrentNode ?? sortedNodes[sortedNodes.length - 1]

      if (!currentNode) {
        if (isMountedRef.current) {
          setCurrentTaskNode(null)
          setWorkflowCurrentNode(null)
          setWorkflowNodes(sortedNodes)
        }
        return
      }

      const currentNodeIndex = Math.max(
        0,
        sortedNodes.findIndex((node) => node.id === currentNode.id)
      )

      if (isMountedRef.current) {
        setWorkflowNodes(sortedNodes)
        setWorkflowCurrentNode({
          id: currentNode.id,
          status: currentNode.status,
          index: currentNodeIndex
        })

        const hasSelectedNode =
          selectedWorkflowNodeId !== null &&
          sortedNodes.some((node) => node.id === selectedWorkflowNodeId)

        if (!hasSelectedNode) {
          setSelectedWorkflowNodeId(currentNode.id)
        }

        if (useCliSession) {
          setPipelineStageIndex(currentNodeIndex)
        }
      }

      const selectedReviewNode = selectedWorkflowNodeId
        ? sortedNodes.find(
            (node) => node.id === selectedWorkflowNodeId && node.status === 'in_review'
          )
        : null
      const runtimeReviewNode =
        currentNode.status === 'in_review'
          ? (sortedNodes.find((node) => node.id === currentNode.id) ?? null)
          : null
      const reviewNode = selectedReviewNode ?? runtimeReviewNode

      if (reviewNode) {
        const reviewNodeIndex = Math.max(
          0,
          sortedNodes.findIndex((node) => node.id === reviewNode.id)
        )
        const runtimeNode = workflowRunNodes.find((node) => node.id === reviewNode.id) ?? null
        const definitionNode =
          runtimeNode && backendWorkflowRun
            ? (backendWorkflowRun.definition_snapshot.nodes.find(
                (node) => node.id === runtimeNode.definition_node_id
              ) ?? null)
            : null
        const fallbackName = `${t.task.stageLabel} ${reviewNodeIndex + 1}`

        if (isMountedRef.current) {
          setCurrentTaskNode({
            id: reviewNode.id,
            name: reviewNode.name || runtimeNode?.name || definitionNode?.name || fallbackName,
            status: 'in_review'
          })
        }

        return
      }

      if (isMountedRef.current) {
        setCurrentTaskNode(null)
      }
    } catch {
      // ignore
    }
  }, [
    backendWorkflowRun,
    selectedWorkflowNodeId,
    setPipelineStageIndex,
    t.task.stageLabel,
    taskId,
    useCliSession,
    workflowRunNodes
  ])

  useEffect(() => {
    if (!taskId) {
      return
    }

    const refreshByTaskNodeEvent = async (eventTaskId?: string) => {
      if (!eventTaskId || eventTaskId !== taskId) {
        return
      }

      await loadCurrentNodeRuntime()
      await loadWorkflowStatus()
      await refreshTask()
    }

    const offCompleted = window.api?.taskNode?.onCompleted?.((data) => {
      void refreshByTaskNodeEvent(data?.taskId)
    })
    const offReview = window.api?.taskNode?.onReview?.((data) => {
      void refreshByTaskNodeEvent(data?.taskId)
    })

    return () => {
      offCompleted?.()
      offReview?.()
    }
  }, [loadCurrentNodeRuntime, loadWorkflowStatus, refreshTask, taskId])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [taskId])

  useEffect(() => {
    if (!taskId) {
      return
    }

    let active = true

    void (async () => {
      if (!active) {
        return
      }

      await loadCurrentNodeRuntime()
      if (!active) {
        return
      }

      await loadWorkflowStatus()
    })()

    const shouldPoll = isRunning || cliStatus === 'running'
    const interval = shouldPoll
      ? setInterval(() => {
          if (!active) {
            return
          }

          void loadCurrentNodeRuntime()
          void loadWorkflowStatus()
          void refreshTask()
        }, 2000)
      : null

    return () => {
      active = false
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [cliStatus, isRunning, loadCurrentNodeRuntime, loadWorkflowStatus, refreshTask, taskId])

  const handleApproveTaskNode = useCallback(async () => {
    if (!currentTaskNode) {
      return
    }

    await db.approveTaskNode(currentTaskNode.id)
    await loadCurrentNodeRuntime()
    setCurrentTaskNode(null)
    setSelectedWorkflowNodeId(null)
    lastAutoRunTaskNodeIdRef.current = null
    await loadWorkflowStatus()

    if (!taskId) {
      return
    }

    try {
      const updatedTask = await db.getTask(taskId)
      if (updatedTask) {
        setTask(updatedTask as Task)
      }
    } catch {
      // ignore
    }
  }, [currentTaskNode, loadCurrentNodeRuntime, loadWorkflowStatus, setTask, taskId])

  const handleSelectWorkflowNode = useCallback((nodeId: string) => {
    setSelectedWorkflowNodeId(nodeId)
  }, [])

  const toggleWorkflowExpanded = useCallback(() => {
    setIsWorkflowExpanded((previous) => !previous)
  }, [])

  return {
    currentTaskNode,
    workflowNodes,
    workflowCurrentNode,
    selectedWorkflowNodeId,
    isWorkflowExpanded,
    lastAutoRunTaskNodeIdRef,
    resolveTaskNodePrompt,
    resolveCurrentNodePrompt,
    loadWorkflowStatus,
    handleApproveTaskNode,
    handleSelectWorkflowNode,
    toggleWorkflowExpanded
  }
}
