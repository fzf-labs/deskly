import type {
  PipelineTemplate,
  WorkflowCurrentNode,
  WorkflowNode,
  WorkflowReviewNode
} from '../types'

export const sortWorkflowNodes = (workflowNodes: WorkflowNode[]): WorkflowNode[] =>
  [...workflowNodes].sort((left, right) => left.node_order - right.node_order)

export const buildWorkflowLinearNodes = ({
  workflowNodes,
  pipelineTemplate
}: {
  workflowNodes: WorkflowNode[]
  pipelineTemplate: PipelineTemplate | null
}): WorkflowNode[] => {
  if (workflowNodes.length > 0) {
    return sortWorkflowNodes(workflowNodes)
  }

  if (pipelineTemplate?.nodes?.length) {
    return pipelineTemplate.nodes.map((node, index) => ({
      id: node.id,
      node_order: Number.isFinite(node.node_order) ? node.node_order : index,
      status: 'todo' as const,
      name: node.name,
      prompt: node.prompt
    }))
  }

  return []
}

export const selectWorkflowNode = ({
  taskMode,
  workflowNodes,
  selectedWorkflowNodeId,
  workflowCurrentNode,
  currentTaskNode
}: {
  taskMode?: string | null
  workflowNodes: WorkflowNode[]
  selectedWorkflowNodeId: string | null
  workflowCurrentNode: WorkflowCurrentNode | null
  currentTaskNode: WorkflowReviewNode | null
}): WorkflowNode | null => {
  if (taskMode !== 'workflow') {
    return null
  }

  const sortedNodes = sortWorkflowNodes(workflowNodes)
  if (!sortedNodes.length) {
    return null
  }

  const fallbackNodeId = workflowCurrentNode?.id ?? currentTaskNode?.id ?? sortedNodes[0]?.id ?? null
  const targetNodeId = selectedWorkflowNodeId ?? fallbackNodeId
  if (!targetNodeId) {
    return null
  }

  return sortedNodes.find((node) => node.id === targetNodeId) ?? sortedNodes[0]
}

export const selectRuntimeWorkflowNode = ({
  taskMode,
  workflowNodes,
  workflowCurrentNode,
  currentTaskNode
}: {
  taskMode?: string | null
  workflowNodes: WorkflowNode[]
  workflowCurrentNode: WorkflowCurrentNode | null
  currentTaskNode: WorkflowReviewNode | null
}): WorkflowNode | null => {
  if (taskMode !== 'workflow') {
    return null
  }

  const sortedNodes = sortWorkflowNodes(workflowNodes)
  if (!sortedNodes.length) {
    return null
  }

  const runtimeNodeId = workflowCurrentNode?.id ?? currentTaskNode?.id ?? null
  if (!runtimeNodeId) {
    return sortedNodes[0] ?? null
  }

  return sortedNodes.find((node) => node.id === runtimeNodeId) ?? sortedNodes[0] ?? null
}
