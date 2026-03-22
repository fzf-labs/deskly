import type { WorkflowDefinition, WorkflowDefinitionDocument } from '@/data'
import { newUuid } from '@/lib/ids'

import type { WorkflowTemplateFormValues } from './WorkflowTemplateDialog'

const getTopologicalNodeOrder = (
  definition: WorkflowDefinitionDocument
): Array<WorkflowDefinitionDocument['nodes'][number]> => {
  const nodesById = new Map(definition.nodes.map((node) => [node.id, node]))
  const incomingCount = new Map<string, number>()
  const outgoing = new Map<string, string[]>()

  definition.nodes.forEach((node) => {
    incomingCount.set(node.id, 0)
    outgoing.set(node.id, [])
  })

  definition.edges.forEach((edge) => {
    if (!nodesById.has(edge.from) || !nodesById.has(edge.to)) {
      return
    }

    incomingCount.set(edge.to, (incomingCount.get(edge.to) ?? 0) + 1)
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to])
  })

  const queue = definition.nodes
    .filter((node) => (incomingCount.get(node.id) ?? 0) === 0)
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((node) => node.id)

  const ordered: Array<WorkflowDefinitionDocument['nodes'][number]> = []

  while (queue.length > 0) {
    const currentId = queue.shift()!
    const currentNode = nodesById.get(currentId)
    if (!currentNode) {
      continue
    }

    ordered.push(currentNode)

    for (const nextId of outgoing.get(currentId) ?? []) {
      const nextIncomingCount = (incomingCount.get(nextId) ?? 0) - 1
      incomingCount.set(nextId, nextIncomingCount)
      if (nextIncomingCount === 0) {
        queue.push(nextId)
      }
    }
  }

  return ordered.length === definition.nodes.length ? ordered : definition.nodes
}

export const workflowDefinitionToFormValues = (
  definition: WorkflowDefinition
): WorkflowTemplateFormValues => {
  const orderedNodes = getTopologicalNodeOrder(definition.definition)
  const dependencyMap = new Map<string, string[]>()

  definition.definition.edges.forEach((edge) => {
    dependencyMap.set(edge.to, [...(dependencyMap.get(edge.to) ?? []), edge.from])
  })

  return {
    name: definition.name,
    description: definition.description ?? undefined,
    nodes: orderedNodes.map((node, index) => ({
      id: node.id,
      key: node.key || `workflow-node-${index + 1}`,
      type: node.type,
      name: node.name,
      prompt: node.prompt ?? '',
      command: node.command ?? '',
      cliToolId: node.cliToolId ?? '',
      agentToolConfigId: node.agentToolConfigId ?? '',
      requiresApproval: Boolean(node.requiresApprovalAfterRun),
      dependsOnIds: dependencyMap.get(node.id) ?? []
    }))
  }
}

export const buildWorkflowDefinitionFromForm = (
  values: WorkflowTemplateFormValues
): WorkflowDefinitionDocument => {
  const nodes = values.nodes.map((node, index) => {
    const id = node.id || newUuid()

    return {
      id,
      key: node.key?.trim() || `workflow-node-${index + 1}`,
      type: node.type,
      name: node.name,
      prompt: node.type === 'agent' ? node.prompt : null,
      command: node.type === 'command' ? node.command : null,
      cliToolId: node.type === 'agent' ? node.cliToolId || null : null,
      agentToolConfigId: node.type === 'agent' ? node.agentToolConfigId || null : null,
      requiresApprovalAfterRun: Boolean(node.requiresApproval),
      position: {
        x: index * 280,
        y: 0
      }
    }
  })

  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = values.nodes.flatMap((node, index) => {
    const to = nodes[index]!.id
    return (node.dependsOnIds ?? [])
      .filter((from) => from !== to && nodeIds.has(from))
      .map((from) => ({ from, to }))
  })

  return {
    version: 1,
    nodes,
    edges
  }
}
