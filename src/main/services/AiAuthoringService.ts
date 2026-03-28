import { WorkflowDefinitionGenerationService } from './WorkflowDefinitionGenerationService'
import { PromptOptimizationService } from './PromptOptimizationService'
import { AgentToolProfileService } from './AgentToolProfileService'
import type {
  GenerateWorkflowDefinitionInput,
  GeneratedWorkflowDefinitionResult
} from '../types/workflow-definition'
import type {
  OptimizePromptInput,
  OptimizePromptResult
} from '../types/prompt-optimization'

export class AiAuthoringService {
  private workflowDefinitionGenerationService: WorkflowDefinitionGenerationService
  private promptOptimizationService: PromptOptimizationService
  private agentToolProfileService: AgentToolProfileService

  constructor(
    workflowDefinitionGenerationService: WorkflowDefinitionGenerationService,
    promptOptimizationService: PromptOptimizationService,
    agentToolProfileService: AgentToolProfileService
  ) {
    this.workflowDefinitionGenerationService = workflowDefinitionGenerationService
    this.promptOptimizationService = promptOptimizationService
    this.agentToolProfileService = agentToolProfileService
  }

  async generateWorkflowDefinition(
    input: GenerateWorkflowDefinitionInput
  ): Promise<GeneratedWorkflowDefinitionResult> {
    return await this.workflowDefinitionGenerationService.generateDefinition({
      ...input,
      resolvedToolConfig: this.agentToolProfileService.resolveConfigForTool(
        input.toolId,
        input.agentToolConfigId,
        'workflow generation'
      )
    })
  }

  async optimizePrompt(input: OptimizePromptInput): Promise<OptimizePromptResult> {
    return await this.promptOptimizationService.optimizePrompt({
      ...input,
      resolvedToolConfig: this.agentToolProfileService.resolveConfigForTool(
        input.toolId,
        input.agentToolConfigId,
        'prompt optimization'
      )
    })
  }
}
