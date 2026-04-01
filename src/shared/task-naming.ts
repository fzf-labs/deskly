export const DEFAULT_WORKTREE_PREFIX = 'wt'
export const DEFAULT_BRANCH_PREFIX = 'feature'

const padDatePart = (value: number): string => String(value).padStart(2, '0')

export const normalizeWorktreePrefix = (value: string | null | undefined): string => {
  const trimmed = value?.trim().replace(/-+$/g, '') ?? ''
  return trimmed || DEFAULT_WORKTREE_PREFIX
}

export const normalizeBranchPrefix = (value: string | null | undefined): string => {
  const trimmed = value?.trim().replace(/\/+$/g, '') ?? ''
  return trimmed || DEFAULT_BRANCH_PREFIX
}

export const formatTaskTimestamp = (value: Date): string => {
  return [
    value.getFullYear(),
    padDatePart(value.getMonth() + 1),
    padDatePart(value.getDate())
  ].join('') + `-${padDatePart(value.getHours())}${padDatePart(value.getMinutes())}${padDatePart(value.getSeconds())}`
}

export interface TaskWorktreeNames {
  branchName: string
  worktreeDirName: string
}

export const buildTaskWorktreeNames = ({
  branchPrefix,
  worktreePrefix,
  timestamp,
  suffix
}: {
  branchPrefix?: string | null
  worktreePrefix?: string | null
  timestamp: string
  suffix?: string | number | null
}): TaskWorktreeNames => {
  const normalizedBranchPrefix = normalizeBranchPrefix(branchPrefix)
  const normalizedWorktreePrefix = normalizeWorktreePrefix(worktreePrefix)
  const suffixText =
    suffix === undefined || suffix === null || suffix === '' ? '' : `-${String(suffix)}`

  return {
    branchName: `${normalizedBranchPrefix}/${timestamp}${suffixText}`,
    worktreeDirName: `${normalizedWorktreePrefix}-${timestamp}${suffixText}`
  }
}
