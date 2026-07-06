// src/engine/agents/production/summary.agent.ts
import { IAgent, WorkflowContext, EvidenceAggregatorOutput, WorkflowRecorderOutput } from '../../interfaces';
import { generateAgentDid } from '../../utils/hash.utils';
import { AIProviderFactory, IAIProvider, executeWithFallback } from '../../ai';
import { SUMMARY_SYSTEM_PROMPT, getSummaryUserPrompt } from '../../prompts';
import logger from '../../../utils/logger';

export class ProductionSummaryAgent implements IAgent {
  readonly agentDid = generateAgentDid('production-summary-agent');
  readonly name = 'WorkflowRecorderAgent'; // Keep name consistent with mock for mapping
  private provider: IAIProvider;

  constructor() {
    this.provider = AIProviderFactory.createProvider();
  }

  async execute(input: EvidenceAggregatorOutput, context: Readonly<WorkflowContext>): Promise<WorkflowRecorderOutput> {
    const query = context.originalQuery;
    
    const request = {
      systemPrompt: SUMMARY_SYSTEM_PROMPT,
      userPrompt: getSummaryUserPrompt(query, input),
      responseFormat: 'json_object' as const,
    };

    const response = await executeWithFallback(this.provider, request, context, this.name);
    
    let summaryData: any;
    try {
      summaryData = JSON.parse(response.content);
    } catch (e: any) {
      logger.error(`[${this.name}] Failed to parse JSON response: ${response.content}`);
      summaryData = {
        executiveSummary: "Fallback executive summary.",
        highlights: [],
        recommendations: []
      };
    }

    // Format matches WorkflowRecorderOutput
    return {
      recordId: generateAgentDid('workflow-record'),
      workflowSummary: summaryData.executiveSummary,
      stageCount: Object.keys(context.stageOutputs).length,
      recordedAt: new Date()
    };
  }
}
