// src/engine/agents/mock/source-collection.agent.ts
// ─────────────────────────────────────────────────────────────────────────────
// MockSourceCollectionAgent — Stage 3
//
// RESPONSIBILITY: Find, rank, and score credible sources for the research findings.
// In production: Replace with Serper/Exa/Brave Search API + citation scoring.
// ─────────────────────────────────────────────────────────────────────────────

import { IAgent, WorkflowContext, ResearchOutput, SourceCollectionOutput } from '../../interfaces';
import { generateAgentDid } from '../../utils/hash.utils';

export class MockSourceCollectionAgent implements IAgent {
  readonly agentDid = generateAgentDid('source-collection-agent');
  readonly name = 'MockSourceCollectionAgent';

  async execute(
    input: ResearchOutput,
    context: Readonly<WorkflowContext>,
  ): Promise<SourceCollectionOutput> {
    await new Promise((r) => setTimeout(r, 120));

    const query = context.originalQuery;

    return {
      sources: [
        {
          url: `https://arxiv.org/abs/mock-${Date.now()}-1`,
          title: `Comprehensive Analysis of ${query}: A Systematic Review`,
          relevanceScore: 0.94,
          credibilityScore: 0.98,
          snippet: `This paper presents a systematic review of ${query}, covering 147 peer-reviewed studies from 2015-2025...`,
        },
        {
          url: `https://nature.com/articles/mock-${Date.now()}-2`,
          title: `Empirical Evidence for ${query} in Complex Systems`,
          relevanceScore: 0.87,
          credibilityScore: 0.97,
          snippet: `Nature study demonstrating ${query} effects across distributed network architectures...`,
        },
        {
          url: `https://doi.org/10.1000/mock-${Date.now()}-3`,
          title: `${query}: Industrial Applications and Case Studies`,
          relevanceScore: 0.82,
          credibilityScore: 0.89,
          snippet: `Enterprise deployments show 40% efficiency gains when applying ${query} principles...`,
        },
      ],
      totalSourcesFound: 3,
    };
  }
}
