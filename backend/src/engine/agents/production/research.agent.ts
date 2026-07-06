// src/engine/agents/production/research.agent.ts
import { IAgent, WorkflowContext, PlannerOutput, ResearchOutput } from '../../interfaces';
import { generateAgentDid } from '../../utils/hash.utils';
import { AIProviderFactory, IAIProvider, executeWithFallback } from '../../ai';
import { RESEARCHER_SYSTEM_PROMPT, getResearcherUserPrompt } from '../../prompts';
import logger from '../../../utils/logger';

export class ProductionResearchAgent implements IAgent {
  readonly agentDid = generateAgentDid('production-research-agent');
  readonly name = 'ResearchAgent';
  private provider: IAIProvider;

  constructor() {
    this.provider = AIProviderFactory.createProvider();
  }

  async execute(input: PlannerOutput, context: Readonly<WorkflowContext>): Promise<ResearchOutput> {
    const query = context.originalQuery;
    const request = {
      systemPrompt: RESEARCHER_SYSTEM_PROMPT,
      userPrompt: getResearcherUserPrompt(query, input),
      responseFormat: 'json_object' as const,
    };

    const response = await executeWithFallback(this.provider, request, context, this.name);

    try {
      return JSON.parse(response.content) as ResearchOutput;
    } catch (e: any) {
      logger.error(`[${this.name}] Failed to parse JSON response: ${response.content}`);
      return {
        rawFindings: ['Fallback finding'],
        keyFacts: ['Fallback fact'],
        uncertainties: ['Fallback uncertainty'],
        coverageScore: 0.5,
      };
    }
  }
}
