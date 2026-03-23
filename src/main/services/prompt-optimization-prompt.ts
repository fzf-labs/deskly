import type {
  OptimizePromptInput,
  PromptOptimizationContextType
} from '../types/prompt-optimization'

const PROMPT_OPTIMIZATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['optimizedPrompt', 'summary', 'warnings'],
  properties: {
    optimizedPrompt: { type: 'string' },
    summary: { type: ['string', 'null'] },
    warnings: {
      type: 'array',
      items: { type: 'string' }
    }
  }
} as const

const CONTEXT_GUIDANCE: Record<PromptOptimizationContextType, string[]> = {
  task: [
    'This prompt will be used to create or update a coding task for an agent CLI.',
    'Make the prompt actionable, scoped, and outcome-oriented.',
    'Preserve the user intent and language.'
  ],
  'workflow-generation': [
    'This prompt will be used as the goal for generating a workflow DAG draft.',
    'Make the goal explicit about desired phases, deliverables, and quality gates.',
    'Preserve the user intent and language.'
  ],
  'workflow-node': [
    'This prompt will be used by a single workflow agent node.',
    'Make it focused on one stage, with clear inputs, outputs, and verification expectations.',
    'Preserve the user intent and language.'
  ],
  automation: [
    'This prompt will be used by a recurring automation task.',
    'Make it reliable, repeatable, and explicit about expected output.',
    'Preserve the user intent and language.'
  ]
}

export const getPromptOptimizationSchemaString = (): string =>
  JSON.stringify(PROMPT_OPTIMIZATION_SCHEMA)

export const buildPromptOptimizationPrompt = (input: OptimizePromptInput): string => {
  const contextLines = CONTEXT_GUIDANCE[input.contextType]
  const name = input.name?.trim()
  const targetCli = input.toolId?.trim()

  return [
    'Optimize the following prompt for Deskly as strict JSON.',
    'Return JSON only. Do not wrap it in markdown. Do not explain outside the schema.',
    'Do not change the core task or invent new requirements that alter the user intent.',
    'Keep the optimized prompt in the same language as the source unless the source explicitly asks otherwise.',
    'The optimized prompt should be clearer, more actionable, and better structured for an agent CLI.',
    'If the source prompt is already strong, make only small improvements.',
    'Requirements for the JSON fields:',
    '- optimizedPrompt: the rewritten prompt text only.',
    '- summary: one short sentence describing the main improvement, or null if unnecessary.',
    '- warnings: short caveats only when the source prompt is ambiguous or missing important detail.',
    'Context:',
    ...contextLines.map((line) => `- ${line}`),
    name ? `Name: ${name}` : 'Name: not provided',
    targetCli ? `Target CLI: ${targetCli}` : 'Target CLI: auto-select if needed',
    'Source prompt:',
    input.prompt.trim()
  ].join('\n')
}
