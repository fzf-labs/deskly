import type { WorkflowDefinitionDocument } from '../types/workflow-definition'
import type { WorkflowRunNode, WorkflowRunNodeStatus } from '../types/workflow-run'

export type WorkflowGraphState = {
  topologicalOrder: string[]
  predecessors: Map<string, string[]>
  successors: Map<string, string[]>
}

export const buildWorkflowGraphState = (
  definition: WorkflowDefinitionDocument
): WorkflowGraphState => {
  const predecessors = new Map<string, string[]>()
  const successors = new Map<string, string[]>()
  const indegree = new Map<string, number>()

  definition.nodes.forEach((node) => {
    predecessors.set(node.id, [])
    successors.set(node.id, [])
    indegree.set(node.id, 0)
  })

  definition.edges.forEach((edge) => {
    predecessors.get(edge.to)?.push(edge.from)
    successors.get(edge.from)?.push(edge.to)
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1)
  })

  const queue = definition.nodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .map((node) => node.id)
  const topologicalOrder: string[] = []

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    topologicalOrder.push(nodeId)

    for (const nextId of successors.get(nodeId) ?? []) {
      const nextIndegree = (indegree.get(nextId) ?? 0) - 1
      indegree.set(nextId, nextIndegree)
      if (nextIndegree === 0) {
        queue.push(nextId)
      }
    }
  }

  return {
    topologicalOrder,
    predecessors,
    successors
  }
}

export const getWorkflowReadyNodeIds = (
  definition: WorkflowDefinitionDocument,
  nodes: WorkflowRunNode[]
): string[] => {
  const graph = buildWorkflowGraphState(definition)
  const nodesByDefinitionId = new Map(nodes.map((node) => [node.definition_node_id, node]))

  return graph.topologicalOrder.filter((definitionNodeId) => {
    const node = nodesByDefinitionId.get(definitionNodeId)
    if (!node || node.status !== 'waiting') {
      return false
    }

    const predecessorIds = graph.predecessors.get(definitionNodeId) ?? []
    if (predecessorIds.length === 0) {
      return true
    }

    return predecessorIds.every((predecessorId) => {
      const predecessor = nodesByDefinitionId.get(predecessorId)
      return predecessor?.status === 'done'
    })
  })
}

export const getWorkflowBlockedNodeIds = (
  definition: WorkflowDefinitionDocument,
  nodes: WorkflowRunNode[]
): string[] => {
  const graph = buildWorkflowGraphState(definition)
  const nodesByDefinitionId = new Map(nodes.map((node) => [node.definition_node_id, node]))

  return graph.topologicalOrder.filter((definitionNodeId) => {
    const node = nodesByDefinitionId.get(definitionNodeId)
    if (!node || node.status !== 'waiting') {
      return false
    }

    const predecessorIds = graph.predecessors.get(definitionNodeId) ?? []
    return predecessorIds.some((predecessorId) => {
      const predecessor = nodesByDefinitionId.get(predecessorId)
      return predecessor?.status === 'failed'
    })
  })
}

export const getWorkflowCurrentNodeId = (
  definition: WorkflowDefinitionDocument,
  nodes: WorkflowRunNode[]
): string | null => {
  const graph = buildWorkflowGraphState(definition)
  const nodesByDefinitionId = new Map(nodes.map((node) => [node.definition_node_id, node]))
  const readyNodeIds = new Set(getWorkflowReadyNodeIds(definition, nodes))

  const pickFirst = (predicate: (status: WorkflowRunNodeStatus) => boolean): string | null => {
    for (const definitionNodeId of graph.topologicalOrder) {
      const node = nodesByDefinitionId.get(definitionNodeId)
      if (node && predicate(node.status)) {
        return node.id
      }
    }
    return null
  }

  return (
    pickFirst((status) => status === 'running') ??
    pickFirst((status) => status === 'review') ??
    pickFirst((status) => status === 'failed') ??
    graph.topologicalOrder
      .map((definitionNodeId) => nodesByDefinitionId.get(definitionNodeId))
      .find((node) => node && readyNodeIds.has(node.definition_node_id))?.id ??
    graph.topologicalOrder
      .map((definitionNodeId) => nodesByDefinitionId.get(definitionNodeId))
      .find(Boolean)?.id ??
    null
  )
}

export const getWorkflowNodeOrderMap = (
  definition: WorkflowDefinitionDocument
): Map<string, number> => {
  const graph = buildWorkflowGraphState(definition)
  return new Map(graph.topologicalOrder.map((nodeId, index) => [nodeId, index + 1]))
}
