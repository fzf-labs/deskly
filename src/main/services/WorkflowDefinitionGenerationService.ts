import * as os from 'os'

import {
  buildWorkflowGenerationPrompt,
  getWorkflowGenerationSchemaString
} from './workflow-generation-prompt'
import type { CLIToolDetectorService } from './CLIToolDetectorService'
import type { WorkflowDefinitionService } from './WorkflowDefinitionService'
import type { CliSessionService } from './cli/CliSessionService'
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

type RecordLike = Record<string, unknown>
type SupportedWorkflowGenerationTool = 'claude-code' | 'codex'
type ToolAvailabilityRank = {
  toolId: SupportedWorkflowGenerationTool
  installed: boolean
  configState: 'unknown' | 'valid' | 'missing'
}
type WorkflowGenerationRuntimeInput = GenerateWorkflowDefinitionInput & {
  resolvedToolConfig?: Record<string, unknown> | null
}

const DEFAULT_AGENT_STEPS: DraftWorkflowStep[] = [
  {
    name: 'Analyze task',
    type: 'agent',
    prompt:
      'Understand the goal, inspect the relevant context, and identify a safe execution plan.',
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

const WORKFLOW_GENERATION_SYSTEM_PROMPT = [
  'You are a workflow DAG generator for Deskly.',
  'Return JSON only and never wrap it in markdown.',
  'Do not use tools, do not inspect the filesystem, and do not ask follow-up questions.',
  'Produce a clean editable draft that matches the provided schema exactly.'
].join(' ')

const WORKFLOW_GENERATION_TIMEOUT_MS = 45000
const WORKFLOW_GENERATION_CANDIDATE_TOOLS: SupportedWorkflowGenerationTool[] = [
  'claude-code',
  'codex'
]

const isSupportedWorkflowGenerationTool = (
  value: string | null | undefined
): value is SupportedWorkflowGenerationTool => value === 'claude-code' || value === 'codex'

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

const buildRuleNode = (step: DraftWorkflowStep, index: number): WorkflowDefinitionNode => ({
  id: newUlid(),
  key: `generated-node-${index + 1}`,
  type: step.type,
  name: step.name,
  prompt: step.type === 'agent' ? (step.prompt ?? '') : null,
  command: step.type === 'command' ? (step.command ?? '') : null,
  cliToolId: null,
  agentToolConfigId: null,
  requiresApprovalAfterRun: step.requiresApprovalAfterRun,
  position: {
    x: index * 280,
    y: 0
  }
})

const buildRuleDefinition = (steps: DraftWorkflowStep[]): WorkflowDefinitionDocument => {
  const nodes = steps.map((step, index) => buildRuleNode(step, index))

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

const isRecord = (value: unknown): value is RecordLike =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

const getNullableString = (value: unknown): string | null | undefined => {
  if (value === null) return null
  return getString(value)
}

const slugifyWorkflowKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const normalizePosition = (value: unknown, index: number): WorkflowDefinitionNode['position'] => {
  if (!isRecord(value)) {
    return { x: index * 320, y: 0 }
  }

  const x = typeof value.x === 'number' && Number.isFinite(value.x) ? value.x : index * 320
  const y = typeof value.y === 'number' && Number.isFinite(value.y) ? value.y : 0
  return { x, y }
}

const normalizeDefinitionDocument = (value: unknown): WorkflowDefinitionDocument => {
  if (!isRecord(value)) {
    throw new Error('WORKFLOW_AI_GENERATION_INVALID_DOCUMENT')
  }

  const rawNodes = Array.isArray(value.nodes) ? value.nodes : null
  const rawEdges = Array.isArray(value.edges) ? value.edges : null
  if (!rawNodes || rawNodes.length === 0 || !rawEdges) {
    throw new Error('WORKFLOW_AI_GENERATION_INVALID_DOCUMENT')
  }

  const nodes = rawNodes.map((rawNode, index) => {
    if (!isRecord(rawNode)) {
      throw new Error('WORKFLOW_AI_GENERATION_INVALID_DOCUMENT')
    }

    let type: WorkflowDefinitionNode['type'] =
      getString(rawNode.type) === 'command' ? 'command' : 'agent'
    let prompt = getNullableString(rawNode.prompt) ?? null
    let command = getNullableString(rawNode.command) ?? null

    if (type === 'command' && !command && prompt) {
      type = 'agent'
    }
    if (type === 'agent' && !prompt && command) {
      type = 'command'
    }

    const name = getString(rawNode.name) ?? `步骤 ${index + 1}`
    const key =
      (getString(rawNode.key) ?? slugifyWorkflowKey(name)) || `generated-node-${index + 1}`

    return {
      id: getString(rawNode.id) ?? newUlid(),
      key,
      type,
      name,
      prompt: type === 'agent' ? (prompt ?? `完成步骤：${name}`) : null,
      command: type === 'command' ? command : null,
      cliToolId: null,
      agentToolConfigId: null,
      requiresApprovalAfterRun: Boolean(rawNode.requiresApprovalAfterRun),
      position: normalizePosition(rawNode.position, index)
    } satisfies WorkflowDefinitionNode
  })

  const edges = rawEdges
    .map((rawEdge) => {
      if (!isRecord(rawEdge)) {
        return null
      }
      const from = getString(rawEdge.from)
      const to = getString(rawEdge.to)
      if (!from || !to) {
        return null
      }
      return { from, to }
    })
    .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge))

  return {
    version: 1,
    nodes,
    edges
  }
}

const normalizeGeneratedResult = (
  value: unknown,
  input: GenerateWorkflowDefinitionInput
): GeneratedWorkflowDefinitionResult => {
  if (!isRecord(value)) {
    throw new Error('WORKFLOW_AI_GENERATION_PARSE_FAILED')
  }

  return {
    name: getString(value.name) ?? buildSuggestedName(input),
    description: getNullableString(value.description) ?? 'Generated from an AI workflow prompt.',
    definition: normalizeDefinitionDocument(value.definition)
  }
}

const extractJsonCandidate = (text: string): string | null => {
  const trimmed = text.trim()
  if (!trimmed) return null

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]?.trim()) {
    return fencedMatch[1].trim()
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim()
  }

  return null
}

