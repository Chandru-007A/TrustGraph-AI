// src/engine/agents/production/evidence-aggregator.agent.ts
import { IAgent, WorkflowContext, ReasoningOutput, EvidenceAggregatorOutput } from '../../interfaces';
import { generateAgentDid } from '../../utils/hash.utils';
import { AIProviderFactory, IAIProvider, executeWithFallback } from '../../ai';
import { EVIDENCE_SYSTEM_PROMPT, getEvidenceUserPrompt } from '../../prompts';
import logger from '../../../utils/logger';

export class ProductionEvidenceAggregatorAgent implements IAgent {
  readonly agentDid = generateAgentDid('production-evidence-agent');
  readonly name = 'EvidenceAggregatorAgent';
  private provider: IAIProvider;

  constructor() {
    this.provider = AIProviderFactory.createProvider();
  }

  async execute(input: ReasoningOutput, context: Readonly<WorkflowContext>): Promise<EvidenceAggregatorOutput> {
    const query = context.originalQuery;
    
    const sourceOutput = context.stageOutputs['SourceCollectionNode'];
    const sources = sourceOutput ? sourceOutput.data : [];

    const request = {
      systemPrompt: EVIDENCE_SYSTEM_PROMPT,
      userPrompt: getEvidenceUserPrompt(query, input, sources),
      responseFormat: 'json_object' as const,
    };

    const response = await executeWithFallback(this.provider, request, context, this.name);

    try {
      return JSON.parse(response.content) as EvidenceAggregatorOutput;
    } catch (e: any) {
      logger.error(`[${this.name}] Failed to parse JSON response: ${response.content}`);
      return {
        finalAnswer: "Fallback final answer",
        evidenceSummary: "Fallback summary",
        supportingPoints: ["Fallback point"],
        confidence: 0.5
      };
    }
  }
}
