/**
 * useTaskDetail - Consolidated hook for task detail page
 *
 * This hook merges the functionality of 13 separate hooks into a single,
 * cohesive hook with clear sections:
 *
 * 1. Init - Task initialization and loading
 * 2. Dialogs - Edit/Delete dialog state
 * 3. CLI - CLI session management
 * 4. Pipeline - Pipeline execution
 * 5. Workflow - Workflow node management
 * 6. Artifacts - File artifacts extraction
 * 7. View State - UI state derivation
 * 8. Actions - User action handlers
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NavigateFunction } from 'react-router-dom'

import { db, type Task, type WorkflowRun, type WorkflowRunNode } from '@/data'
import { getEnabledDefaultCliToolId, getSettings } from '@/data/settings'
import { newUuid } from '@/lib/ids'
import type { AgentMessage, CLISessionHandle } from '@features/cli-session'
import { filterEnabledCliTools, normalizeCliTools } from '@features/cli-tools'

import { useArtifactPanel } from './hooks/useArtifactPanel'
import { useMessageScroll } from './hooks/useMessageScroll'
import { usePipelineRuntime } from './hooks/usePipelineRuntime'
import { useTaskDetailActions } from './hooks/useTaskDetailActions'
import { useTaskDetailViewModel } from './hooks/useTaskDetailViewModel'
import { useTaskDialogs } from './hooks/useTaskDialogs'
import { useToolSelectionState } from './hooks/useToolSelectionState'
import { useWorkflowRuntime } from './hooks/useWorkflowRuntime'
import { resolveTaskExecutionContext } from './model/execution-context'
import {
  buildWorkflowLinearNodes,
  selectRuntimeWorkflowNode,
  selectWorkflowNode
} from './model/workflow-selectors'
import { buildWorkflowGraph } from './workflow-graph'
import {
  type CLIToolInfo,
  type CurrentNodeRuntime,
  type ExecutionStatus,
  type PipelineDisplayStatus,
  type WorkflowGraph,
  type LanguageStrings
} from './types'

// ============================================================================
// Types
// ============================================================================

interface UseTaskDetailInput {
  taskId?: string
  initialPrompt: string
  initialSessionId?: string
  initialStartError?: string
  navigate: NavigateFunction
  activeTaskId: string | null
  messages: AgentMessage[]
  setMessages: React.Dispatch<React.SetStateAction<AgentMessage[]>>
  isRunning: boolean
  stopAgent: () => Promise<void>
  loadTask: (taskId: string) => Promise<Task | null>
  loadMessages: (taskId: string) => Promise<void>
  sessionFolder: string | null
  t: LanguageStrings
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useTaskDetail({
  taskId,
  initialPrompt,
  initialStartError,
  navigate,
  activeTaskId,
  messages,
  setMessages,
  isRunning,
  stopAgent,
  loadTask,
  loadMessages,
  sessionFolder,
  t
}: UseTaskDetailInput) {
  const TASK_LOAD_RETRY_ATTEMPTS = 8
  const WORKFLOW_RUNTIME_RETRY_ATTEMPTS = 10
  const LOAD_RETRY_DELAY_MS = 120

  const waitForTaskRecord = useCallback(
    async (currentTaskId: string): Promise<Task | null> => {
      for (let attempt = 0; attempt < TASK_LOAD_RETRY_ATTEMPTS; attempt += 1) {
        const existingTask = await loadTask(currentTaskId)
        if (existingTask) {
          return existingTask
        }

        if (attempt < TASK_LOAD_RETRY_ATTEMPTS - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, LOAD_RETRY_DELAY_MS))
        }
      }

      return null
    },
    [loadTask]
  )

  const waitForWorkflowRuntime = useCallback(
    async (
      currentTaskId: string,
      taskMode?: Task['task_mode'] | null
    ): Promise<{
      workflowRun: WorkflowRun | null
      runNodes: WorkflowRunNode[]
    }> => {
      if (taskMode !== 'workflow') {
        return {
          workflowRun: null,
          runNodes: []
        }
      }

      for (let attempt = 0; attempt < WORKFLOW_RUNTIME_RETRY_ATTEMPTS; attempt += 1) {
        const workflowRun = await db.getWorkflowRunByTask(currentTaskId)
        const runNodes = workflowRun ? await db.listWorkflowRunNodes(workflowRun.id) : []

        if (workflowRun && Array.isArray(runNodes) && runNodes.length > 0) {
          return {
            workflowRun,
            runNodes
          }
        }

        if (attempt < WORKFLOW_RUNTIME_RETRY_ATTEMPTS - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, LOAD_RETRY_DELAY_MS))
        }
      }

      const workflowRun = await db.getWorkflowRunByTask(currentTaskId)
      const runNodes = workflowRun ? await db.listWorkflowRunNodes(workflowRun.id) : []
      return {
        workflowRun,
        runNodes: Array.isArray(runNodes) ? runNodes : []
      }
    },
    []
  )

  // ===========================================================================
  // Section 1: Init State
  // ===========================================================================
  const [task, setTask] = useState<Task | null>(null)
  const [backendWorkflowRun, setBackendWorkflowRun] = useState<WorkflowRun | null>(null)
  const [workflowRunNodes, setWorkflowRunNodes] = useState<WorkflowRunNode[]>([])
  const [workflowGraph, setWorkflowGraph] = useState<WorkflowGraph>({ nodes: [], edges: [] })
  const [startupError, setStartupError] = useState<string | null>(initialStartError ?? null)
  const [currentNodeRuntime, setCurrentNodeRuntime] = useState<CurrentNodeRuntime>({
    taskNodeId: null,
    sessionId: null,
    cliToolId: null,
    agentToolConfigId: null
  })
  const [isLoading, setIsLoading] = useState(true)

  const isInitializingRef = useRef(false)
  const initializedTaskIdRef = useRef<string | null>(null)
  const prevTaskIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (prevTaskIdRef.current !== taskId) {
      if (prevTaskIdRef.current !== undefined) {
        setTask(null)
        setBackendWorkflowRun(null)
        setWorkflowRunNodes([])
        setWorkflowGraph({ nodes: [], edges: [] })
        setStartupError(initialStartError ?? null)
        setCurrentNodeRuntime({
          taskNodeId: null,
          sessionId: null,
          cliToolId: null,
          agentToolConfigId: null
        })
        isInitializingRef.current = false
        initializedTaskIdRef.current = null
      }
      prevTaskIdRef.current = taskId
    }
  }, [initialStartError, taskId])

  const loadCurrentNodeRuntime = useCallback(async () => {
    const emptyRuntime: CurrentNodeRuntime = {
      taskNodeId: null,
      sessionId: null,
      cliToolId: null,
      agentToolConfigId: null
    }

    if (!taskId) {
      setCurrentNodeRuntime(emptyRuntime)
      return emptyRuntime
    }

    try {
      let node = (await db.getCurrentTaskNode(taskId)) as {
        id?: string | null
        node_order?: number | null
        session_id?: string | null
        cli_tool_id?: string | null
        agent_tool_config_id?: string | null
      } | null

      if (!node?.id) {
        const nodes = (await db.getTaskNodes(taskId)) as Array<{
          id: string
          node_order?: number | null
          session_id?: string | null
          cli_tool_id?: string | null
          agent_tool_config_id?: string | null
        }>
        const sortedNodes = [...nodes].sort(
          (a, b) =>
            (a.node_order ?? Number.MAX_SAFE_INTEGER) - (b.node_order ?? Number.MAX_SAFE_INTEGER)
        )
        node = sortedNodes[sortedNodes.length - 1] ?? null
      }

      const nextRuntime: CurrentNodeRuntime = {
        taskNodeId: node?.id ?? null,
        sessionId: node?.session_id ?? null,
        cliToolId: node?.cli_tool_id ?? null,
        agentToolConfigId: node?.agent_tool_config_id ?? null
      }
      setCurrentNodeRuntime(nextRuntime)
      return nextRuntime
    } catch {
      setCurrentNodeRuntime(emptyRuntime)
      return emptyRuntime
    }
  }, [taskId])

  const ensureConversationRuntime = useCallback(
    async (
      taskRecord?: Task | null,
      preferredSessionId?: string | null
    ): Promise<CurrentNodeRuntime> => {
      const latestRuntime = await loadCurrentNodeRuntime()
      const currentTask = taskRecord ?? task

      if (!taskId || currentTask?.task_mode !== 'conversation') {
        return latestRuntime
      }

      if (latestRuntime.cliToolId) {
        return latestRuntime
      }

      const settings = getSettings()
      const defaultCliToolId = getEnabledDefaultCliToolId(settings)
      if (!defaultCliToolId) {
        return latestRuntime
      }

      let defaultConfigId: string | null = latestRuntime.agentToolConfigId
      try {
        const configs = (await db.listAgentToolConfigs(defaultCliToolId)) as Array<{
          id: string
          is_default?: number | boolean
        }>
        const defaultConfig = configs.find((config) => Boolean(config.is_default))
        defaultConfigId = defaultConfig?.id ?? defaultConfigId
      } catch {
        defaultConfigId = latestRuntime.agentToolConfigId
      }

      await db.updateCurrentTaskNodeRuntime(taskId, {
        session_id: preferredSessionId !== undefined ? preferredSessionId : latestRuntime.sessionId,
        cli_tool_id: defaultCliToolId,
        agent_tool_config_id: defaultConfigId
      })

      return await loadCurrentNodeRuntime()
    },
    [loadCurrentNodeRuntime, task, taskId]
  )

  const refreshTask = useCallback(async () => {
    if (!taskId) return
    try {
      const refreshedTask = await db.getTask(taskId)
      if (refreshedTask) setTask(refreshedTask as Task)
      const { workflowRun, runNodes } = await waitForWorkflowRuntime(
        taskId,
        refreshedTask?.task_mode ?? null
      )
      setBackendWorkflowRun(workflowRun)
      setWorkflowRunNodes(runNodes)
    } catch {
      /* ignore */
    }
  }, [taskId, waitForWorkflowRuntime])

  useEffect(() => {
    async function initialize() {
      if (!taskId) {
        setIsLoading(false)
        return
      }
      if (initializedTaskIdRef.current === taskId) return
      if (isInitializingRef.current) return
      isInitializingRef.current = true

      try {
        setIsLoading(true)
        const existingTask = await waitForTaskRecord(taskId)

        if (existingTask) {
          setTask(existingTask)
          const { workflowRun, runNodes } = await waitForWorkflowRuntime(
            taskId,
            existingTask.task_mode
          )
          setBackendWorkflowRun(workflowRun)
          setWorkflowRunNodes(runNodes)
          await ensureConversationRuntime(existingTask)
          await loadMessages(taskId)
          setIsLoading(false)
        } else {
          setIsLoading(false)
        }
      } finally {
        initializedTaskIdRef.current = taskId
        isInitializingRef.current = false
      }
    }
    void initialize()
  }, [
    taskId,
    ensureConversationRuntime,
    loadCurrentNodeRuntime,
    loadMessages,
    waitForTaskRecord,
    waitForWorkflowRuntime
  ])

  const useCliSession = Boolean(currentNodeRuntime.cliToolId)

  // ===========================================================================
  // Section 2: CLI Tools
  // ===========================================================================
  const [cliTools, setCliTools] = useState<CLIToolInfo[]>([])

  useEffect(() => {
    let active = true
    const loadCliTools = async () => {
      try {
        const result = await window.api?.cliTools?.getSnapshot?.()
        if (active) {
          setCliTools(filterEnabledCliTools(normalizeCliTools(result) as CLIToolInfo[]))
        }
        void window.api?.cliTools?.refresh?.({ level: 'fast' })
      } catch {
        if (active) setCliTools([])
      }
    }
    const unsubscribe = window.api?.cliTools?.onUpdated?.((tools) => {
      if (!active) return
      setCliTools(filterEnabledCliTools(normalizeCliTools(tools) as CLIToolInfo[]))
    })
    void loadCliTools()
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  // ===========================================================================
  // Section 3: Dialog State
  // ===========================================================================
  const dialogs = useTaskDialogs({
    taskId,
    task,
    currentNodeRuntime,
    navigate,
    setTask,
    loadCurrentNodeRuntime
  })

  // ===========================================================================
  // Section 4: CLI Session
  // ===========================================================================
  const [cliStatus, setCliStatus] = useState<ExecutionStatus>('idle')
  const cliSessionRef = useRef<CLISessionHandle>(null)
  const pendingCliStartRef = useRef(false)
  const pendingCliPromptRef = useRef<string | undefined>(undefined)

  const ensureCliSessionId = useCallback(async (): Promise<string | null> => {
    if (!taskId) return null

    try {
      const currentNode = (await db.getCurrentTaskNode(taskId)) as {
        id?: string | null
        session_id?: string | null
      } | null

      const runtimeMatchesCurrentNode =
        !currentNode?.id || currentNode.id === currentNodeRuntime.taskNodeId

      if (runtimeMatchesCurrentNode && currentNodeRuntime.sessionId) {
        return currentNodeRuntime.sessionId
      }

      if (currentNode?.session_id) {
        return currentNode.session_id
      }
    } catch {
      // ignore and fallback to creating a new session id
    }

    const newSessionId = newUuid()
    try {
      await db.updateCurrentTaskNodeRuntime(taskId, { session_id: newSessionId })
      await loadCurrentNodeRuntime()
    } catch (error) {
      console.error('[TaskDetail] Failed to persist session_id:', error)
    }
    return newSessionId
  }, [currentNodeRuntime.sessionId, currentNodeRuntime.taskNodeId, loadCurrentNodeRuntime, taskId])

  useEffect(() => {
    if (!currentNodeRuntime.sessionId || !pendingCliStartRef.current) return
    const promptOverride = pendingCliPromptRef.current
    pendingCliStartRef.current = false
    pendingCliPromptRef.current = undefined
    cliSessionRef.current?.start(promptOverride).catch(() => {})
  }, [currentNodeRuntime.sessionId])

  useEffect(() => {
    setCliStatus('idle')
  }, [taskId])

  const markExecutionRunning = useCallback(async () => {
    if (!taskId) return
    try {
      await db.startTaskExecution(taskId)
    } catch {
      /* ignore */
    }
  }, [taskId])

  // Forward declare loadWorkflowStatus for use in handleCliStatusChange
  const loadWorkflowStatusRef = useRef<() => Promise<void>>(async () => {})

  const handleCliStatusChange = useCallback(
    (status: ExecutionStatus) => {
      setCliStatus(status)
      if (!taskId) return
      if (status === 'running') {
        void markExecutionRunning()
      } else if (status === 'stopped' || status === 'error') {
        void (async () => {
          await loadWorkflowStatusRef.current()
          await loadCurrentNodeRuntime()
          await refreshTask()
        })()
      }
    },
    [markExecutionRunning, loadCurrentNodeRuntime, refreshTask, taskId]
  )

  const runCliPrompt = useCallback(
    async (prompt?: string, sessionIdOverride?: string | null) => {
      const session = cliSessionRef.current
      if (!session) return
      const content = prompt?.trim() || ''

      let sessionId = sessionIdOverride ?? currentNodeRuntime.sessionId
      if (!sessionId) {
        sessionId = await ensureCliSessionId()
        if (!sessionId) return
        pendingCliStartRef.current = true
        pendingCliPromptRef.current = content || undefined
        return
      }
      if (!currentNodeRuntime.sessionId || currentNodeRuntime.sessionId !== sessionId) {
        pendingCliStartRef.current = true
        pendingCliPromptRef.current = content || undefined
        return
      }
      if (sessionId && window.api?.cliSession?.getSession) {
        try {
          const existingSession = await window.api.cliSession.getSession(sessionId)
          if (existingSession) {
            if (content) await session.sendInput(content)
            return
          }
        } catch {
          /* ignore */
        }
      }

      if (cliStatus === 'running') {
        if (content) await session.sendInput(content)
        return
      }

      await session.start(content || undefined)
    },
    [cliStatus, currentNodeRuntime.sessionId, ensureCliSessionId]
  )

  const appendCliLog = useCallback(
    async (
      _content: string,
      _type: 'user_message' | 'system_message',
      sessionIdOverride?: string | null
    ): Promise<string | null> => {
      if (!taskId) return null
      const sessionId = sessionIdOverride ?? (await ensureCliSessionId())
      if (!sessionId) return null
      return sessionId
    },
    [ensureCliSessionId, taskId]
  )

  const appendCliUserLog = useCallback(
    async (content: string, sessionIdOverride?: string | null) =>
      appendCliLog(content, 'user_message', sessionIdOverride),
    [appendCliLog]
  )
  const appendCliSystemLog = useCallback(
    async (content: string, sessionIdOverride?: string | null) =>
      appendCliLog(content, 'system_message', sessionIdOverride),
    [appendCliLog]
  )

  const stopCli = useCallback(async () => {
    try {
      const session = cliSessionRef.current
      if (session) await session.stop()
      else if (currentNodeRuntime.sessionId && window.api?.cliSession?.stopSession) {
        await window.api.cliSession.stopSession(currentNodeRuntime.sessionId)
      }
    } catch {
      /* ignore */
    }
  }, [currentNodeRuntime.sessionId])

  // ===========================================================================
  // Section 5: Prompt
  // ===========================================================================
  const taskPrompt = useMemo(() => task?.prompt || initialPrompt, [initialPrompt, task?.prompt])

  const buildCliPrompt = useCallback((nodePrompt?: string) => nodePrompt?.trim() || '', [])

  // ===========================================================================
  // Section 6: Tool Selection
  // ===========================================================================
  const toolSelection = useToolSelectionState({
    messages,
    isRunning,
    taskId
  })

  // ===========================================================================
  // Section 7: Scroll
  // ===========================================================================
  const scroll = useMessageScroll({
    messages,
    isLoading,
    taskId
  })

  // ===========================================================================
  // Section 8: Working Dir
  // ===========================================================================
  const preview = useArtifactPanel({
    taskId,
    task,
    messages,
    sessionFolder,
    isRunning,
    cliStatus
  })
  const workingDir = preview.workingDir

  // ===========================================================================
  // Section 9: Pipeline
  // ===========================================================================
  const [pipelineStageIndex, setPipelineStageIndex] = useState(0)
  const [pipelineStageMessageStart, setPipelineStageMessageStart] = useState(0)

  // ===========================================================================
  // Section 10: Workflow
  // ===========================================================================
  const workflow = useWorkflowRuntime({
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
  })
  const {
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
  } = workflow

  // Assign to ref for use in handleCliStatusChange
  loadWorkflowStatusRef.current = loadWorkflowStatus

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

  const pipeline = usePipelineRuntime({
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
  })
  const {
    pipelineTemplate,
    pipelineStatus,
    pipelineBanner,
    startPipelineStage,
    startNextPipelineStage
  } = pipeline

  const selectedWorkflowNode = useMemo(
    () =>
      selectWorkflowNode({
        taskMode: task?.task_mode,
        workflowNodes,
        selectedWorkflowNodeId,
        workflowCurrentNode,
        currentTaskNode
      }),
    [currentTaskNode, selectedWorkflowNodeId, task?.task_mode, workflowCurrentNode, workflowNodes]
  )

  const runtimeWorkflowNode = useMemo(
    () =>
      selectRuntimeWorkflowNode({
        taskMode: task?.task_mode,
        workflowNodes,
        workflowCurrentNode,
        currentTaskNode
      }),
    [currentTaskNode, task?.task_mode, workflowCurrentNode, workflowNodes]
  )

  const workflowLinearNodes = useMemo(
    () =>
      buildWorkflowLinearNodes({
        workflowNodes,
        pipelineTemplate
      }),
    [pipelineTemplate, workflowNodes]
  )

  const executionContext = useMemo(
    () =>
      resolveTaskExecutionContext({
        taskMode: task?.task_mode,
        currentNodeRuntime,
        currentTaskNodeId: currentTaskNode?.id ?? null,
        workflowCurrentNodeId: workflowCurrentNode?.id ?? null,
        selectedWorkflowNode,
        runtimeWorkflowNode,
        useCliSession
      }),
    [
      currentNodeRuntime,
      currentTaskNode?.id,
      runtimeWorkflowNode,
      selectedWorkflowNode,
      task?.task_mode,
      useCliSession,
      workflowCurrentNode?.id
    ]
  )

  const viewState = useTaskDetailViewModel({
    taskId,
    task,
    initialPrompt,
    messages,
    isRunning,
    cliStatus,
    useCliSession,
    cliTools,
    executionLogToolId: executionContext.executionLogToolId,
    pipelineTemplate,
    pipelineStatus,
    workflowGraph,
    workflowCurrentNode,
    currentTaskNode,
    selectedWorkflowNode,
    t
  })
  const markStartedOnce = viewState.markStartedOnce
  const selectedWorkflowNodeIsFailed = viewState.selectedWorkflowNodeIsFailed

  // Auto-run workflow node for CLI session
  useEffect(() => {
    if (backendWorkflowRun) return
    if (
      !useCliSession ||
      !workflowCurrentNode ||
      workflowCurrentNode.status !== 'in_progress' ||
      cliStatus === 'running'
    )
      return
    if (lastAutoRunTaskNodeIdRef.current === workflowCurrentNode.id) return
    let active = true
    const run = async () => {
      const sessionId = currentNodeRuntime.sessionId
      if (sessionId && window.api?.cliSession?.getSession) {
        try {
          const existingSession = await window.api.cliSession.getSession(sessionId)
          if (!active) return
          if (existingSession?.status === 'running') return
        } catch {
          /* ignore */
        }
      }

      try {
        const currentNode = (await db.getTaskNode(workflowCurrentNode.id)) as {
          status?: PipelineDisplayStatus
          session_id?: string | null
        } | null
        if (!active) return
        if (!currentNode || currentNode.status !== 'in_progress') return
        if (currentNode.session_id) return
      } catch {
        if (!active) return
      }

      const resolvedPrompt = await resolveTaskNodePrompt(
        workflowCurrentNode.id,
        workflowCurrentNode.index
      )
      const prompt = buildCliPrompt(resolvedPrompt)
      if (!prompt || !active) return

      lastAutoRunTaskNodeIdRef.current = workflowCurrentNode.id
      const newSessionId = await appendCliUserLog(prompt)
      await runCliPrompt(prompt, newSessionId)
    }
    void run()
    return () => {
      active = false
    }
  }, [
    appendCliUserLog,
    backendWorkflowRun,
    buildCliPrompt,
    cliStatus,
    currentNodeRuntime.sessionId,
    lastAutoRunTaskNodeIdRef,
    resolveTaskNodePrompt,
    runCliPrompt,
    useCliSession,
    workflowCurrentNode
  ])

  // ===========================================================================
  // Section 12: Workflow Graph
  // ===========================================================================
  const nextWorkflowGraph = useMemo<WorkflowGraph>(
    () =>
      buildWorkflowGraph({
        definition: backendWorkflowRun?.definition_snapshot ?? null,
        runNodes: workflowRunNodes,
        taskNodes: workflowLinearNodes,
        currentNodeId: workflowCurrentNode?.id ?? null,
        stageLabel: t.task.stageLabel
      }),
    [
      backendWorkflowRun?.definition_snapshot,
      t.task.stageLabel,
      workflowCurrentNode?.id,
      workflowLinearNodes,
      workflowRunNodes
    ]
  )

  useEffect(() => {
    if (task?.task_mode !== 'workflow') {
      setWorkflowGraph({ nodes: [], edges: [] })
      return
    }

    if (nextWorkflowGraph.nodes.length > 0) {
      setWorkflowGraph(nextWorkflowGraph)
      return
    }

    if (!backendWorkflowRun && workflowLinearNodes.length === 0 && !currentTaskNode) {
      setWorkflowGraph({ nodes: [], edges: [] })
    }
  }, [
    backendWorkflowRun,
    currentTaskNode,
    nextWorkflowGraph,
    task?.task_mode,
    workflowLinearNodes.length
  ])

  // ===========================================================================
  // Section 14: Actions
  // ===========================================================================
  const actions = useTaskDetailActions({
    taskId,
    task,
    activeTaskId,
    isRunning,
    useCliSession,
    currentNodeRuntime,
    selectedWorkflowNode,
    selectedWorkflowNodeIsFailed,
    backendWorkflowRun,
    pipelineTemplate,
    pipelineStatus,
    useCliSessionPanel: executionContext.useCliSessionPanel,
    cliSessionRef,
    t,
    loadCurrentNodeRuntime,
    ensureConversationRuntime,
    loadMessages,
    resolveCurrentNodePrompt,
    buildCliPrompt,
    appendCliUserLog,
    appendCliSystemLog,
    runCliPrompt,
    startNextPipelineStage,
    loadWorkflowStatus,
    markStartedOnce,
    stopCli,
    stopAgent,
    setMessages,
    setTask,
    setStartupError,
    setBackendWorkflowRun,
    setWorkflowRunNodes,
    startPipelineStage
  })

  const agentToolConfigId = executionContext.executionAgentToolConfigId

  // ===========================================================================
  // Return
  // ===========================================================================
  return {
    // Task
    task,
    setTask,
    isLoading,
    useCliSession,
    useCliSessionPanel: executionContext.useCliSessionPanel,
    showExecutionLogPanel: executionContext.showExecutionLogPanel,
    agentToolConfigId,

    // CLI Tools
    cliTools,

    // Dialogs
    isEditOpen: dialogs.isEditOpen,
    setIsEditOpen: dialogs.setIsEditOpen,
    editPrompt: dialogs.editPrompt,
    setEditPrompt: dialogs.setEditPrompt,
    editCliToolId: dialogs.editCliToolId,
    setEditCliToolId: dialogs.setEditCliToolId,
    editCliConfigId: dialogs.editCliConfigId,
    setEditCliConfigId: dialogs.setEditCliConfigId,
    cliConfigs: dialogs.cliConfigs,
    isDeleteOpen: dialogs.isDeleteOpen,
    setIsDeleteOpen: dialogs.setIsDeleteOpen,
    handleOpenEdit: dialogs.handleOpenEdit,
    handleSaveEdit: dialogs.handleSaveEdit,
    handleDeleteTask: dialogs.handleDeleteTask,

    // CLI Session
    cliStatus,
    cliSessionRef,
    handleCliStatusChange,
    currentNodeRuntime,
    executionSessionId: executionContext.executionSessionId,
    executionTaskNodeId: executionContext.executionTaskNodeId,
    executionLogTaskNodeId: executionContext.executionLogTaskNodeId,
    executionLogSource: executionContext.executionLogSource,
    executionLogToolId: executionContext.executionLogToolId,
    executionCliToolId: executionContext.executionCliToolId,

    // Prompt
    taskPrompt,

    // Tool Selection
    toolSelectionValue: toolSelection.toolSelectionValue,

    // Scroll
    messagesEndRef: scroll.messagesEndRef,
    messagesContainerRef: scroll.messagesContainerRef,

    // Working Dir
    workingDir,

    // Pipeline
    pipelineTemplate,
    pipelineStatus,
    pipelineBanner,
    startPipelineStage,
    startNextPipelineStage,

    // Workflow
    currentTaskNode,
    workflowNodes,
    workflowCurrentNode,
    workflowSummary: viewState.workflowSummary,
    isWorkflowExpanded,
    toggleWorkflowExpanded,
    selectedWorkflowNodeId: selectedWorkflowNode?.id ?? null,
    handleSelectWorkflowNode,
    handleApproveTaskNode,

    // Artifacts
    artifacts: preview.artifacts,
    selectedArtifact: preview.selectedArtifact,
    activePreviewTab: preview.activePreviewTab,
    isPreviewVisible: preview.isPreviewVisible,
    workspaceRefreshToken: preview.workspaceRefreshToken,
    handleOpenPreviewTab: preview.handleOpenPreviewTab,
    handleTogglePreviewTab: preview.handleTogglePreviewTab,
    handleClosePreviewPanel: preview.handleClosePreviewPanel,
    handleSelectArtifact: preview.handleSelectArtifact,
    handleClosePreview: preview.handleClosePreview,
    setIsPreviewVisible: preview.setIsPreviewVisible,

    // View State
    displayTitle: viewState.displayTitle,
    cliToolLabel: viewState.cliToolLabel,
    cliStatusInfo: viewState.cliStatusInfo,
    showActionButton: viewState.showActionButton,
    actionKind: viewState.actionKind,
    actionLabel: viewState.actionLabel,
    actionDisabled: viewState.actionDisabled,
    showWorkflowCard: viewState.showWorkflowCard,
    workflowGraph,
    visibleMetaRows: viewState.visibleMetaRows,

    // Actions
    handleReply: actions.handleReply,
    handleStartTask: actions.handleStartTask,
    handleApproveCliTask: actions.handleApproveCliTask,
    handleStopExecution: actions.handleStopExecution,
    replyIsRunning: viewState.replyIsRunning,
    replyDisabled: viewState.replyDisabled,
    replyPlaceholder: viewState.replyPlaceholder,
    isCliTaskReviewPending: viewState.isCliTaskReviewPending
  }
}
