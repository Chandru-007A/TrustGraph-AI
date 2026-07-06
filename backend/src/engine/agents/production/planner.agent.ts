// src/engine/agents/production/planner.agent.ts
import { IAgent, WorkflowContext, PlannerOutput } from '../../interfaces';
import { generateAgentDid } from '../../utils/hash.utils';
import { AIProviderFactory, IAIProvider, executeWithFallback } from '../../ai';
import { PLANNER_SYSTEM_PROMPT, getPlannerUserPrompt } from '../../prompts';
import logger from '../../../utils/logger';

export class ProductionPlannerAgent implements IAgent {
  readonly agentDid = generateAgentDid('production-planner-agent');
  readonly name = 'PlannerAgent';
  private provider: IAIProvider;

  constructor() {
    this.provider = AIProviderFactory.createProvider();
  }

  async execute(input: unknown, context: Readonly<WorkflowContext>): Promise<PlannerOutput> {
    const query = context.originalQuery;
    const request = {
      systemPrompt: PLANNER_SYSTEM_PROMPT,
      userPrompt: getPlannerUserPrompt(query),
      responseFormat: 'json_object' as const,
    };

    const response = await executeWithFallback(this.provider, request, context, this.name);

    try {
      const output = JSON.parse(response.content) as PlannerOutput;
      return output;
    } catch (e: any) {
      logger.error(`[${this.name}] Failed to parse JSON response: ${response.content}`);
      // Fallback for Mock provider string or bad LLM formatting
      return {
        plan: `Fallback plan for: ${query}`,
        subQueries: [query],
        requiredCapabilities: ['fallback'],
        estimatedComplexity: 'LOW',
      };
    }
  }
}
