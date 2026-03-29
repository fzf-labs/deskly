import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { WorkflowDefinitionDocument } from '../../../src/shared/contracts/workflow'

const tempRoots: string[] = []

const createAgentNode = (
  id: string,
  key: string,
  name: string,
  x: number
): WorkflowDefinitionDocument['nodes'][number] => ({
  id,
  key,
  type: 'agent',
  name,
  prompt: `Execute ${name}`,
  requiresApprovalAfterRun: false,
  position: { x, y: 0 }
})

const createLinearWorkflowDefinition = (): WorkflowDefinitionDocument => ({
  version: 1,
  nodes: [
    createAgentNode('node-a', 'stage-a', 'Stage A', 0),
    createAgentNode('node-b', 'stage-b', 'Stage B', 240),
    createAgentNode('node-c', 'stage-c', 'Stage C', 480)
  ],
  edges: [
    { from: 'node-a', to: 'node-b' },
    { from: 'node-b', to: 'node-c' }
  ]
})

const createBranchingWorkflowDefinition = (): WorkflowDefinitionDocument => ({
  version: 1,
  nodes: [
    createAgentNode('node-a', 'stage-a', 'Stage A', 0),
    createAgentNode('node-b', 'stage-b', 'Stage B', 240),
    createAgentNode('node-c', 'stage-c', 'Stage C', 240)
  ],
  edges: [
    { from: 'node-a', to: 'node-b' },
    { from: 'node-a', to: 'node-c' }
  ]
})

const setupWorkflowRuntimeWithRealDatabase = async () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'deskly-workflow-stop-db-'))
  const dataDir = join(rootDir, 'data')
  const worktreesDir = join(rootDir, 'worktrees')
  mkdirSync(dataDir, { recursive: true })
  mkdirSync(worktreesDir, { recursive: true })
  tempRoots.push(rootDir)

  vi.resetModules()
  vi.doMock('../../../src/main/app/AppPaths', () => ({
    getAppPaths: () => ({
      getDatabaseFile: () => join(dataDir, 'deskly.db'),
      getWorktreesDir: () => worktreesDir,
      getTaskDataDir: (taskId: string, projectId?: string | null) =>
        join(rootDir, 'sessions', projectId?.trim() || 'project', taskId),
      getTaskMessagesFile: (taskId: string, projectId?: string | null) =>
        join(rootDir, 'sessions', projectId?.trim() || 'project', `${taskId}.jsonl`),
      getTaskNodeMessagesFile: (taskId: string, taskNodeId: string, projectId?: string | null) =>
        join(rootDir, 'sessions', projectId?.trim() || 'project', taskId, `${taskNodeId}.jsonl`)
    })
  }))

  const [{ DatabaseService }, { TaskService }, { TaskNodeRuntimeService }] = await Promise.all([
    import('../../../src/main/services/DatabaseService'),
    import('../../../src/main/services/TaskService'),
    import('../../../src/main/services/TaskNodeRuntimeService')
  ])

  let db
  try {
    db = new DatabaseService()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('NODE_MODULE_VERSION')) {
      rmSync(rootDir, { recursive: true, force: true })
      return null
    }
    throw error
  }

  const taskService = new TaskService(
    db,
    { addWorktree: vi.fn() } as never,
    {
      getSettings: () => ({
        enabledCliTools: {
          'claude-code': true,
          codex: true,
          'cursor-agent': true,
          'gemini-cli': true,
          opencode: true
        }
      })
    } as never
  )

  const taskNodeRuntimeService = new TaskNodeRuntimeService(
    db.getTaskRepository(),
    db.getWorkflowRunService(),
    db.getWorkflowRunNodeRepository()
  )

  return {
    db,
    taskService,
    taskNodeRuntimeService,
    workflowRunService: db.getWorkflowRunService(),
    workflowRunNodeRepo: db.getWorkflowRunNodeRepository()
  }
}

const getNodesByKey = (
  nodes: Array<{
    id: string
    node_key: string
    status: string
    failure_reason: string | null
  }>
) => new Map(nodes.map((node) => [node.node_key, node]))

