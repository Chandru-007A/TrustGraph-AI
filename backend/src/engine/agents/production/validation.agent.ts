// src/engine/agents/production/validation.agent.ts
import { IAgent, WorkflowContext, SourceCollectionOutput, ValidationOutput } from '../../interfaces';
import { generateAgentDid } from '../../utils/hash.utils';
import { AIProviderFactory, IAIProvider, executeWithFallback } from '../../ai';
import { VALIDATOR_SYSTEM_PROMPT, getValidatorUserPrompt } from '../../prompts';
import logger from '../../../utils/logger';

export class ProductionValidationAgent implements IAgent {
  readonly agentDid = generateAgentDid('production-validation-agent');
  readonly name = 'ValidationAgent';
  private provider: IAIProvider;

  constructor() {
    this.provider = AIProviderFactory.createProvider();
  }

  async execute(input: SourceCollectionOutput, context: Readonly<WorkflowContext>): Promise<ValidationOutput> {
    const query = context.originalQuery;
    
    // We need findings from earlier stage
    const researchOutput = context.stageOutputs['ResearchNode'];
    const findings = researchOutput ? researchOutput.data : {};

    const request = {
      systemPrompt: VALIDATOR_SYSTEM_PROMPT,
      userPrompt: getValidatorUserPrompt(query, findings, input),
      responseFormat: 'json_object' as const,
    };

    const response = await executeWithFallback(this.provider, request, context, this.name);

    try {
      return JSON.parse(response.content) as ValidationOutput;
    } catch (e: any) {
      logger.error(`[${this.name}] Failed to parse JSON response: ${response.content}`);
      return {
        validatedFacts: ['Fallback validated fact'],
        rejectedFacts: [],
        overallConfidence: 0.5,
        validationNotes: "Fallback validation notes"
      };
    }
  }
}
