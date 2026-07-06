// src/engine/agents/mock/research.agent.ts
// ─────────────────────────────────────────────────────────────────────────────
// MockResearchAgent — Stage 2
//
// RESPONSIBILITY: Execute each sub-query from the Planner and gather raw data.
// In production: Replace with web search API (Serper/Brave) + LLM summarization.
// ─────────────────────────────────────────────────────────────────────────────

import { IAgent, WorkflowContext, PlannerOutput, ResearchOutput } from '../../interfaces';
import { generateAgentDid } from '../../utils/hash.utils';

export class MockResearchAgent implements IAgent {
  readonly agentDid = generateAgentDid('research-agent');
  readonly name = 'MockResearchAgent';

  async execute(input: PlannerOutput, context: Readonly<WorkflowContext>): Promise<ResearchOutput> {
    await new Promise((r) => setTimeout(r, 150));

    const query = context.originalQuery;

    return {
      rawFindings: [
        `Finding 1: ${query} has multiple documented definitions across peer-reviewed literature.`,
        `Finding 2: Recent studies (2023-2025) show significant advancements in ${query} research.`,
        `Finding 3: ${query} intersects with adjacent fields including data science and systems theory.`,
        `Finding 4: Practical implementations of ${query} have been deployed in enterprise contexts.`,
      ],
      keyFacts: [
        `${query} was formally defined in academic context circa 2018.`,
        `Industry adoption rate: estimated 34% among Fortune 500 companies.`,
        `Primary research institutions: MIT, Stanford, Oxford.`,
      ],
      uncertainties: [
        `Long-term effects of ${query} are not yet fully documented.`,
        `Conflicting results exist in some experimental contexts.`,
      ],
      coverageScore: 0.78,
    };
  }
}
