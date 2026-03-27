export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'failed'
export type TaskMode = 'conversation' | 'workflow'

export interface DbTask {
  id: string
  title: string
  prompt: string
  status: TaskStatus
  task_mode: TaskMode
  project_id: string | null
  worktree_path: string | null
  branch_name: string | null
  base_branch: string | null
  workspace_path: string | null
  started_at: string | null
  completed_at: string | null
  cost: number | null
  duration: number | null
  created_at: string
  updated_at: string
}

export interface CreateTaskInput {
  id: string
  title: string
  prompt: string
  task_mode?: TaskMode
  project_id?: string | null
  worktree_path?: string | null
  branch_name?: string | null
  base_branch?: string | null
  workspace_path?: string | null
}

export interface UpdateTaskInput {
  title?: string
  prompt?: string
  status?: TaskStatus
  task_mode?: TaskMode
  worktree_path?: string | null
  branch_name?: string | null
  base_branch?: string | null
  workspace_path?: string | null
  started_at?: string | null
  completed_at?: string | null
  cost?: number | null
  duration?: number | null
}

export type TaskNodeStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'failed'

export interface DbTaskNode {
  id: string
  task_id: string
  node_order: number
  name: string
  prompt: string
  cli_tool_id: string | null
  agent_tool_config_id: string | null
  requires_approval: number
  status: TaskNodeStatus
  session_id: string | null
  resume_session_id: string | null
  result_summary: string | null
  error_message: string | null
  cost: number | null
  duration: number | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateTaskNodeInput {
  id?: string
  task_id: string
  node_order: number
  name: string
  prompt: string
  cli_tool_id?: string | null
  agent_tool_config_id?: string | null
  requires_approval?: boolean
}

export interface CompleteTaskNodeInput {
  node_id: string
  status: Extract<TaskNodeStatus, 'done' | 'in_review'>
  result_summary?: string | null
  error_message?: string | null
  cost?: number | null
  duration?: number | null
}

export interface UpdateCurrentTaskNodeRuntimeInput {
  session_id?: string | null
  resume_session_id?: string | null
  cli_tool_id?: string | null
  agent_tool_config_id?: string | null
}

export interface CompleteTaskNodeResultInput {
  resultSummary?: string | null
  cost?: number | null
  duration?: number | null
  sessionId?: string | null
  allowConversationCompletion?: boolean
}

export interface TaskNodeEventPayload {
  id: string
  name?: string
  taskId: string
}

export interface CreateTaskOptions {
  title: string
  prompt: string
  taskMode: TaskMode
  projectId?: string
  projectPath?: string
  createWorktree?: boolean
  baseBranch?: string
  worktreeBranchPrefix?: string
  worktreeRootPath?: string
  cliToolId?: string
  agentToolConfigId?: string
  workflowDefinitionId?: string
  workflowDefinition?: import('./workflow').WorkflowDefinitionDocument
}

export interface TaskWithWorktree {
  id: string
  title: string
  prompt: string
  status: TaskStatus
  taskMode: TaskMode
  projectId: string | null
  worktreePath: string | null
  branchName: string | null
  baseBranch: string | null
  workspacePath: string | null
  startedAt: string | null
  completedAt: string | null
  cost: number | null
  duration: number | null
  createdAt: string
  updatedAt: string
}