const extractClaudeAssistantTexts = (stdout: string): string[] => {
  const texts: string[] = []

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      continue
    }

    if (!isRecord(parsed) || getString(parsed.type) !== 'assistant') {
      continue
    }

    const message = isRecord(parsed.message) ? parsed.message : null
    const content = message?.content
    if (Array.isArray(content)) {
      const text = content
        .map((item) => {
          if (!isRecord(item) || getString(item.type) !== 'text') return null
          return getString(item.text) ?? null
        })
        .filter((item): item is string => Boolean(item))
        .join('\n')
        .trim()

      if (text) {
        texts.push(text)
      }
      continue
    }

    const fallback = getString(parsed.content)
    if (fallback) {
      texts.push(fallback)
    }
  }

  return texts
}

const pickCodexContent = (record: RecordLike): string | undefined => {
  const direct = getString(record.message) || getString(record.text) || getString(record.delta)
  if (direct) return direct
  if (typeof record.content === 'string' && record.content.trim()) {
    return record.content.trim()
  }
  return undefined
}

const extractCodexContent = (msg: RecordLike): string | undefined => {
  const direct = pickCodexContent(msg)
  if (direct) return direct

  const params = isRecord(msg.params) ? msg.params : null
  if (params) {
    const paramsDirect = pickCodexContent(params)
    if (paramsDirect) return paramsDirect

    const paramsEvent = isRecord(params.event) ? params.event : null
    if (paramsEvent) {
      const eventDirect = pickCodexContent(paramsEvent)
      if (eventDirect) return eventDirect
    }
  }

  const result = isRecord(msg.result) ? msg.result : null
  if (result) {
    const resultDirect = pickCodexContent(result)
    if (resultDirect) return resultDirect
  }

  return undefined
}

