export type PromptOptimizationContextType =
  | 'task'
  | 'workflow-generation'
  | 'workflow-node'
  | 'automation'

export interface OptimizePromptInput {
  prompt: string
  contextType: PromptOptimizationContextType
  name?: string | null
  toolId?: string | null
  agentToolConfigId?: string | null
}

export interface OptimizePromptResult {
  optimizedPrompt: string
  summary: string | null
  warnings: string[]
}
