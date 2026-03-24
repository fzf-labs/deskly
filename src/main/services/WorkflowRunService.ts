import type { TaskRepository } from './database/TaskRepository'
import type { WorkflowDefinitionRepository } from './database/WorkflowDefinitionRepository'
import type { WorkflowRunNodeRepository } from './database/WorkflowRunNodeRepository'
import type { WorkflowRunRepository } from './database/WorkflowRunRepository'
import type { WorkflowRunReviewRepository } from './database/WorkflowRunReviewRepository'
import type {
  CreateWorkflowRunReviewInput,
  CreateWorkflowRunInput,
  WorkflowRun,
  WorkflowRunNode,
  WorkflowRunStatus
} from '../types/workflow-run'
import type { WorkflowDefinitionDocument } from '../types/workflow-definition'
import { validateWorkflowDefinitionDocument } from './WorkflowDefinitionService'

const composeWorkflowNodePrompt = (
  taskPrompt: string | null | undefined,
  nodePrompt: string | null | undefined
): string => {
  const basePrompt = taskPrompt ?? ''
  const templatePrompt = nodePrompt ?? ''

  if (basePrompt && templatePrompt) {
    return `${basePrompt}\n\n${templatePrompt}`
  }

  return basePrompt || templatePrompt
}

export class WorkflowRunService {
  private taskRepo: TaskRepository
  private definitionRepo: WorkflowDefinitionRepository
  private runRepo: WorkflowRunRepository
  private runNodeRepo: WorkflowRunNodeRepository
  private reviewRepo: WorkflowRunReviewRepository

  constructor(
    taskRepo: TaskRepository,
    definitionRepo: WorkflowDefinitionRepository,
    runRepo: WorkflowRunRepository,
    runNodeRepo: WorkflowRunNodeRepository,
    reviewRepo: WorkflowRunReviewRepository
  ) {
    this.taskRepo = taskRepo
    this.definitionRepo = definitionRepo
    this.runRepo = runRepo
    this.runNodeRepo = runNodeRepo
    this.reviewRepo = reviewRepo
  }

  createRunForTask(input: {
    taskId: string
    workflowDefinitionId?: string | null
    definition?: WorkflowDefinitionDocument
  }): WorkflowRun {
    const task = this.taskRepo.getTask(input.taskId)
    if (!task) {
      throw new Error(`Task not found: ${input.taskId}`)
    }

    const existingRun = this.runRepo.getRunByTask(input.taskId)
    if (existingRun) {
      throw new Error(`Workflow run already exists for task: ${input.taskId}`)
    }

    let workflowDefinitionId: string | null = null
    let definition: WorkflowDefinitionDocument | null = null

    if (input.workflowDefinitionId) {
      const storedDefinition = this.definitionRepo.getDefinition(input.workflowDefinitionId)
      if (!storedDefinition) {
        throw new Error(`Workflow definition not found: ${input.workflowDefinitionId}`)
      }
      workflowDefinitionId = storedDefinition.id
      definition = input.definition ?? storedDefinition.definition
    } else if (input.definition) {
      definition = input.definition
    }

    if (!definition) {
      throw new Error('Workflow definition snapshot is required')
    }

    validateWorkflowDefinitionDocument(definition, {
      allowEmptyPromptForKeys: ['conversation']
    })

    const run = this.runRepo.createRun({
      task_id: input.taskId,
      workflow_definition_id: workflowDefinitionId,
      definition_snapshot: definition,
      status: 'waiting',
      current_wave: 0
    } satisfies CreateWorkflowRunInput)

    this.runNodeRepo.createRunNodes(
      run.id,
      definition.nodes.map((node) => ({
        workflow_run_id: run.id,
        definition_node_id: node.id,
        node_key: node.key,
        name: node.name,
        node_type: node.type,
        prompt: composeWorkflowNodePrompt(task.prompt, node.prompt),
        cli_tool_id: node.cliToolId ?? null,
        agent_tool_config_id: node.agentToolConfigId ?? null,
        requires_approval_after_run: node.requiresApprovalAfterRun,
        status: 'waiting',
        attempt_count: 0
      }))
    )

    return run
  }

  getRun(id: string): WorkflowRun | null {
    return this.runRepo.getRun(id)
  }

  getRunByTask(taskId: string): WorkflowRun | null {
    return this.runRepo.getRunByTask(taskId)
  }

  listRunNodes(workflowRunId: string): WorkflowRunNode[] {
    return this.runNodeRepo.listRunNodes(workflowRunId)
  }

