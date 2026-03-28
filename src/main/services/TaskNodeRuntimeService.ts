import { buildConversationWorkflowDefinition } from './workflow-definition-utils'
import { getWorkflowCurrentNodeId, getWorkflowNodeOrderMap } from './workflow-graph'
import { TaskRepository } from './database/TaskRepository'
import { WorkflowRunNodeRepository } from './database/WorkflowRunNodeRepository'
import { WorkflowRunService } from './WorkflowRunService'
import type { WorkflowSchedulerService } from './WorkflowSchedulerService'
import type { TaskNode, TaskNodeStatus } from '../types/task'
import type { WorkflowRun, WorkflowRunNode } from '../types/workflow-run'

const TASK_NODE_STATUS_VALUES = ['todo', 'in_progress', 'in_review', 'done', 'failed'] as const
type TaskNodeStatusValue = (typeof TASK_NODE_STATUS_VALUES)[number]

export class TaskNodeRuntimeService {
  private taskRepo: TaskRepository
  private workflowRunService: WorkflowRunService
  private workflowRunNodeRepo: WorkflowRunNodeRepository
  private workflowSchedulerService: WorkflowSchedulerService | null = null
  private taskNodeStatusListeners: Array<(node: TaskNode) => void> = []

  constructor(
    taskRepo: TaskRepository,
    workflowRunService: WorkflowRunService,
    workflowRunNodeRepo: WorkflowRunNodeRepository
  ) {
    this.taskRepo = taskRepo
    this.workflowRunService = workflowRunService
    this.workflowRunNodeRepo = workflowRunNodeRepo
  }

  onTaskNodeStatusChange(listener: (node: TaskNode) => void): () => void {
    this.taskNodeStatusListeners.push(listener)
    return () => {
      this.taskNodeStatusListeners = this.taskNodeStatusListeners.filter(
        (registered) => registered !== listener
      )
    }
  }

  setWorkflowSchedulerService(service: WorkflowSchedulerService): void {
    this.workflowSchedulerService = service
  }

  getTaskNodes(taskId: string): TaskNode[] {
    const workflowRun = this.workflowRunService.getRunByTask(taskId)
    if (!workflowRun) {
      return []
    }

    return this.mapWorkflowRunNodesToTaskNodes(
      workflowRun,
      this.workflowRunService.listRunNodes(workflowRun.id)
    )
  }

  getTaskNode(nodeId: string): TaskNode | null {
    const workflowNode = this.workflowRunNodeRepo.getRunNode(nodeId)
    if (!workflowNode) return null

    const workflowRun = this.workflowRunService.getRun(workflowNode.workflow_run_id)
    if (!workflowRun) return null

    const orderMap = getWorkflowNodeOrderMap(workflowRun.definition_snapshot)
    return this.mapWorkflowRunNodeToTaskNode(workflowRun.task_id, workflowNode, orderMap)
  }

  getCurrentTaskNode(taskId: string): TaskNode | null {
    const workflowRun = this.workflowRunService.getRunByTask(taskId)
    if (!workflowRun) {
      return null
    }

    const nodes = this.workflowRunService.listRunNodes(workflowRun.id)
    const currentNodeId = getWorkflowCurrentNodeId(workflowRun.definition_snapshot, nodes)
    if (!currentNodeId) {
      return null
    }

    const currentNode = nodes.find((node) => node.id === currentNodeId)
    if (!currentNode) {
      return null
    }

    const orderMap = getWorkflowNodeOrderMap(workflowRun.definition_snapshot)
    return this.mapWorkflowRunNodeToTaskNode(taskId, currentNode, orderMap)
  }

  updateCurrentTaskNodeRuntime(
    taskId: string,
    updates: {
      session_id?: string | null
      resume_session_id?: string | null
      cli_tool_id?: string | null
      agent_tool_config_id?: string | null
    }
  ): TaskNode | null {
    this.ensureConversationTaskNode(taskId)
    const workflowRun = this.workflowRunService.getRunByTask(taskId)
    if (!workflowRun) {
      return null
    }

    const currentNode = this.getCurrentTaskNode(taskId)
    const updated = this.workflowRunNodeRepo.updateRunNodeRuntime(
      workflowRun.id,
      currentNode?.id ?? null,
      updates
    )

    if (updated) {
      const mapped = this.getTaskNode(updated.id)
      if (mapped) {
        this.notifyTaskNodeStatusChange(mapped)
      }
      return mapped
    }

    return null
  }

  updateTaskNodeResumeSessionId(nodeId: string, resumeSessionId: string | null): TaskNode | null {
    const workflowNode = this.workflowRunNodeRepo.getRunNode(nodeId)
    if (!workflowNode) {
      return null
    }

    const updated = this.workflowRunNodeRepo.setNodeResumeSessionId(nodeId, resumeSessionId)
    if (updated) {
      const mapped = this.getTaskNode(updated.id)
      if (mapped) {
        this.notifyTaskNodeStatusChange(mapped)
      }
      return mapped
    }

    return null
  }