describe('Workflow run stop status handling', () => {
  afterEach(() => {
    vi.resetModules()
    while (tempRoots.length > 0) {
      const root = tempRoots.pop()
      if (root) {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  it('keeps unstarted downstream nodes waiting when a running linear workflow is stopped', async () => {
    const setup = await setupWorkflowRuntimeWithRealDatabase()
    if (!setup) {
      return
    }

    const { db, taskService, taskNodeRuntimeService, workflowRunService, workflowRunNodeRepo } =
      setup

    try {
      const task = await taskService.createTask({
        title: 'Linear workflow task',
        prompt: 'Solve the issue',
        taskMode: 'workflow',
        workflowDefinition: createLinearWorkflowDefinition()
      })

      const run = db.getWorkflowRunByTask(task.id)
      expect(run).not.toBeNull()

      const initialNodes = db.listWorkflowRunNodes(run!.id)
      const initialByKey = getNodesByKey(initialNodes)
      const stageA = initialByKey.get('stage-a')
      const stageB = initialByKey.get('stage-b')
      const stageC = initialByKey.get('stage-c')

      expect(stageA).toBeTruthy()
      expect(stageB).toBeTruthy()
      expect(stageC).toBeTruthy()

      workflowRunNodeRepo.markRunning(stageA!.id)
      workflowRunNodeRepo.markDone(stageA!.id)
      workflowRunNodeRepo.markRunning(stageB!.id)
      workflowRunService.syncRunStatus(run!.id)

      workflowRunService.stopRun(run!.id)

      const updatedByKey = getNodesByKey(db.listWorkflowRunNodes(run!.id))
      expect(updatedByKey.get('stage-a')).toEqual(
        expect.objectContaining({
          status: 'done',
          failure_reason: null
        })
      )
      expect(updatedByKey.get('stage-b')).toEqual(
        expect.objectContaining({
          status: 'failed',
          failure_reason: 'cancelled'
        })
      )
      expect(updatedByKey.get('stage-c')).toEqual(
        expect.objectContaining({
          status: 'waiting',
          failure_reason: null
        })
      )

      const mappedNodes = new Map(
        taskNodeRuntimeService.getTaskNodes(task.id).map((node) => [node.name, node])
      )
      expect(mappedNodes.get('Stage B')?.status).toBe('failed')
      expect(mappedNodes.get('Stage C')?.status).toBe('todo')

      const currentNode = taskNodeRuntimeService.getCurrentTaskNode(task.id)
      expect(currentNode?.id).toBe(stageB!.id)
      expect(currentNode?.status).toBe('failed')

      expect(db.getWorkflowRun(run!.id)?.status).toBe('failed')
      expect(db.getTask(task.id)?.status).toBe('failed')
    } finally {
      db.close()
    }
  })

  it('does not mark unstarted sibling branches as failed when stopping a workflow', async () => {
    const setup = await setupWorkflowRuntimeWithRealDatabase()
    if (!setup) {
      return
    }

    const { db, taskService, taskNodeRuntimeService, workflowRunService, workflowRunNodeRepo } =
      setup

    try {
      const task = await taskService.createTask({
        title: 'Branching workflow task',
        prompt: 'Solve the issue',
        taskMode: 'workflow',
        workflowDefinition: createBranchingWorkflowDefinition()
      })

      const run = db.getWorkflowRunByTask(task.id)
      expect(run).not.toBeNull()

      const initialByKey = getNodesByKey(db.listWorkflowRunNodes(run!.id))
      const stageA = initialByKey.get('stage-a')
      const stageB = initialByKey.get('stage-b')
      const stageC = initialByKey.get('stage-c')

      workflowRunNodeRepo.markRunning(stageA!.id)
      workflowRunNodeRepo.markDone(stageA!.id)
      workflowRunNodeRepo.markRunning(stageB!.id)
      workflowRunService.syncRunStatus(run!.id)

      workflowRunService.stopRun(run!.id)

      const updatedByKey = getNodesByKey(db.listWorkflowRunNodes(run!.id))
      expect(updatedByKey.get('stage-b')).toEqual(
        expect.objectContaining({
          status: 'failed',
          failure_reason: 'cancelled'
        })
      )
      expect(updatedByKey.get('stage-c')).toEqual(
        expect.objectContaining({
          status: 'waiting',
          failure_reason: null
        })
      )

      const mappedNodes = new Map(
        taskNodeRuntimeService.getTaskNodes(task.id).map((node) => [node.name, node.status])
      )
      expect(mappedNodes.get('Stage B')).toBe('failed')
      expect(mappedNodes.get('Stage C')).toBe('todo')

      const currentNode = taskNodeRuntimeService.getCurrentTaskNode(task.id)
      expect(currentNode?.id).toBe(stageB!.id)
      expect(currentNode?.status).toBe('failed')
    } finally {
      db.close()
    }
  })

  it('resets only the stopped node on retry and keeps remaining nodes pending', async () => {
    const setup = await setupWorkflowRuntimeWithRealDatabase()
    if (!setup) {
      return
    }

    const { db, taskService, taskNodeRuntimeService, workflowRunService, workflowRunNodeRepo } =
      setup

    try {
      const task = await taskService.createTask({
        title: 'Retry workflow task',
        prompt: 'Solve the issue',
        taskMode: 'workflow',
        workflowDefinition: createLinearWorkflowDefinition()
      })

      const run = db.getWorkflowRunByTask(task.id)
      expect(run).not.toBeNull()

      const initialByKey = getNodesByKey(db.listWorkflowRunNodes(run!.id))
      const stageA = initialByKey.get('stage-a')
      const stageB = initialByKey.get('stage-b')

      workflowRunNodeRepo.markRunning(stageA!.id)
      workflowRunNodeRepo.markDone(stageA!.id)
      workflowRunNodeRepo.markRunning(stageB!.id)
      workflowRunService.syncRunStatus(run!.id)
      workflowRunService.stopRun(run!.id)

      workflowRunService.retryNode(stageB!.id)

      const updatedByKey = getNodesByKey(db.listWorkflowRunNodes(run!.id))
      expect(updatedByKey.get('stage-a')).toEqual(
        expect.objectContaining({
          status: 'done',
          failure_reason: null
        })
      )
      expect(updatedByKey.get('stage-b')).toEqual(
        expect.objectContaining({
          status: 'waiting',
          failure_reason: null
        })
      )
      expect(updatedByKey.get('stage-c')).toEqual(
        expect.objectContaining({
          status: 'waiting',
          failure_reason: null
        })
      )

      const mappedNodes = new Map(
        taskNodeRuntimeService.getTaskNodes(task.id).map((node) => [node.name, node.status])
      )
      expect(mappedNodes.get('Stage B')).toBe('todo')
      expect(mappedNodes.get('Stage C')).toBe('todo')

      const currentNode = taskNodeRuntimeService.getCurrentTaskNode(task.id)
      expect(currentNode?.id).toBe(stageB!.id)
      expect(currentNode?.status).toBe('todo')

      expect(db.getWorkflowRun(run!.id)?.status).toBe('running')
      expect(db.getTask(task.id)?.status).toBe('in_progress')
    } finally {
      db.close()
    }
  })
})
