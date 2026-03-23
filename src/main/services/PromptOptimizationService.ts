import * as os from 'os'

import {
  buildPromptOptimizationPrompt,
  getPromptOptimizationSchemaString
} from './prompt-optimization-prompt'
import type { AgentCLIToolDetectorService } from './AgentCLIToolDetectorService'
import type { SettingsService } from './SettingsService'
import type { CliSessionService } from './cli/CliSessionService'
import { isCliToolEnabled } from '../../shared/agent-cli-tool-enablement'
import type {
  OptimizePromptInput,
  OptimizePromptResult
} from '../types/prompt-optimization'

type RecordLike = Record<string, unknown>
type SupportedPromptOptimizationTool = 'claude-code' | 'codex'
type ToolAvailabilityRank = {
  toolId: SupportedPromptOptimizationTool
  installed: boolean
  configState: 'unknown' | 'valid' | 'missing'
}
type PromptOptimizationRuntimeInput = OptimizePromptInput & {
  resolvedToolConfig?: Record<string, unknown> | null
}

const PROMPT_OPTIMIZATION_SYSTEM_PROMPT = [
  'You are a prompt optimization assistant for Deskly.',
  'Return JSON only and never wrap it in markdown.',
  'Do not use tools, do not inspect the filesystem, and do not ask follow-up questions.',
  'Improve clarity and execution quality without changing the user intent.'
].join(' ')

const PROMPT_OPTIMIZATION_TIMEOUT_MS = 30000
const PROMPT_OPTIMIZATION_CANDIDATE_TOOLS: SupportedPromptOptimizationTool[] = [
  'claude-code',
  'codex'
]

const isSupportedPromptOptimizationTool = (
  value: string | null | undefined
): value is SupportedPromptOptimizationTool => value === 'claude-code' || value === 'codex'

const isRecord = (value: unknown): value is RecordLike =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

