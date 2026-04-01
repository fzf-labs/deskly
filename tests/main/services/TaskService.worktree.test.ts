import { mkdtempSync, mkdirSync, readlinkSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TaskService } from '../../../src/main/services/TaskService'

const tempRoots: string[] = []

const createTaskServiceDeps = () => {
  const db = {
    getDefaultAgentToolConfig: vi.fn(() => null),
    createTask: vi.fn((input) => ({
      ...input,
      status: 'todo',
      cost: null,
      duration: null,
      created_at: '2026-03-23T00:00:00.000Z',
      updated_at: '2026-03-23T00:00:00.000Z'
    })),
    getTask: vi.fn((taskId: string) => ({
      id: taskId,
      title: 'Worktree task',
      prompt: 'Prompt',
      status: 'todo',
      task_mode: 'conversation',
      project_id: 'project-1',
      worktree_path: null,
      branch_name: null,
      base_branch: null,
      workspace_path: null,
      started_at: null,
      completed_at: null,
      cost: null,
      duration: null,
      created_at: '2026-03-23T00:00:00.000Z',
      updated_at: '2026-03-23T00:00:00.000Z'
    })),
    createWorkflowRunForTask: vi.fn()
  }

  const settingsService = {
    getSettings: vi.fn(() => ({
      enabledCliTools: {
        'claude-code': true,
        codex: true,
        'cursor-agent': true,
        'gemini-cli': true,
        opencode: true
      }
    }))
  }

  return { db, settingsService }
}

describe('TaskService worktree dependency bootstrap', () => {
  afterEach(() => {
    vi.useRealTimers()
    while (tempRoots.length > 0) {
      const root = tempRoots.pop()
      if (root) {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  it('links node_modules from the source repo into a timestamped worktree', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 29, 23, 38, 31))

    const rootDir = mkdtempSync(join(tmpdir(), 'deskly-task-service-worktree-'))
    tempRoots.push(rootDir)

    const projectPath = join(rootDir, 'project')
    mkdirSync(join(projectPath, 'node_modules'), { recursive: true })
    writeFileSync(join(projectPath, 'node_modules', '.keep'), '')

    const { db, settingsService } = createTaskServiceDeps()
    let createdWorktreePath: string | null = null
    const git = {
      branchExists: vi.fn(async () => false),
      addWorktree: vi.fn(async (_repoPath: string, nextWorktreePath: string, branchName: string) => {
        createdWorktreePath = nextWorktreePath
        expect(branchName).toBe('feature/20260329-233831')
        mkdirSync(nextWorktreePath, { recursive: true })
      })
    }

    const service = new TaskService(db as never, git as never, settingsService as never)

    await service.createTask({
      title: 'Worktree task',
      prompt: 'Prompt',
      taskMode: 'conversation',
      projectId: 'project-1',
      projectPath,
      createWorktree: true,
      baseBranch: 'main',
      worktreePrefix: 'wt',
      branchPrefix: 'feature',
      worktreeRootPath: join(rootDir, 'worktrees'),
      cliToolId: 'codex'
    })

    expect(git.branchExists).toHaveBeenCalledWith(projectPath, 'feature/20260329-233831')
    expect(createdWorktreePath).toBe(join(rootDir, 'worktrees', 'project-1', 'wt-20260329-233831'))
    const linkedPath = join(createdWorktreePath!, 'node_modules')
    expect(readlinkSync(linkedPath)).toBe(join(projectPath, 'node_modules'))
  })

  it('appends a numeric suffix when the timestamped name already exists', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 29, 23, 38, 31))

    const rootDir = mkdtempSync(join(tmpdir(), 'deskly-task-service-worktree-'))
    tempRoots.push(rootDir)

    const projectPath = join(rootDir, 'project')
    mkdirSync(projectPath, { recursive: true })

    const { db, settingsService } = createTaskServiceDeps()
    const git = {
      branchExists: vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
      addWorktree: vi.fn(async (_repoPath: string, nextWorktreePath: string) => {
        mkdirSync(nextWorktreePath, { recursive: true })
      })
    }

    const service = new TaskService(db as never, git as never, settingsService as never)

    await service.createTask({
      title: 'Worktree task',
      prompt: 'Prompt',
      taskMode: 'conversation',
      projectId: 'project-1',
      projectPath,
      createWorktree: true,
      baseBranch: 'main',
      worktreePrefix: 'wt',
      branchPrefix: 'feature',
      worktreeRootPath: join(rootDir, 'worktrees'),
      cliToolId: 'codex'
    })

    expect(git.branchExists).toHaveBeenNthCalledWith(1, projectPath, 'feature/20260329-233831')
    expect(git.branchExists).toHaveBeenNthCalledWith(2, projectPath, 'feature/20260329-233831-1')
    expect(git.addWorktree).toHaveBeenCalledWith(
      projectPath,
      join(rootDir, 'worktrees', 'project-1', 'wt-20260329-233831-1'),
      'feature/20260329-233831-1',
      true,
      'main'
    )
  })
})
