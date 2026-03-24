import type { GenerateWorkflowDefinitionInput } from '../types/workflow-definition'

const WORKFLOW_NODE_PROPERTIES = {
  id: { type: 'string' },
  key: { type: 'string' },
  type: { type: 'string', enum: ['agent'] },
  name: { type: 'string' },
  prompt: { type: 'string' },
  cliToolId: { type: ['string', 'null'] },
  agentToolConfigId: { type: ['string', 'null'] },
  requiresApprovalAfterRun: { type: 'boolean' },
  position: {
    type: ['object', 'null'],
    additionalProperties: false,
    required: ['x', 'y'],
    properties: {
      x: { type: 'number' },
      y: { type: 'number' }
    }
  }
} as const

const WORKFLOW_GENERATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'description', 'definition'],
  properties: {
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    definition: {
      type: 'object',
      additionalProperties: false,
      required: ['version', 'nodes', 'edges'],
      properties: {
        version: { type: 'integer', enum: [1] },
        nodes: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: Object.keys(WORKFLOW_NODE_PROPERTIES),
            properties: WORKFLOW_NODE_PROPERTIES
          }
        },
        edges: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['from', 'to'],
            properties: {
              from: { type: 'string' },
              to: { type: 'string' }
            }
          }
        }
      }
    }
  }
} as const

export const getWorkflowGenerationSchemaString = (): string =>
  JSON.stringify(WORKFLOW_GENERATION_SCHEMA)

export const buildWorkflowGenerationPrompt = (input: GenerateWorkflowDefinitionInput): string => {
  const templateName = input.name?.trim()
  const goal = input.prompt.trim()

  return [
    'Generate a Deskly workflow DAG draft as strict JSON.',
    'Return JSON only. Do not wrap it in markdown. Do not explain your answer.',
    'The output must match the provided schema exactly.',
    'Requirements:',
    '- Build a realistic DAG, not just a linear checklist, when parallel work makes sense.',
    '- Use concise Chinese node names unless the user goal clearly requires another language.',
    '- Node type must always be "agent".',
    '- Every node must include a useful prompt.',
    '- Keep cliToolId and agentToolConfigId as null in the generated draft.',
    '- The graph must be acyclic.',
    '- Prefer 3 to 7 nodes for the first draft unless the goal clearly needs more or fewer.',
    '- Put human review or acceptance on the final important checkpoint when appropriate.',
    '- Provide rough left-to-right positions.',
    templateName ? `Template name: ${templateName}` : 'Template name: not provided',
    `Goal: ${goal}`
  ].join('\n')
}