const getNullableString = (value: unknown): string | null | undefined => {
  if (value === null) return null
  return getString(value)
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

  const item = isRecord(msg.item) ? msg.item : null
  if (item) {
    const itemDirect = pickCodexContent(item)
    if (itemDirect) return itemDirect
  }

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

const getCodexItem = (msg: RecordLike): RecordLike | null => {
  if (isRecord(msg.item)) {
    return msg.item
  }

  const params = isRecord(msg.params) ? msg.params : null
  if (params && isRecord(params.item)) {
    return params.item
  }

  const result = isRecord(msg.result) ? msg.result : null
  if (result && isRecord(result.item)) {
    return result.item
  }

  return null
}

const normalizeCodexType = (msg: RecordLike): string => {
  const params = isRecord(msg.params) ? msg.params : null
  const paramsEvent = params && isRecord(params.event) ? params.event : null
  const result = isRecord(msg.result) ? msg.result : null
  const item = getCodexItem(msg)

  return (
    (item ? getString(item.type) : undefined) ||
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

const extractCodexErrorMessage = (msg: RecordLike): string | undefined => {
  const direct = getString(msg.message)
  if (direct) return direct

  const errorRecord = isRecord(msg.error) ? msg.error : null
  const fromError = errorRecord ? getString(errorRecord.message) : undefined
  if (fromError) return fromError

  const result = isRecord(msg.result) ? msg.result : null
  if (result) {
    const resultDirect = getString(result.message)
    if (resultDirect) return resultDirect

    const nestedError = isRecord(result.error) ? result.error : null
    const nestedMessage = nestedError ? getString(nestedError.message) : undefined
    if (nestedMessage) return nestedMessage
  }

  return undefined
}

const extractCodexFailure = (stdout: string): string | null => {
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
    if (normalizedType !== 'error' && normalizedType !== 'turn.failed') {
      continue
    }

    const message = extractCodexErrorMessage(parsed)
    if (message) {
      return message
    }
  }

  return null
}

const extractStructuredCandidates = (
  toolId: SupportedPromptOptimizationTool,
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

const normalizeOptimizationResult = (value: unknown): OptimizePromptResult => {
  if (!isRecord(value)) {
    throw new Error('PROMPT_OPTIMIZATION_PARSE_FAILED')
  }

  const optimizedPrompt = getString(value.optimizedPrompt)
  if (!optimizedPrompt) {
    throw new Error('PROMPT_OPTIMIZATION_EMPTY_RESULT')
  }

  const warnings = Array.isArray(value.warnings)
    ? value.warnings
        .map((warning) => getString(warning))
        .filter((warning): warning is string => Boolean(warning))
    : []

  return {
    optimizedPrompt,
    summary: getNullableString(value.summary) ?? null,
    warnings
  }
}

export class PromptOptimizationService {
  private cliSessionService: CliSessionService | null = null
  private cliToolDetectorService: AgentCLIToolDetectorService | null = null
  private settingsService: SettingsService | null = null

  setCliRuntime(
    cliSessionService: CliSessionService,
    cliToolDetectorService: AgentCLIToolDetectorService,
    settingsService: SettingsService
  ): void {
    this.cliSessionService = cliSessionService
    this.cliToolDetectorService = cliToolDetectorService
    this.settingsService = settingsService
  }

  async optimizePrompt(
    input: PromptOptimizationRuntimeInput
  ): Promise<OptimizePromptResult> {
    const prompt = input.prompt.trim()
    if (!prompt) {
      throw new Error('Prompt optimization prompt is required')
    }

    const cliSessionService = this.cliSessionService
    if (!cliSessionService) {
      throw new Error('PROMPT_OPTIMIZATION_RUNTIME_UNAVAILABLE')
    }

    const normalizedInput = { ...input, prompt }
    const toolIds = await this.resolveOptimizationTools(normalizedInput)
    if (toolIds.length === 0) {
      throw new Error('CLI tool is disabled in Settings -> Agent CLI')
    }

    let lastError: Error | null = null

    for (const toolId of toolIds) {
      try {
        return await this.optimizePromptWithTool(toolId, normalizedInput)
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error(String(error || 'PROMPT_OPTIMIZATION_FAILED'))
      }
    }

    if (lastError) {
      throw lastError
    }

    throw new Error('PROMPT_OPTIMIZATION_FAILED')
  }

  private async optimizePromptWithTool(
    toolId: SupportedPromptOptimizationTool,
    input: PromptOptimizationRuntimeInput
  ): Promise<OptimizePromptResult> {
    const cliSessionService = this.cliSessionService
    if (!cliSessionService) {
      throw new Error('PROMPT_OPTIMIZATION_RUNTIME_UNAVAILABLE')
    }

    const result = await cliSessionService.runOneShotSession({
      toolId,
      workdir: os.homedir(),
      prompt: buildPromptOptimizationPrompt(input),
      timeoutMs: PROMPT_OPTIMIZATION_TIMEOUT_MS,
      toolConfig: this.buildToolConfig(toolId, input)
    })

    const candidates = extractStructuredCandidates(toolId, result.stdout)
    for (const candidate of candidates) {
      const jsonCandidate = extractJsonCandidate(candidate)
      if (!jsonCandidate) continue

      try {
        return normalizeOptimizationResult(JSON.parse(jsonCandidate) as unknown)
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message === 'PROMPT_OPTIMIZATION_EMPTY_RESULT' ||
            error.message === 'PROMPT_OPTIMIZATION_PARSE_FAILED')
        ) {
          continue
        }
      }
    }

    if (toolId === 'codex') {
      const codexFailure = extractCodexFailure(result.stdout)
      if (codexFailure) {
        throw new Error('PROMPT_OPTIMIZATION_FAILED')
      }
    }

    if (result.status === 'error' && !result.stdout.trim()) {
      throw new Error('PROMPT_OPTIMIZATION_FAILED')
    }

    if (!result.stdout.trim()) {
      throw new Error('PROMPT_OPTIMIZATION_NO_OUTPUT')
    }

    throw new Error('PROMPT_OPTIMIZATION_PARSE_FAILED')
  }

  private async resolveOptimizationTools(
    input: PromptOptimizationRuntimeInput
  ): Promise<SupportedPromptOptimizationTool[]> {
    const enabledCliTools = this.settingsService?.getSettings().enabledCliTools

    if (isSupportedPromptOptimizationTool(input.toolId)) {
      if (enabledCliTools && !isCliToolEnabled(input.toolId, enabledCliTools)) {
        throw new Error('CLI tool is disabled in Settings -> Agent CLI')
      }
      return [input.toolId]
    }

    if (!this.cliToolDetectorService) {
      return enabledCliTools
        ? PROMPT_OPTIMIZATION_CANDIDATE_TOOLS.filter((toolId) =>
            isCliToolEnabled(toolId, enabledCliTools)
          )
        : [...PROMPT_OPTIMIZATION_CANDIDATE_TOOLS]
    }

    const rankedTools: ToolAvailabilityRank[] = []

    for (const toolId of PROMPT_OPTIMIZATION_CANDIDATE_TOOLS) {
      if (enabledCliTools && !isCliToolEnabled(toolId, enabledCliTools)) {
        continue
      }

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

    throw new Error('PROMPT_OPTIMIZATION_CLI_UNAVAILABLE')
  }

  private buildToolConfig(
    toolId: SupportedPromptOptimizationTool,
    input: PromptOptimizationRuntimeInput
  ): Record<string, unknown> {
    const schema = getPromptOptimizationSchemaString()
    const selectedConfig = input.resolvedToolConfig ?? {}

    if (toolId === 'claude-code') {
      return {
        ...selectedConfig,
        system_prompt: PROMPT_OPTIMIZATION_SYSTEM_PROMPT,
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
