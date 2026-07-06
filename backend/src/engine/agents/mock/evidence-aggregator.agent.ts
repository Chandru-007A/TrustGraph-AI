// src/engine/agents/mock/evidence-aggregator.agent.ts
// ─────────────────────────────────────────────────────────────────────────────
// MockEvidenceAggregatorAgent — Stage 6
//
// RESPONSIBILITY: Combine all validated facts, sources, and reasoning into a
//                 final coherent answer ready for the user.
// In production: Replace with LLM synthesis + formatting call.
// ─────────────────────────────────────────────────────────────────────────────

import {
  IAgent,
  WorkflowContext,
  ReasoningOutput,
  EvidenceAggregatorOutput,
} from '../../interfaces';
import { generateAgentDid } from '../../utils/hash.utils';

export class MockEvidenceAggregatorAgent implements IAgent {
  readonly agentDid = generateAgentDid('evidence-aggregator-agent');
  readonly name = 'MockEvidenceAggregatorAgent';

  async execute(
    input: ReasoningOutput,
    context: Readonly<WorkflowContext>,
  ): Promise<EvidenceAggregatorOutput> {
    await new Promise((r) => setTimeout(r, 130));

    const query = context.originalQuery;

    // Pull source data from context
    const sourceOutput = context.stageOutputs['SourceCollectionNode'];
    const sources = sourceOutput
      ? (sourceOutput.data as any)?.sources ?? []
      : [];

    const sourceList = sources
      .map((s: any) => s.title)
      .join('; ');

    return {
      finalAnswer: `Based on ${sources.length} verified sources and multi-stage analysis, the research on "${query}" reveals: ${input.conclusions.join(' ')} The evidence is supported by: ${sourceList}.`,
      evidenceSummary: `Aggregated ${sources.length} sources. Reasoning chain contains ${input.logicalChain.length} logical steps. Confidence level: ${(input.confidence * 100).toFixed(1)}%.`,
      supportingPoints: [
        ...input.conclusions,
        ...input.logicalChain.slice(-1), // Final conclusion from chain
      ],
      confidence: input.confidence,
    };
  }
}