  startRun(runId: string): WorkflowRun | null {
    const run = this.runRepo.getRun(runId)
    if (!run) {
      return null
    }

    const now = new Date().toISOString()
    const updated = this.runRepo.updateRun(runId, {
      status: 'running',
      started_at: run.started_at ?? now,
      completed_at: null
    })
    this.syncTaskStatusFromRun(runId)
    return updated
  }

  approveNode(
    workflowRunNodeId: string,
    input: Omit<CreateWorkflowRunReviewInput, 'workflow_run_node_id' | 'workflow_run_id'> = {}
  ): WorkflowRunNode | null {
    const node = this.runNodeRepo.getRunNode(workflowRunNodeId)
    if (!node) {
      return null
    }
    if (node.status !== 'review') {
      throw new Error('Only review nodes can be approved')
    }

    this.reviewRepo.createReview({
      workflow_run_id: node.workflow_run_id,
      workflow_run_node_id: node.id,
      decision: 'approved',
      comment: input.comment ?? null,
      reviewed_by: input.reviewed_by ?? null,
      reviewed_at: input.reviewed_at
    })

    const updated = this.runNodeRepo.updateRunNode(node.id, {
      status: 'done',
      failure_reason: null,
      error_message: null
    })

    this.syncRunStatus(node.workflow_run_id)
    return updated
  }

  retryNode(workflowRunNodeId: string): WorkflowRunNode | null {
    const node = this.runNodeRepo.getRunNode(workflowRunNodeId)
    if (!node) {
      return null
    }
    if (node.status !== 'failed' && node.status !== 'review') {
      throw new Error('Only failed or review nodes can be retried')
    }

    const updated = this.runNodeRepo.resetForRetry(node.id)
    this.syncRunStatus(node.workflow_run_id)
    return updated
  }

  stopRun(runId: string): WorkflowRun | null {
    const run = this.runRepo.getRun(runId)
    if (!run) {
      return null
    }

    this.runNodeRepo.failActiveNodes(runId, 'cancelled')
    const updated = this.runRepo.updateRun(runId, {
      status: 'failed',
      completed_at: new Date().toISOString()
    })
    this.syncTaskStatusFromRun(runId)
    return updated
  }

  syncRunStatus(runId: string): WorkflowRun | null {
    const run = this.runRepo.getRun(runId)
    if (!run) {
      return null
    }

    const nodes = this.runNodeRepo.listRunNodes(runId)
    if (nodes.length === 0) {
      const updated = this.runRepo.updateRun(runId, {
        status: 'waiting',
        started_at: null,
        completed_at: null
      })
      this.syncTaskStatusFromRun(runId)
      return updated
    }

    const status = this.aggregateStatus(nodes)
    const startedAt = nodes
      .map((node) => node.started_at)
      .filter((value): value is string => Boolean(value))
      .sort()[0] ?? null

    const completedValues = nodes
      .map((node) => node.completed_at)
      .filter((value): value is string => Boolean(value))
      .sort()

    const isTerminal = nodes.every((node) => node.status === 'done' || node.status === 'failed')
    const completedAt = isTerminal && completedValues.length > 0 ? completedValues.at(-1) ?? null : null

    const updated = this.runRepo.updateRun(runId, {
      status,
      started_at: startedAt,
      completed_at: completedAt
    })
    this.syncTaskStatusFromRun(runId)
    return updated
  }

  private aggregateStatus(nodes: WorkflowRunNode[]): WorkflowRunStatus {
    if (nodes.some((node) => node.status === 'running')) {
      return 'running'
    }
    if (nodes.some((node) => node.status === 'review')) {
      return 'review'
    }
    if (nodes.every((node) => node.status === 'waiting')) {
      return 'waiting'
    }
    if (nodes.some((node) => node.status === 'failed')) {
      return 'failed'
    }
    if (nodes.every((node) => node.status === 'done')) {
      return 'done'
    }
    return 'running'
  }

  private syncTaskStatusFromRun(runId: string): void {
    const run = this.runRepo.getRun(runId)
    if (!run) return

    this.taskRepo.updateTask(run.task_id, {
      status: this.mapRunStatusToTaskStatus(run.status),
      started_at: run.started_at,
      completed_at: run.completed_at
    })
  }

  private mapRunStatusToTaskStatus(
    runStatus: WorkflowRunStatus
  ): 'todo' | 'in_progress' | 'in_review' | 'done' | 'failed' {
    switch (runStatus) {
      case 'waiting':
        return 'todo'
      case 'running':
        return 'in_progress'
      case 'review':
        return 'in_review'
      case 'done':
        return 'done'
      case 'failed':
        return 'failed'
    }
  }
}
