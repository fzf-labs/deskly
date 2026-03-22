import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { WorkflowDefinitionNodePosition, WorkflowDefinitionNodeType } from '@/data'
import type { useLanguage } from '@/providers/language-provider'
import type { MessageAttachment } from '@/hooks/useAgent'

export type LanguageStrings = ReturnType<typeof useLanguage>['t']

export type TaskMetaRow = {
  key: string
  icon: LucideIcon
  value: ReactNode
  visible: boolean
}

export type PipelineDisplayStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'failed'

export const filterVisibleMetaRows = (rows: TaskMetaRow[]) => rows.filter((row) => row.visible)

export type LocationState = {
  prompt?: string
  sessionId?: string
  attachments?: MessageAttachment[]
}

export type TaskNodeTemplate = {
  id: string
  template_id: string
  node_order: number
  name: string
  prompt: string
  requires_approval: boolean
  created_at: string
  updated_at: string
}

export type PipelineTemplate = {
  id: string
  name: string
  description: string | null
  scope: 'global' | 'project'
  project_id: string | null
  created_at: string
  updated_at: string
  nodes: TaskNodeTemplate[]
}

export type CLIToolInfo = {
  id: string
  name?: string
  displayName?: string
}

export type PipelineStatus = 'idle' | 'running' | 'waiting_approval' | 'failed' | 'completed'

export type ExecutionStatus = 'idle' | 'running' | 'stopped' | 'error'

export type WorkflowNode = {
  id: string
  node_order: number
  status: PipelineDisplayStatus
  name?: string
  prompt?: string
  session_id?: string | null
  cli_tool_id?: string | null
  agent_tool_config_id?: string | null
}

export type WorkflowCurrentNode = {
  id: string
  status: PipelineDisplayStatus
  index: number
}

export type WorkflowReviewNode = {
  id: string
  name: string
  status: PipelineDisplayStatus
}

export type WorkflowGraphNode = {
  id: string
  definitionId: string
  node_order: number
  status: PipelineDisplayStatus
  type: WorkflowDefinitionNodeType
  name: string
  prompt: string
  command?: string | null
  requiresApproval: boolean
  position: WorkflowDefinitionNodePosition
  isCurrent: boolean
}

export type WorkflowGraphEdge = {
  id: string
  source: string
  target: string
}

export type WorkflowGraph = {
  nodes: WorkflowGraphNode[]
  edges: WorkflowGraphEdge[]
}

export type CurrentNodeRuntime = {
  taskNodeId: string | null
  sessionId: string | null
  cliToolId: string | null
  agentToolConfigId: string | null
}
