import type { WorkflowDefinitionRepository } from './database/WorkflowDefinitionRepository'
import type {
  CreateWorkflowDefinitionInput,
  UpdateWorkflowDefinitionInput,
  WorkflowDefinition,
  WorkflowDefinitionDocument,
  WorkflowDefinitionNode
} from '../types/workflow-definition'

type WorkflowDefinitionFilter = {
  scope?: 'global' | 'project'
  projectId?: string | null
}

export class WorkflowDefinitionService {
  private repo: WorkflowDefinitionRepository

  constructor(repo: WorkflowDefinitionRepository) {
    this.repo = repo
  }

  listDefinitions(filter: WorkflowDefinitionFilter = {}): WorkflowDefinition[] {
    return this.repo.listDefinitions({
      scope: filter.scope,
      projectId: filter.projectId
    })
  }

  getDefinition(id: string): WorkflowDefinition | null {
    return this.repo.getDefinition(id)
  }

  createDefinition(input: CreateWorkflowDefinitionInput): WorkflowDefinition {
    this.validateScope(input.scope, input.project_id ?? null)
    this.validateDefinitionDocument(input.definition)
    return this.repo.createDefinition(input)
  }

  updateDefinition(input: UpdateWorkflowDefinitionInput): WorkflowDefinition {
    const existing = this.repo.getDefinition(input.id)
    if (!existing) {
      throw new Error(`Workflow definition not found: ${input.id}`)
    }

    this.validateScope(input.scope, input.project_id ?? null)
    this.validateDefinitionDocument(input.definition)
    return this.repo.updateDefinition(input)
  }

  deleteDefinition(id: string): boolean {
    return this.repo.deleteDefinition(id)
  }

  deleteDefinitionsByProject(projectId: string): number {
    return this.repo.deleteDefinitionsByProject(projectId)
  }

  private validateScope(scope: 'global' | 'project', projectId: string | null): void {
    if (scope === 'project' && !projectId) {
      throw new Error('Project workflow definition requires project_id')
    }
  }

  validateDefinitionDocument(document: WorkflowDefinitionDocument): void {
    if (document.version !== 1) {
      throw new Error('Workflow definition version must be 1')
    }

    if (!Array.isArray(document.nodes) || document.nodes.length === 0) {
      throw new Error('Workflow definition must contain at least one node')
    }

    if (!Array.isArray(document.edges)) {
      throw new Error('Workflow definition edges must be an array')
    }

    const nodeIds = new Set<string>()
    const nodeKeys = new Set<string>()
    const nodesById = new Map<string, WorkflowDefinitionNode>()

    document.nodes.forEach((node) => {
      if (!node.id?.trim()) {
        throw new Error('Workflow node id is required')
      }
      if (!node.key?.trim()) {
        throw new Error(`Workflow node key is required: ${node.id}`)
      }
      if (nodeIds.has(node.id)) {
        throw new Error(`Duplicate workflow node id: ${node.id}`)
      }
      if (nodeKeys.has(node.key)) {
        throw new Error(`Duplicate workflow node key: ${node.key}`)
      }
      if (node.type === 'agent' && !node.prompt?.trim()) {
        throw new Error(`Agent node requires prompt: ${node.id}`)
      }
      if (node.type === 'command' && !node.command?.trim()) {
        throw new Error(`Command node requires command: ${node.id}`)
      }

      nodeIds.add(node.id)
      nodeKeys.add(node.key)
      nodesById.set(node.id, node)
    })

    const edgeKeys = new Set<string>()
    const indegree = new Map<string, number>()
    const outgoing = new Map<string, string[]>()
    document.nodes.forEach((node) => {
      indegree.set(node.id, 0)
      outgoing.set(node.id, [])
    })

    document.edges.forEach((edge) => {
      if (!nodesById.has(edge.from) || !nodesById.has(edge.to)) {
        throw new Error(`Workflow edge references unknown node: ${edge.from} -> ${edge.to}`)
      }
      if (edge.from === edge.to) {
        throw new Error(`Workflow edge cannot self-reference: ${edge.from}`)
      }

      const edgeKey = `${edge.from}::${edge.to}`
      if (edgeKeys.has(edgeKey)) {
        throw new Error(`Duplicate workflow edge: ${edge.from} -> ${edge.to}`)
      }

      edgeKeys.add(edgeKey)
      indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1)
      outgoing.get(edge.from)!.push(edge.to)
    })

    const queue = [
      ...document.nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id)
    ]
    let visited = 0

    while (queue.length > 0) {
      const nodeId = queue.shift()!
      visited += 1

      for (const nextId of outgoing.get(nodeId) ?? []) {
        const nextIndegree = (indegree.get(nextId) ?? 0) - 1
        indegree.set(nextId, nextIndegree)
        if (nextIndegree === 0) {
          queue.push(nextId)
        }
      }
    }

    if (visited !== document.nodes.length) {
      throw new Error('Workflow definition must be a DAG')
    }
  }
}
