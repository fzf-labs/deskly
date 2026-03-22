import { newUlid } from '../utils/ids'
import type {
  GenerateWorkflowDefinitionInput,
  GeneratedWorkflowDefinitionResult,
  WorkflowDefinitionDocument,
  WorkflowDefinitionNode
} from '../types/workflow-definition'

type DraftWorkflowStep = {
  name: string
  type: 'agent' | 'command'
  prompt?: string | null
  command?: string | null
  requiresApprovalAfterRun: boolean
}

const DEFAULT_AGENT_STEPS: DraftWorkflowStep[] = [
  {
    name: 'Analyze task',
    type: 'agent',
    prompt: 'Understand the goal, inspect the relevant context, and identify a safe execution plan.',
    requiresApprovalAfterRun: false
  },
  {
    name: 'Execute work',
    type: 'agent',
    prompt: 'Complete the requested work and produce the expected output.',
    requiresApprovalAfterRun: false
  },
  {
    name: 'Verify result',
    type: 'agent',
    prompt: 'Review the result, check for gaps, and summarize the outcome clearly.',
    requiresApprovalAfterRun: true
  }
]

const splitPromptIntoSteps = (prompt: string): string[] => {
  const normalized = prompt
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const explicitSteps = normalized
    .map((line) => line.replace(/^(?:[-*•]|\d+[.)]|[一二三四五六七八九十]+[、.])\s*/, '').trim())
    .filter(Boolean)

  if (explicitSteps.length >= 2) {
    return explicitSteps
  }

  const sentenceParts = prompt
    .split(/(?:\n+|(?:\s*(?:->|=>|then|and then|after that|finally|然后|接着|最后|之后)\s*))/i)
    .map((part) => part.trim().replace(/^[,;，；]\s*/, ''))
    .filter((part) => part.length > 0)

  return sentenceParts.length >= 2 ? sentenceParts : []
}

const guessNodeName = (step: string, index: number): string => {
  const cleaned = step
    .replace(/[`"'“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) {
    return `Step ${index + 1}`
  }

  return cleaned.length > 48 ? `${cleaned.slice(0, 45).trimEnd()}...` : cleaned
}

const detectCommand = (step: string): string | null => {
  const quotedCommand = step.match(/`([^`]+)`/)
  if (quotedCommand?.[1]?.trim()) {
    return quotedCommand[1].trim()
  }

  const explicitCommand = step.match(
    /(?:^|\b)(?:run|execute|command|shell|执行|运行命令)\s*[:：]?\s+(.+)$/i
  )
  if (explicitCommand?.[1]?.trim()) {
    return explicitCommand[1].trim()
  }

  return null
}

const shouldRequireReview = (step: string, index: number, total: number): boolean => {
  if (index === total - 1) {
    return true
  }

  return /(review|verify|approval|approve|confirm|check|验收|验证|复核|确认|检查)/i.test(step)
}

const buildDraftSteps = (input: GenerateWorkflowDefinitionInput): DraftWorkflowStep[] => {
  const extractedSteps = splitPromptIntoSteps(input.prompt)
  if (extractedSteps.length === 0) {
    return DEFAULT_AGENT_STEPS
  }

  return extractedSteps.map((step, index) => {
    const command = detectCommand(step)
    const type = command ? 'command' : 'agent'

    return {
      name: guessNodeName(step, index),
      type,
      prompt: type === 'agent' ? step : `Complete this step: ${step}`,
      command: type === 'command' ? command : null,
      requiresApprovalAfterRun: shouldRequireReview(step, index, extractedSteps.length)
    }
  })
}

const buildNode = (step: DraftWorkflowStep, index: number): WorkflowDefinitionNode => ({
  id: newUlid(),
  key: `generated-node-${index + 1}`,
  type: step.type,
  name: step.name,
  prompt: step.type === 'agent' ? step.prompt ?? '' : null,
  command: step.type === 'command' ? step.command ?? '' : null,
  cliToolId: null,
  agentToolConfigId: null,
  requiresApprovalAfterRun: step.requiresApprovalAfterRun,
  position: {
    x: index * 280,
    y: 0
  }
})

const buildDefinition = (steps: DraftWorkflowStep[]): WorkflowDefinitionDocument => {
  const nodes = steps.map((step, index) => buildNode(step, index))

  return {
    version: 1,
    nodes,
    edges: nodes.slice(1).map((node, index) => ({
      from: nodes[index]!.id,
      to: node.id
    }))
  }
}

const buildSuggestedName = (input: GenerateWorkflowDefinitionInput): string => {
  const preferred = input.name?.trim()
  if (preferred) {
    return preferred
  }

  const firstLine = input.prompt
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstLine) {
    return 'Generated workflow'
  }

  return firstLine.length > 48 ? `${firstLine.slice(0, 45).trimEnd()}...` : firstLine
}

export class WorkflowDefinitionGenerationService {
  generateDefinition(input: GenerateWorkflowDefinitionInput): GeneratedWorkflowDefinitionResult {
    const prompt = input.prompt.trim()
    if (!prompt) {
      throw new Error('Workflow generation prompt is required')
    }

    const steps = buildDraftSteps({ ...input, prompt })

    return {
      name: buildSuggestedName(input),
      description: 'Generated from a natural-language workflow prompt.',
      definition: buildDefinition(steps)
    }
  }
}
