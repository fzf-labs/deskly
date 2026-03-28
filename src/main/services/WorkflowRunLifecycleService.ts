import { WorkflowRunService } from './WorkflowRunService'
import { WorkflowRunNodeRepository } from './database/WorkflowRunNodeRepository'
import type { WorkflowSchedulerService } from './WorkflowSchedulerService'
import type { TaskNode } from '../types/task'
import type { WorkflowRun, WorkflowRunNode } from '../types/workflow-run'

interface WorkflowRunLifecycleRuntime {
  getTaskNode: (nodeId: string) => TaskNode | null
  notifyTaskNodeStatusChange: (node: TaskNode) => void
}

export class WorkflowRunLifecycleService {
  private workflowRunService: WorkflowRunService
  private workflowRunNodeRepo: WorkflowRunNodeRepository
  private runtime: WorkflowRunLifecycleRuntime
  private workflowSchedulerService: WorkflowSchedulerService | null = null

  constructor(
    workflowRunService: WorkflowRunService,
    workflowRunNodeRepo: WorkflowRunNodeRepository,
    runtime: WorkflowRunLifecycleRuntime
  ) {
    this.workflowRunService = workflowRunService
    this.workflowRunNodeRepo = workflowRunNodeRepo
    this.runtime = runtime
  }

  setWorkflowSchedulerService(service: WorkflowSchedulerService): void {
    this.workflowSchedulerService = service
  }

  async startRun(workflowRunId: string): Promise<WorkflowRun | null> {
    await this.workflowSchedulerService?.startRun(workflowRunId)
    return this.workflowRunService.getRun(workflowRunId)
  }

  approveNode(
    workflowRunNodeId: string,
    input?: {
      comment?: string | null
      reviewed_by?: string | null
      reviewed_at?: string
    }
  ): WorkflowRunNode | null {
    const updated = this.workflowRunService.approveNode(workflowRunNodeId, input)
    if (updated) {
      this.handleWorkflowNodeUpdate(updated, {
        notifyScheduler: true
      })
    }
    return updated
  }

  retryNode(workflowRunNodeId: string): WorkflowRunNode | null {
    const updated = this.workflowRunService.retryNode(workflowRunNodeId)
    if (updated) {
      this.handleWorkflowNodeUpdate(updated, {
        notifyScheduler: true
      })
    }
    return updated
  }

  async stopRun(workflowRunId: string): Promise<WorkflowRun | null> {
    if (this.workflowSchedulerService) {
      await this.workflowSchedulerService.stopRun(workflowRunId)
      return this.workflowRunService.getRun(workflowRunId)
    }

    return this.workflowRunService.stopRun(workflowRunId)
  }

  markRunStarted(workflowRunId: string): WorkflowRun | null {
    return this.workflowRunService.startRun(workflowRunId)
  }

  markRunStopped(workflowRunId: string): WorkflowRun | null {
    return this.workflowRunService.stopRun(workflowRunId)
  }

  markNodeRunning(nodeId: string): WorkflowRunNode | null {
    const updated = this.workflowRunNodeRepo.markRunning(nodeId)
    if (updated) {
      this.handleWorkflowNodeUpdate(updated, {
        syncRunStatus: true
      })
      return updated
    }

    return null
  }

  syncRunStatus(workflowRunId: string): WorkflowRun | null {
    return this.workflowRunService.syncRunStatus(workflowRunId)
  }

  private handleWorkflowNodeUpdate(
    updated: WorkflowRunNode | null,
    options: {
      syncRunStatus?: boolean
      notifyScheduler?: boolean
    } = {}
  ): void {
    if (!updated) {
      return
    }

    if (options.syncRunStatus) {
      this.workflowRunService.syncRunStatus(updated.workflow_run_id)
    }

    const mapped = this.runtime.getTaskNode(updated.id)
    if (mapped) {
      this.runtime.notifyTaskNodeStatusChange(mapped)
    }

    if (options.notifyScheduler) {
      void this.workflowSchedulerService?.onNodeUpdated(updated.id)
    }
  }
}
