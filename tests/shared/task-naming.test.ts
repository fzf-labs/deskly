import { describe, expect, it } from 'vitest'

import {
  buildTaskWorktreeNames,
  formatTaskTimestamp,
  normalizeBranchPrefix,
  normalizeWorktreePrefix
} from '../../src/shared/task-naming'

describe('task naming helpers', () => {
  it('normalizes worktree and branch prefixes before composing names', () => {
    expect(normalizeWorktreePrefix('wt-')).toBe('wt')
    expect(normalizeBranchPrefix('feature/')).toBe('feature')
    expect(
      buildTaskWorktreeNames({
        worktreePrefix: 'wt-',
        branchPrefix: 'feature/',
        timestamp: '20260329-233831'
      })
    ).toEqual({
      branchName: 'feature/20260329-233831',
      worktreeDirName: 'wt-20260329-233831'
    })
  })

  it('formats timestamps and appends suffixes consistently', () => {
    expect(formatTaskTimestamp(new Date(2026, 2, 29, 23, 38, 31))).toBe('20260329-233831')
    expect(
      buildTaskWorktreeNames({
        worktreePrefix: 'wt',
        branchPrefix: 'feature',
        timestamp: '20260329-233831',
        suffix: 1
      })
    ).toEqual({
      branchName: 'feature/20260329-233831-1',
      worktreeDirName: 'wt-20260329-233831-1'
    })
  })
})
