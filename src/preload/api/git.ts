import { IPC_CHANNELS } from '../../main/ipc/channels'
import { invoke } from './common'

export const gitApi = {
  git: {
    checkInstalled: (): Promise<unknown> => invoke(IPC_CHANNELS.git.checkInstalled),
    clone: (remoteUrl: string, targetPath: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.clone, remoteUrl, targetPath),
    init: (path: string): Promise<unknown> => invoke(IPC_CHANNELS.git.init, path),
    listWorktrees: (repoPath: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.listWorktrees, repoPath),
    addWorktree: (
      repoPath: string,
      worktreePath: string,
      branchName: string,
      createBranch: boolean,
      baseBranch?: string
    ): Promise<unknown> =>
      invoke(
        IPC_CHANNELS.git.addWorktree,
        repoPath,
        worktreePath,
        branchName,
        createBranch,
        baseBranch
      ),
    removeWorktree: (repoPath: string, worktreePath: string, force: boolean): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.removeWorktree, repoPath, worktreePath, force),
    pruneWorktrees: (repoPath: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.pruneWorktrees, repoPath),
    getDiff: (repoPath: string, filePath?: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.getDiff, repoPath, filePath),
    getStagedDiff: (repoPath: string, filePath?: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.getStagedDiff, repoPath, filePath),
    getBranches: (repoPath: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.getBranches, repoPath),
    getCurrentBranch: (repoPath: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.getCurrentBranch, repoPath),
    getChangedFiles: (repoPath: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.getChangedFiles, repoPath),
    getBranchDiffFiles: (
      repoPath: string,
      baseBranch: string,
      compareBranch?: string
    ): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.getBranchDiffFiles, repoPath, baseBranch, compareBranch),
    getBranchDiff: (
      repoPath: string,
      baseBranch: string,
      compareBranch?: string,
      filePath?: string
    ): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.getBranchDiff, repoPath, baseBranch, compareBranch, filePath),
    stageFiles: (repoPath: string, filePaths: string[]): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.stageFiles, repoPath, filePaths),
    unstageFiles: (repoPath: string, filePaths: string[]): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.unstageFiles, repoPath, filePaths),
    commit: (repoPath: string, message: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.commit, repoPath, message),
    mergeBranch: (repoPath: string, branchName: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.mergeBranch, repoPath, branchName),
    getConflictFiles: (repoPath: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.getConflictFiles, repoPath),
    abortMerge: (repoPath: string): Promise<unknown> => invoke(IPC_CHANNELS.git.abortMerge, repoPath),
    getConflictContent: (repoPath: string, filePath: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.getConflictContent, repoPath, filePath),
    resolveConflict: (
      repoPath: string,
      filePath: string,
      strategy: 'ours' | 'theirs'
    ): Promise<unknown> => invoke(IPC_CHANNELS.git.resolveConflict, repoPath, filePath, strategy),
    rebaseBranch: (repoPath: string, targetBranch: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.rebaseBranch, repoPath, targetBranch),
    rebaseContinue: (repoPath: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.rebaseContinue, repoPath),
    rebaseAbort: (repoPath: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.rebaseAbort, repoPath),
    rebaseSkip: (repoPath: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.rebaseSkip, repoPath),
    getRemoteUrl: (repoPath: string, remoteName?: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.getRemoteUrl, repoPath, remoteName),
    pushBranch: (
      repoPath: string,
      branchName: string,
      remoteName?: string,
      force?: boolean
    ): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.pushBranch, repoPath, branchName, remoteName, force),
    getCommitLog: (repoPath: string, limit?: number): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.getCommitLog, repoPath, limit),
    getParsedDiff: (repoPath: string, filePath?: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.getParsedDiff, repoPath, filePath),
    getParsedStagedDiff: (repoPath: string, filePath?: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.getParsedStagedDiff, repoPath, filePath),
    checkoutBranch: (repoPath: string, branchName: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.checkoutBranch, repoPath, branchName),
    createBranch: (repoPath: string, branchName: string): Promise<unknown> =>
      invoke(IPC_CHANNELS.git.createBranch, repoPath, branchName)
  }
}
