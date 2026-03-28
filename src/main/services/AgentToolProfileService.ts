import { AgentToolConfigRepository } from './database/AgentToolConfigRepository'
import type {
  CreateAgentToolConfigInput,
  DbAgentToolConfig,
  UpdateAgentToolConfigInput
} from '../types/db/agent-tool-config'

export class AgentToolProfileService {
  private agentToolConfigRepo: AgentToolConfigRepository

  constructor(agentToolConfigRepo: AgentToolConfigRepository) {
    this.agentToolConfigRepo = agentToolConfigRepo
  }

  list(toolId?: string): DbAgentToolConfig[] {
    return this.agentToolConfigRepo.list(toolId)
  }

  get(id: string): DbAgentToolConfig | null {
    return this.agentToolConfigRepo.get(id)
  }

  getDefault(toolId: string): DbAgentToolConfig | null {
    return this.agentToolConfigRepo.getDefault(toolId)
  }

  create(input: CreateAgentToolConfigInput): DbAgentToolConfig {
    return this.agentToolConfigRepo.create(input)
  }

  update(id: string, updates: UpdateAgentToolConfigInput): DbAgentToolConfig | null {
    return this.agentToolConfigRepo.update(id, updates)
  }

  delete(id: string): boolean {
    return this.agentToolConfigRepo.delete(id)
  }

  setDefault(id: string): DbAgentToolConfig | null {
    return this.agentToolConfigRepo.setDefault(id)
  }

  resolveToolId(agentToolConfigId: string | null | undefined): string | null {
    if (!agentToolConfigId) {
      return null
    }

    return this.get(agentToolConfigId)?.tool_id ?? null
  }

  resolveParsedConfig(
    agentToolConfigId: string | null | undefined,
    contextLabel: string
  ): Record<string, unknown> | null {
    if (!agentToolConfigId) {
      return null
    }

    return this.parseConfigRecord(this.get(agentToolConfigId), contextLabel)
  }

  resolveConfigForTool(
    toolId: string | null | undefined,
    agentToolConfigId: string | null | undefined,
    contextLabel: string
  ): Record<string, unknown> | null {
    if (!toolId || !agentToolConfigId) {
      return null
    }

    const configRecord = this.get(agentToolConfigId)
    if (configRecord?.tool_id !== toolId) {
      return null
    }

    return this.parseConfigRecord(configRecord, contextLabel)
  }

  private parseConfigRecord(
    configRecord: DbAgentToolConfig | null,
    contextLabel: string
  ): Record<string, unknown> | null {
    if (!configRecord?.config_json) {
      return null
    }

    try {
      const parsed = JSON.parse(configRecord.config_json)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch (error) {
      console.error(`[AgentToolProfileService] Failed to parse ${contextLabel} tool config:`, error)
    }

    return null
  }
}
