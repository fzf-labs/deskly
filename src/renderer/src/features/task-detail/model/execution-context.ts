import type { CurrentNodeRuntime, WorkflowNode } from '../types'

interface ResolveTaskExecutionContextInput {
  taskMode?: string | null
  currentNodeRuntime: CurrentNodeRuntime
  currentTaskNodeId: string | null
  workflowCurrentNodeId: string | null
  selectedWorkflowNode: WorkflowNode | null
  runtimeWorkflowNode: WorkflowNode | null
  useCliSession: boolean
}

export const resolveTaskExecutionContext = ({
  taskMode,
  currentNodeRuntime,
  currentTaskNodeId,
  workflowCurrentNodeId,
  selectedWorkflowNode,
  runtimeWorkflowNode,
  useCliSession
}: ResolveTaskExecutionContextInput) => {
  const isWorkflow = taskMode === 'workflow'

  const executionTaskNodeId = isWorkflow
    ? runtimeWorkflowNode?.id ??
      workflowCurrentNodeId ??
      currentTaskNodeId ??
      currentNodeRuntime.taskNodeId ??
      null
    : currentNodeRuntime.taskNodeId ?? currentTaskNodeId ?? null

  const executionLogTaskNodeId = isWorkflow
    ? selectedWorkflowNode?.id ?? executionTaskNodeId ?? null
    : executionTaskNodeId

  const executionLogSource =
    !isWorkflow || !executionTaskNodeId || !executionLogTaskNodeId
      ? ('session' as const)
      : executionLogTaskNodeId === executionTaskNodeId
        ? ('session' as const)
        : ('file' as const)

  const executionSessionId = !isWorkflow
    ? currentNodeRuntime.sessionId || ''
    : !executionTaskNodeId
      ? ''
      : runtimeWorkflowNode?.session_id
        ? runtimeWorkflowNode.session_id
        : currentNodeRuntime.taskNodeId === executionTaskNodeId
          ? currentNodeRuntime.sessionId || ''
          : ''

  const executionCliToolId = !isWorkflow
    ? currentNodeRuntime.cliToolId || ''
    : runtimeWorkflowNode?.cli_tool_id || currentNodeRuntime.cliToolId || ''

  const executionAgentToolConfigId = !isWorkflow
    ? currentNodeRuntime.agentToolConfigId ?? null
    : runtimeWorkflowNode?.agent_tool_config_id ?? currentNodeRuntime.agentToolConfigId ?? null

  const executionLogToolId = !isWorkflow
    ? executionCliToolId
    : selectedWorkflowNode?.cli_tool_id || executionCliToolId || currentNodeRuntime.cliToolId || ''

  const useCliSessionPanel = isWorkflow
    ? Boolean(executionLogToolId || executionCliToolId || currentNodeRuntime.cliToolId)
    : useCliSession

  const showExecutionLogPanel = !isWorkflow
    ? useCliSessionPanel
    : executionLogSource === 'file'
      ? Boolean(executionLogTaskNodeId || executionTaskNodeId)
      : useCliSessionPanel

  return {
    executionTaskNodeId,
    executionLogTaskNodeId,
    executionLogSource,
    executionSessionId,
    executionCliToolId,
    executionAgentToolConfigId,
    executionLogToolId,
    useCliSessionPanel,
    showExecutionLogPanel
  }
}