  getTaskNodesByStatus(taskId: string, status: TaskNodeStatus): TaskNode[] {
    if (!TASK_NODE_STATUS_VALUES.includes(status as TaskNodeStatusValue)) {
      throw new Error(`Unsupported task node status: ${status}`)
    }

    return this.getTaskNodes(taskId).filter((node) => node.status === status)
  }

  getInProgressTaskNodes(): TaskNode[] {
    return this.workflowRunNodeRepo
      .getAllNodesByStatus('running')
      .map((node) => {
        const run = this.workflowRunService.getRun(node.workflow_run_id)
        if (!run) return null

        return this.mapWorkflowRunNodeToTaskNode(
          run.task_id,
          node,
          getWorkflowNodeOrderMap(run.definition_snapshot)
        )
      })
      .filter((node): node is TaskNode => Boolean(node))
  }

  updateTaskNodeSession(nodeId: string, sessionId: string | null): TaskNode | null {
    const workflowNode = this.workflowRunNodeRepo.getRunNode(nodeId)
    if (!workflowNode) {
      return null
    }

    const updated = this.workflowRunNodeRepo.setNodeSessionId(nodeId, sessionId)
    if (updated) {
      const mapped = this.getTaskNode(updated.id)
      if (mapped) {
        this.notifyTaskNodeStatusChange(mapped)
      }
      return mapped
    }

    return null
  }

  startTaskExecution(taskId: string): TaskNode | null {
    const task = this.taskRepo.getTask(taskId)
    if (!task) return null
    if (task.task_mode !== 'conversation') {
      return this.getCurrentTaskNode(taskId)
    }

    const currentNode = this.ensureConversationTaskNode(taskId)
    if (!currentNode) return null
    if (currentNode.status === 'in_progress') return currentNode
    if (currentNode.status !== 'todo') return currentNode

    const updated = this.workflowRunNodeRepo.markRunning(currentNode.id)
    if (!updated) {
      return currentNode
    }

    this.workflowRunService.syncRunStatus(updated.workflow_run_id)
    const mapped = this.getTaskNode(updated.id)
    if (mapped) {
      this.notifyTaskNodeStatusChange(mapped)
    }
    return mapped
  }

  stopTaskExecution(taskId: string): TaskNode | null {
    const currentNode = this.getCurrentTaskNode(taskId)
    if (!currentNode) return null
    return this.stopTaskNodeExecution(currentNode.id, 'stopped_by_user')
  }

  stopTaskNodeExecution(nodeId: string, reason?: string): TaskNode | null {
    const workflowNode = this.workflowRunNodeRepo.getRunNode(nodeId)
    if (!workflowNode) {
      return null
    }

    return this.handleWorkflowNodeUpdate(
      this.workflowRunNodeRepo.markFailed(nodeId, 'cancelled', reason ?? 'stopped_by_user'),
      {
        syncRunStatus: true,
        notifyScheduler: true
      }
    )
  }

  completeTaskNode(
    nodeId: string,
    result: {
      resultSummary?: string | null
      cost?: number | null
      duration?: number | null
      sessionId?: string | null
      allowConversationCompletion?: boolean
    } = {}
  ): TaskNode | null {
    const workflowNode = this.workflowRunNodeRepo.getRunNode(nodeId)
    if (!workflowNode) {
      return null
    }

    const workflowRun = this.workflowRunService.getRun(workflowNode.workflow_run_id)
    const task = workflowRun ? this.taskRepo.getTask(workflowRun.task_id) : null
    const shouldEnterReview =
      workflowNode.requires_approval_after_run ||
      (task?.task_mode === 'conversation' && !result.allowConversationCompletion)

    const updated = shouldEnterReview
      ? this.workflowRunNodeRepo.markReview(nodeId, {
          result_summary: result.resultSummary ?? null,
          cost: result.cost ?? null,
          duration: result.duration ?? null,
          session_id: result.sessionId ?? null
        })
      : this.workflowRunNodeRepo.markDone(nodeId, {
          result_summary: result.resultSummary ?? null,
          cost: result.cost ?? null,
          duration: result.duration ?? null,
          session_id: result.sessionId ?? null
        })

    return this.handleWorkflowNodeUpdate(updated, {
      syncRunStatus: true,
      notifyScheduler: true
    })
  }

  markTaskNodeErrorReview(nodeId: string, error: string): TaskNode | null {
    const workflowNode = this.workflowRunNodeRepo.getRunNode(nodeId)
    if (!workflowNode) {
      return null
    }

    return this.handleWorkflowNodeUpdate(
      this.workflowRunNodeRepo.markFailed(nodeId, 'execution_error', error),
      {
        syncRunStatus: true,
        notifyScheduler: true
      }
    )
  }