const normalizeCodexType = (msg: RecordLike): string => {
  const params = isRecord(msg.params) ? msg.params : null
  const paramsEvent = params && isRecord(params.event) ? params.event : null
  const result = isRecord(msg.result) ? msg.result : null

  return (
    getString(msg.event) ||
    getString(msg.method) ||
    getString(msg.type) ||
    (paramsEvent ? getString(paramsEvent.type) : undefined) ||
    (params ? getString(params.type) : undefined) ||
    (result ? getString(result.type) : undefined) ||
    ''
  ).toLowerCase()
}

const extractCodexAssistantTexts = (stdout: string): string[] => {
  const texts: string[] = []

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      continue
    }

    if (!isRecord(parsed)) continue

    const normalizedType = normalizeCodexType(parsed)
    const content = extractCodexContent(parsed)
    if (!content) continue

    if (
      normalizedType === 'agent_message' ||
      normalizedType === 'assistant_message' ||
      normalizedType === 'message' ||
      normalizedType === 'response'
    ) {
      texts.push(content)
    }
  }

  return texts
}

const extractStructuredCandidates = (
  toolId: SupportedWorkflowGenerationTool,
  stdout: string
): string[] => {
  const collected =
    toolId === 'claude-code'
      ? extractClaudeAssistantTexts(stdout)
      : extractCodexAssistantTexts(stdout)

  return [...collected, stdout]
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
}

export class WorkflowDefinitionGenerationService {
  private cliSessionService: CliSessionService | null = null
  private cliToolDetectorService: CLIToolDetectorService | null = null
  private workflowDefinitionService: WorkflowDefinitionService | null = null

  setCliRuntime(
    cliSessionService: CliSessionService,
    cliToolDetectorService: CLIToolDetectorService,
    workflowDefinitionService: WorkflowDefinitionService
  ): void {
    this.cliSessionService = cliSessionService
    this.cliToolDetectorService = cliToolDetectorService
    this.workflowDefinitionService = workflowDefinitionService
  }

  async generateDefinition(
    input: WorkflowGenerationRuntimeInput
  ): Promise<GeneratedWorkflowDefinitionResult> {
    const prompt = input.prompt.trim()
    if (!prompt) {
      throw new Error('Workflow generation prompt is required')
    }

    const normalizedInput = { ...input, prompt }

    if (normalizedInput.mode === 'rules') {
      return this.generateRuleDefinition(normalizedInput)
    }

    return await this.generateAiDefinition(normalizedInput)
  }

  private generateRuleDefinition(
    input: WorkflowGenerationRuntimeInput
  ): GeneratedWorkflowDefinitionResult {
    const steps = buildDraftSteps(input)

    return {
      name: buildSuggestedName(input),
      description: 'Generated from a natural-language workflow prompt.',
      definition: buildRuleDefinition(steps)
    }
  }

  private async generateAiDefinition(
    input: WorkflowGenerationRuntimeInput
  ): Promise<GeneratedWorkflowDefinitionResult> {
    const cliSessionService = this.cliSessionService
    const workflowDefinitionService = this.workflowDefinitionService

    if (!cliSessionService || !workflowDefinitionService) {
      throw new Error('WORKFLOW_AI_GENERATION_RUNTIME_UNAVAILABLE')
    }

    const toolIds = await this.resolveGenerationTools(input)
    let lastError: Error | null = null

    for (const toolId of toolIds) {
      try {
        const generated = await this.generateAiDefinitionWithTool(toolId, input)
        return generated
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error(String(error || 'WORKFLOW_AI_GENERATION_FAILED'))
      }
    }

    if (lastError) {
      throw lastError
    }

    throw new Error('WORKFLOW_AI_GENERATION_FAILED')
  }

