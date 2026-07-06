// src/engine/agents/production/source-collection.agent.ts
import { IAgent, WorkflowContext, ResearchOutput, SourceCollectionOutput } from '../../interfaces';
import { generateAgentDid } from '../../utils/hash.utils';
import { AIProviderFactory, IAIProvider, executeWithFallback } from '../../ai';
import { SOURCE_SYSTEM_PROMPT, getSourceUserPrompt } from '../../prompts';
import logger from '../../../utils/logger';

export class ProductionSourceCollectionAgent implements IAgent {
  readonly agentDid = generateAgentDid('production-source-agent');
  readonly name = 'SourceCollectionAgent';
  private provider: IAIProvider;

  constructor() {
    this.provider = AIProviderFactory.createProvider();
  }

  async execute(input: ResearchOutput, context: Readonly<WorkflowContext>): Promise<SourceCollectionOutput> {
    const query = context.originalQuery;
    const request = {
      systemPrompt: SOURCE_SYSTEM_PROMPT,
      userPrompt: getSourceUserPrompt(query, input),
      responseFormat: 'json_object' as const,
    };

    const response = await executeWithFallback(this.provider, request, context, this.name);

    try {
      return JSON.parse(response.content) as SourceCollectionOutput;
    } catch (e: any) {
      logger.error(`[${this.name}] Failed to parse JSON response: ${response.content}`);
      return {
        sources: [
          {
            url: "https://example.com/fallback",
            title: "Fallback Source",
            relevanceScore: 0.5,
            credibilityScore: 0.5,
            snippet: "Fallback snippet"
          }
        ],
        totalSourcesFound: 1
      };
    }
  }
}
