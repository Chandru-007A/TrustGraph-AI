// src/engine/agents/production/reasoning.agent.ts
import { IAgent, WorkflowContext, ValidationOutput, ReasoningOutput } from '../../interfaces';
import { generateAgentDid } from '../../utils/hash.utils';
import { AIProviderFactory, IAIProvider, executeWithFallback } from '../../ai';
import { REASONING_SYSTEM_PROMPT, getReasoningUserPrompt } from '../../prompts';
import logger from '../../../utils/logger';

export class ProductionReasoningAgent implements IAgent {
  readonly agentDid = generateAgentDid('production-reasoning-agent');
  readonly name = 'ReasoningAgent';
  private provider: IAIProvider;

  constructor() {
    this.provider = AIProviderFactory.createProvider();
  }

  async execute(input: ValidationOutput, context: Readonly<WorkflowContext>): Promise<ReasoningOutput> {
    const query = context.originalQuery;
    
    const request = {
      systemPrompt: REASONING_SYSTEM_PROMPT,
      userPrompt: getReasoningUserPrompt(query, input),
      responseFormat: 'json_object' as const,
    };

    const response = await executeWithFallback(this.provider, request, context, this.name);

    try {
      return JSON.parse(response.content) as ReasoningOutput;
    } catch (e: any) {
      logger.error(`[${this.name}] Failed to parse JSON response: ${response.content}`);
      return {
        reasoning: "Fallback reasoning logic.",
        conclusions: ["Fallback conclusion"],
        logicalChain: ["Fallback logical chain"],
        confidence: 0.5
      };
    }
  }
}
