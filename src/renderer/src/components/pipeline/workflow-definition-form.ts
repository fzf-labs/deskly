import type { WorkflowDefinition, WorkflowDefinitionDocument } from '@/data'
import { newUuid } from '@/lib/ids'

import type { WorkflowTemplateFormValues } from './WorkflowTemplateDialog'

const getLinearNodeOrder = (
  definition: WorkflowDefinitionDocument
): Array<WorkflowDefinitionDocument['nodes'][number]> | null => {
  const { nodes, edges } = definition

  if (nodes.length === 0) {
    return []
  }

  if (nodes.some((node) => node.type !== 'agent')) {
    return null
  }

  if (edges.length !== Math.max(0, nodes.length - 1)) {
    return null
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, string | null>()

  nodes.forEach((node) => {
    incoming.set(node.id, 0)
    outgoing.set(node.id, null)
  })

  for (const edge of edges) {
    if (!nodesById.has(edge.from) || !nodesById.has(edge.to)) {
      return null
    }

    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1)
    if ((incoming.get(edge.to) ?? 0) > 1) {
      return null
    }

    if (outgoing.get(edge.from)) {
      return null
    }
    outgoing.set(edge.from, edge.to)
  }

  const roots = nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0)
  if (roots.length !== 1) {
    return null
  }

  const ordered: Array<WorkflowDefinitionDocument['nodes'][number]> = []
  const visited = new Set<string>()
  let current: WorkflowDefinitionDocument['nodes'][number] | null = roots[0] ?? null

  while (current) {
    if (visited.has(current.id)) {
      return null
    }
    visited.add(current.id)
    ordered.push(current)
    const nextId = outgoing.get(current.id)
    current = nextId ? nodesById.get(nextId) ?? null : null
  }

  return visited.size === nodes.length ? ordered : null
}

export const canEditWorkflowDefinitionInLinearDialog = (
  definition: WorkflowDefinitionDocument
): boolean => {
  return getLinearNodeOrder(definition) !== null
}

export const workflowDefinitionToFormValues = (
  definition: WorkflowDefinition
): WorkflowTemplateFormValues | null => {
  const orderedNodes = getLinearNodeOrder(definition.definition)
  if (!orderedNodes) {
    return null
  }

  return {
    name: definition.name,
    description: definition.description ?? undefined,
    nodes: orderedNodes.map((node) => ({
      name: node.name,
      prompt: node.prompt ?? '',
      cliToolId: node.cliToolId ?? '',
      agentToolConfigId: node.agentToolConfigId ?? '',
      requiresApproval: Boolean(node.requiresApprovalAfterRun)
    }))
  }
}

export const buildWorkflowDefinitionFromForm = (
  values: WorkflowTemplateFormValues
): WorkflowDefinitionDocument => {
  const nodes = values.nodes.map((node, index) => ({
    id: newUuid(),
    key: `linear-node-${index + 1}`,
    type: 'agent' as const,
    name: node.name,
    prompt: node.prompt,
    command: null,
    cliToolId: node.cliToolId || null,
    agentToolConfigId: node.agentToolConfigId || null,
    requiresApprovalAfterRun: Boolean(node.requiresApproval),
    position: null
  }))

  return {
    version: 1,
    nodes,
    edges: nodes.slice(1).map((node, index) => ({
      from: nodes[index]!.id,
      to: node.id
    }))
  }
}
