// src/engine/agents/mock/planner.agent.ts
// ─────────────────────────────────────────────────────────────────────────────
// MockPlannerAgent — Stage 1
//
// RESPONSIBILITY: Decompose a raw research query into a structured execution plan.
// In production: Replace with GPT-4o / Claude 3.5 Sonnet call.
// Contract: implements IAgent — swap without touching PlannerNode or orchestrator.
// ─────────────────────────────────────────────────────────────────────────────

import { IAgent, WorkflowContext, PlannerOutput } from '../../interfaces';
import { generateAgentDid } from '../../utils/hash.utils';

export class MockPlannerAgent implements IAgent {
  readonly agentDid = generateAgentDid('planner-agent');
  readonly name = 'MockPlannerAgent';

  async execute(input: unknown, context: Readonly<WorkflowContext>): Promise<PlannerOutput> {
    const query = context.originalQuery;

    // Simulate LLM processing time
    await new Promise((r) => setTimeout(r, 80));

    return {
      plan: `Structured research plan for: "${query}"`,
      subQueries: [
        `What are the primary definitions of: ${query}?`,
        `What are the latest research findings on: ${query}?`,
        `What are the key controversies or debates about: ${query}?`,
        `What are practical applications of: ${query}?`,
      ],
      requiredCapabilities: ['web_search', 'academic_db', 'fact_check', 'reasoning'],
      estimatedComplexity: 'MEDIUM',
    };
  }
}