  approveTaskNode(nodeId: string): TaskNode | null {
    const workflowNode = this.workflowRunNodeRepo.getRunNode(nodeId)
    if (!workflowNode) {
      return null
    }

    return this.handleWorkflowNodeUpdate(this.workflowRunService.approveNode(nodeId), {
      notifyScheduler: true
    })
  }

  rerunTaskNode(nodeId: string): TaskNode | null {
    const workflowNode = this.workflowRunNodeRepo.getRunNode(nodeId)
    if (!workflowNode) {
      return null
    }

    return this.handleWorkflowNodeUpdate(this.workflowRunService.retryNode(nodeId), {
      notifyScheduler: true
    })
  }

  getTaskIdBySessionId(sessionId: string): string | null {
    return this.workflowRunNodeRepo.getTaskIdBySessionId(sessionId)
  }

  getCombinedPromptForTaskNode(taskNodeId: string): string | null {
    const node = this.getTaskNode(taskNodeId)
    if (!node) return null

    const nodePrompt = node.prompt?.trim()
    return nodePrompt || null
  }

  notifyTaskNodeStatusChange(node: TaskNode): void {
    this.taskNodeStatusListeners.forEach((listener) => {
      try {
        listener(node)
      } catch (error) {
        console.error('[TaskNodeRuntimeService] Task node status listener failed:', error)
      }
    })
  }

  private ensureConversationTaskNode(taskId: string): TaskNode | null {
    const task = this.taskRepo.getTask(taskId)
    if (!task || task.task_mode !== 'conversation') {
      return null
    }

    const existingRun = this.workflowRunService.getRunByTask(taskId)
    if (existingRun) {
      const existingNodes = this.workflowRunService.listRunNodes(existingRun.id)
      const currentNodeId = getWorkflowCurrentNodeId(existingRun.definition_snapshot, existingNodes)
      const currentNode =
        existingNodes.find((node) => node.id === currentNodeId) ?? existingNodes[0] ?? null
      if (!currentNode) {
        return null
      }

      return this.mapWorkflowRunNodeToTaskNode(
        task.id,
        currentNode,
        getWorkflowNodeOrderMap(existingRun.definition_snapshot)
      )
    }

    const createdRun = this.workflowRunService.createRunForTask({
      taskId,
      definition: buildConversationWorkflowDefinition()
    })

    const createdNodes = this.workflowRunService.listRunNodes(createdRun.id)
    const createdNode = createdNodes[0]
    if (!createdNode) {
      return null
    }

    return this.mapWorkflowRunNodeToTaskNode(
      task.id,
      createdNode,
      getWorkflowNodeOrderMap(createdRun.definition_snapshot)
    )
  }

  private mapWorkflowRunNodesToTaskNodes(run: WorkflowRun, nodes: WorkflowRunNode[]): TaskNode[] {
    const orderMap = getWorkflowNodeOrderMap(run.definition_snapshot)

    return nodes
      .map((node) => this.mapWorkflowRunNodeToTaskNode(run.task_id, node, orderMap))
      .sort((left, right) => left.node_order - right.node_order)
  }

  private mapWorkflowRunNodeToTaskNode(
    taskId: string,
    node: WorkflowRunNode,
    orderMap: Map<string, number>
  ): TaskNode {
    return {
      id: node.id,
      task_id: taskId,
      node_order: orderMap.get(node.definition_node_id) ?? Number.MAX_SAFE_INTEGER,
      name: node.name,
      prompt: node.prompt ?? '',
      cli_tool_id: node.cli_tool_id,
      agent_tool_config_id: node.agent_tool_config_id,
      requires_approval: node.requires_approval_after_run ? 1 : 0,
      status: this.mapWorkflowNodeStatusToTaskNodeStatus(node.status),
      session_id: node.session_id,
      resume_session_id: node.resume_session_id,
      result_summary: node.result_summary,
      error_message: node.error_message,
      cost: node.cost,
      duration: node.duration,
      started_at: node.started_at,
      completed_at: node.completed_at,
      created_at: node.created_at,
      updated_at: node.updated_at
    }
  }

  private mapWorkflowNodeStatusToTaskNodeStatus(status: WorkflowRunNode['status']): TaskNodeStatus {
    switch (status) {
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

  private handleWorkflowNodeUpdate(
    updated: WorkflowRunNode | null,
    options: {
      syncRunStatus?: boolean
      notifyScheduler?: boolean
    } = {}
  ): TaskNode | null {
    if (!updated) {
      return null
    }

    if (options.syncRunStatus) {
      this.workflowRunService.syncRunStatus(updated.workflow_run_id)
    }

    const mapped = this.getTaskNode(updated.id)
    if (mapped) {
      this.notifyTaskNodeStatusChange(mapped)
    }

    if (options.notifyScheduler) {
      void this.workflowSchedulerService?.onNodeUpdated(updated.id)
    }

    return mapped
  }
}