  private async generateAiDefinitionWithTool(
    toolId: SupportedWorkflowGenerationTool,
    input: WorkflowGenerationRuntimeInput
  ): Promise<GeneratedWorkflowDefinitionResult> {
    const cliSessionService = this.cliSessionService
    const workflowDefinitionService = this.workflowDefinitionService

    if (!cliSessionService || !workflowDefinitionService) {
      throw new Error('WORKFLOW_AI_GENERATION_RUNTIME_UNAVAILABLE')
    }

    const toolConfig = this.buildToolConfig(toolId, input)
    const result = await cliSessionService.runOneShotSession({
      toolId,
      workdir: os.homedir(),
      prompt: buildWorkflowGenerationPrompt(input),
      timeoutMs: WORKFLOW_GENERATION_TIMEOUT_MS,
      toolConfig
    })

    const candidates = extractStructuredCandidates(toolId, result.stdout)
    for (const candidate of candidates) {
      const jsonCandidate = extractJsonCandidate(candidate)
      if (!jsonCandidate) continue

      try {
        const parsed = JSON.parse(jsonCandidate) as unknown
        const normalized = normalizeGeneratedResult(parsed, input)
        workflowDefinitionService.validateDefinitionDocument(normalized.definition)
        if (normalized.definition.nodes.length > 1 && normalized.definition.edges.length === 0) {
          throw new Error('WORKFLOW_AI_GENERATION_INVALID_DOCUMENT')
        }
        return normalized
      } catch (error) {
        if (error instanceof Error && error.message === 'WORKFLOW_AI_GENERATION_INVALID_DOCUMENT') {
          throw error
        }
        continue
      }
    }

    if (result.status === 'error' && !result.stdout.trim()) {
      throw new Error('WORKFLOW_AI_GENERATION_FAILED')
    }

    if (!result.stdout.trim()) {
      throw new Error('WORKFLOW_AI_GENERATION_NO_OUTPUT')
    }

    throw new Error('WORKFLOW_AI_GENERATION_PARSE_FAILED')
  }

  private async resolveGenerationTools(
    input: WorkflowGenerationRuntimeInput
  ): Promise<SupportedWorkflowGenerationTool[]> {
    if (isSupportedWorkflowGenerationTool(input.toolId)) {
      return [input.toolId]
    }

    if (!this.cliToolDetectorService) {
      return [...WORKFLOW_GENERATION_CANDIDATE_TOOLS]
    }

    const rankedTools: ToolAvailabilityRank[] = []

    for (const toolId of WORKFLOW_GENERATION_CANDIDATE_TOOLS) {
      const detected = await this.cliToolDetectorService.detectTool(toolId, { level: 'fast' })
      rankedTools.push({
        toolId,
        installed: Boolean(detected?.installed),
        configState: detected?.configState ?? 'unknown'
      })
    }

    const available = rankedTools
      .filter((tool) => tool.installed)
      .sort((left, right) => {
        const rank = (value: ToolAvailabilityRank['configState']) => {
          if (value === 'valid') return 2
          if (value === 'unknown') return 1
          return 0
        }

        return rank(right.configState) - rank(left.configState)
      })
      .map((tool) => tool.toolId)

    if (available.length > 0) {
      return available
    }

    throw new Error('WORKFLOW_AI_CLI_UNAVAILABLE')
  }

  private buildToolConfig(
    toolId: SupportedWorkflowGenerationTool,
    input: WorkflowGenerationRuntimeInput
  ): Record<string, unknown> {
    const schema = getWorkflowGenerationSchemaString()
    const selectedConfig = input.resolvedToolConfig ?? {}

    if (toolId === 'claude-code') {
      return {
        ...selectedConfig,
        system_prompt: WORKFLOW_GENERATION_SYSTEM_PROMPT,
        json_schema: schema,
        permission_mode: 'plan'
      }
    }

    return {
      ...selectedConfig,
      output_schema: schema,
      skip_git_repo_check: true,
      sandbox: 'read-only',
      ask_for_approval: 'never',
      color: 'never'
    }
  }
}
