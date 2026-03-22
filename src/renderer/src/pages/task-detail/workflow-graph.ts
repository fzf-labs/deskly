import type { WorkflowDefinitionDocument, WorkflowRunNode } from '@/data'

import type { PipelineDisplayStatus, WorkflowGraph, WorkflowGraphNode, WorkflowNode } from './types'

const DEFAULT_NODE_SPACING_X = 280
const DEFAULT_NODE_SPACING_Y = 140

const normalizeWorkflowRunStatus = (
  status: WorkflowRunNode['status'] | undefined
): PipelineDisplayStatus => {
  if (status === 'running') return 'in_progress'
  if (status === 'review') return 'in_review'
  if (status === 'done' || status === 'failed') return status
  return 'todo'
}

const getFallbackPosition = (index: number) => ({
  x: index * DEFAULT_NODE_SPACING_X,
  y: 0
})

const normalizePosition = (
  position: WorkflowDefinitionDocument['nodes'][number]['position'] | undefined | null,
  index: number
) => {
  if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
    return {
      x: position.x,
      y: position.y
    }
  }

  return {
    x: index * DEFAULT_NODE_SPACING_X,
    y: (index % 2) * DEFAULT_NODE_SPACING_Y * 0.25
  }
}

interface BuildWorkflowGraphInput {
  definition?: WorkflowDefinitionDocument | null
  runNodes: WorkflowRunNode[]
  taskNodes: WorkflowNode[]
  currentNodeId?: string | null
  stageLabel: string
}

export function buildWorkflowGraph({
  definition,
  runNodes,
  taskNodes,
  currentNodeId,
  stageLabel
}: BuildWorkflowGraphInput): WorkflowGraph {
  const sortedTaskNodes = [...taskNodes].sort((left, right) => left.node_order - right.node_order)

  if (definition?.nodes?.length && runNodes.length > 0) {
    const taskNodeById = new Map(sortedTaskNodes.map((node) => [node.id, node]))
    const runNodeByDefinitionId = new Map(runNodes.map((node) => [node.definition_node_id, node]))

    const nodes: WorkflowGraphNode[] = definition.nodes.map((definitionNode, index) => {
      const runNode = runNodeByDefinitionId.get(definitionNode.id)
      const taskNode = runNode ? taskNodeById.get(runNode.id) : null
      const taskNodeIndex = runNode
        ? sortedTaskNodes.findIndex((node) => node.id === runNode.id)
        : -1
      const prompt =
        taskNode?.prompt ||
        runNode?.prompt ||
        runNode?.command ||
        definitionNode.prompt ||
        definitionNode.command ||
        ''

      return {
        id: runNode?.id ?? definitionNode.id,
        definitionId: definitionNode.id,
        node_order: taskNode?.node_order ?? (taskNodeIndex >= 0 ? taskNodeIndex : index),
        status: taskNode?.status ?? normalizeWorkflowRunStatus(runNode?.status),
        type: definitionNode.type,
        name:
          taskNode?.name || runNode?.name || definitionNode.name || `${stageLabel} ${index + 1}`,
        prompt,
        command: runNode?.command ?? definitionNode.command ?? null,
        requiresApproval: runNode
          ? Boolean(runNode.requires_approval_after_run)
          : Boolean(definitionNode.requiresApprovalAfterRun),
        position: normalizePosition(definitionNode.position, index),
        isCurrent: Boolean(currentNodeId && runNode?.id === currentNodeId)
      }
    })

    const definitionToGraphId = new Map(nodes.map((node) => [node.definitionId, node.id]))
    const edges = definition.edges.flatMap((edge, index) => {
      const source = definitionToGraphId.get(edge.from)
      const target = definitionToGraphId.get(edge.to)
      if (!source || !target) return []
      return [
        {
          id: `${edge.from}-${edge.to}-${index}`,
          source,
          target
        }
      ]
    })

    return {
      nodes: [...nodes].sort((left, right) => left.node_order - right.node_order),
      edges
    }
  }

  const nodes = sortedTaskNodes.map<WorkflowGraphNode>((node, index) => ({
    id: node.id,
    definitionId: node.id,
    node_order: node.node_order,
    status: node.status,
    type: 'agent',
    name: node.name || `${stageLabel} ${index + 1}`,
    prompt: node.prompt || '',
    command: null,
    requiresApproval: false,
    position: getFallbackPosition(index),
    isCurrent: Boolean(currentNodeId && node.id === currentNodeId)
  }))

  return {
    nodes,
    edges: nodes.slice(1).map((node, index) => ({
      id: `${nodes[index]!.id}-${node.id}`,
      source: nodes[index]!.id,
      target: node.id
    }))
  }
}
