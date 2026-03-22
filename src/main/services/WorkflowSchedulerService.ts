import { spawn } from 'child_process'
import { once } from 'events'
import { newUlid } from '../utils/ids'
import { MsgStoreService } from './MsgStoreService'
import { getWorkflowReadyNodeIds } from './workflow-graph'
import type { DatabaseService } from './DatabaseService'
import type { CliSessionService } from './cli/CliSessionService'
import type { WorkflowDefinitionDocument } from '../types/workflow-definition'
import type { WorkflowRunNode } from '../types/workflow-run'

export class WorkflowSchedulerService {
  private db: DatabaseService
  private cliSessionService: CliSessionService
  private schedulingRuns = new Set<string>()

  constructor(db: DatabaseService, cliSessionService: CliSessionService) {
    this.db = db
    this.cliSessionService = cliSessionService
  }

  init(): void {
    void this.reconcileRunningNodes()
  }

  async startRun(runId: string): Promise<void> {
    const run = this.db.getWorkflowRun(runId)
    if (!run) return

    this.db.markWorkflowRunStarted(runId)
    await this.scheduleRun(runId)
  }

  async stopRun(runId: string): Promise<void> {
    const nodes = this.db.listWorkflowRunNodes(runId)
    await Promise.allSettled(
      nodes
        .filter((node) => node.status === 'running' && node.session_id)
        .map(async (node) => {
          try {
            this.cliSessionService.stopSession(node.session_id!)
          } catch {
            // ignore stop errors and let persistence settle below
          }
        })
    )

    this.db.markWorkflowRunStopped(runId)
  }

  async onNodeUpdated(nodeId: string): Promise<void> {
    const workflowNode = this.db.getWorkflowRunNode(nodeId)
    if (!workflowNode) return
    await this.scheduleRun(workflowNode.workflow_run_id)
  }

  async reconcileRunningNodes(): Promise<void> {
    const nodes = this.db.listRunningWorkflowNodes()
    for (const node of nodes) {
      const hasRunningSession = node.session_id
        ? this.cliSessionService.getSession(node.session_id)?.status === 'running'
        : false

      if (!hasRunningSession) {
        this.db.markTaskNodeErrorReview(node.id, node.error_message || 'session_not_running_after_restart')
      }
    }
  }

  private async scheduleRun(runId: string): Promise<void> {
    if (this.schedulingRuns.has(runId)) return
    this.schedulingRuns.add(runId)

    try {
      let shouldContinue = true
      while (shouldContinue) {
        shouldContinue = false

        const run = this.db.getWorkflowRun(runId)
        if (!run || run.status === 'done' || run.status === 'failed') {
          return
        }

        const nodes = this.db.listWorkflowRunNodes(runId)
        const readyDefinitionNodeIds = getWorkflowReadyNodeIds(run.definition_snapshot, nodes)

        if (readyDefinitionNodeIds.length === 0) {
          this.db.syncWorkflowRunStatus(runId)
          return
        }

        const readyNodes = readyDefinitionNodeIds
          .map((definitionNodeId) =>
            nodes.find((node) => node.definition_node_id === definitionNodeId) ?? null
          )
          .filter((node): node is WorkflowRunNode => Boolean(node))

        await Promise.all(readyNodes.map((node) => this.startReadyNode(run.task_id, run.definition_snapshot, node)))

        shouldContinue = readyNodes.some((node) => node.node_type === 'command')
      }
    } finally {
      this.schedulingRuns.delete(runId)
    }
  }

  private async startReadyNode(
    taskId: string,
    definition: WorkflowDefinitionDocument,
    node: WorkflowRunNode
  ): Promise<void> {
    const startedNode = this.db.markWorkflowRunNodeRunning(node.id)
    if (!startedNode) return

    if (startedNode.node_type === 'command') {
      await this.executeCommandNode(taskId, startedNode)
      return
    }

    await this.executeAgentNode(taskId, definition, startedNode)
  }

  private async executeAgentNode(
    taskId: string,
    _definition: WorkflowDefinitionDocument,
    node: WorkflowRunNode
  ): Promise<void> {
    const task = this.db.getTask(taskId)
    if (!task) {
      this.db.markTaskNodeErrorReview(node.id, 'Task not found for workflow node')
      return
    }

    const workdir = task.workspace_path ?? task.worktree_path ?? ''
    if (!workdir) {
      this.db.markTaskNodeErrorReview(node.id, 'Workspace path is required for workflow execution')
      return
    }

    let toolId = node.cli_tool_id
    if (!toolId && node.agent_tool_config_id) {
      const config = this.db.getAgentToolConfig(node.agent_tool_config_id)
      toolId = config?.tool_id ?? null
    }

    if (!toolId) {
      this.db.markTaskNodeErrorReview(node.id, 'CLI tool is required for agent workflow node')
      return
    }

    const sessionId = newUlid()
    try {
      await this.cliSessionService.startSession(
        sessionId,
        toolId,
        workdir,
        node.prompt ?? '',
        undefined,
        undefined,
        task.project_id ?? null,
        taskId,
        node.agent_tool_config_id,
        node.id
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.db.markTaskNodeErrorReview(node.id, message)
    }
  }

  private async executeCommandNode(taskId: string, node: WorkflowRunNode): Promise<void> {
    const task = this.db.getTask(taskId)
    if (!task) {
      this.db.markTaskNodeErrorReview(node.id, 'Task not found for workflow node')
      return
    }

    const workdir = task.workspace_path ?? task.worktree_path ?? ''
    if (!workdir) {
      this.db.markTaskNodeErrorReview(node.id, 'Workspace path is required for command workflow node')
      return
    }

    const command = node.command?.trim()
    if (!command) {
      this.db.markTaskNodeErrorReview(node.id, 'Command is required for command workflow node')
      return
    }

    const sessionId = `cmd-${newUlid()}`
    this.db.updateTaskNodeSession(node.id, sessionId)

    const msgStore = new MsgStoreService(undefined, taskId, sessionId, task.project_id ?? null, node.id)
    msgStore.push({
      type: 'stdout',
      content: `$ ${command}`,
      task_id: taskId,
      task_node_id: node.id,
      session_id: sessionId
    })

    const startedAt = Date.now()
    const child = spawn(command, {
      cwd: workdir,
      shell: true,
      env: process.env
    })

    child.stdout.on('data', (chunk: Buffer | string) => {
      msgStore.push({
        type: 'stdout',
        content: chunk.toString(),
        task_id: taskId,
        task_node_id: node.id,
        session_id: sessionId
      })
    })

    child.stderr.on('data', (chunk: Buffer | string) => {
      msgStore.push({
        type: 'stderr',
        content: chunk.toString(),
        task_id: taskId,
        task_node_id: node.id,
        session_id: sessionId
      })
    })

    let errorMessage: string | null = null
    child.on('error', (error) => {
      errorMessage = error.message
    })

    const [code] = (await once(child, 'close')) as [number | null]
    const duration = (Date.now() - startedAt) / 1000

    if (errorMessage || code !== 0) {
      this.db.markTaskNodeErrorReview(
        node.id,
        errorMessage ?? `Command exited with code ${code ?? 'unknown'}`
      )
      this.db.updateTaskNodeSession(node.id, sessionId)
      return
    }

    this.db.completeTaskNode(node.id, {
      resultSummary: `Command completed successfully: ${command}`,
      duration,
      sessionId
    })
  }
}
