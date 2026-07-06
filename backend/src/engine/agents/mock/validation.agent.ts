// src/engine/agents/mock/validation.agent.ts
// ─────────────────────────────────────────────────────────────────────────────
// MockValidationAgent — Stage 4
//
// RESPONSIBILITY: Cross-check findings against sources. Reject unverifiable claims.
// In production: Replace with LLM-based fact-checking + source cross-referencing.
// ─────────────────────────────────────────────────────────────────────────────

import {
  IAgent,
  WorkflowContext,
  SourceCollectionOutput,
  ValidationOutput,
} from '../../interfaces';
import { generateAgentDid } from '../../utils/hash.utils';

export class MockValidationAgent implements IAgent {
  readonly agentDid = generateAgentDid('validation-agent');
  readonly name = 'MockValidationAgent';

  async execute(
    input: SourceCollectionOutput,
    context: Readonly<WorkflowContext>,
  ): Promise<ValidationOutput> {
    await new Promise((r) => setTimeout(r, 100));

    // Pull research findings from context (set by Stage 2)
    const researchOutput = context.stageOutputs['ResearchNode'];
    const findings = researchOutput
      ? (researchOutput.data as any)?.keyFacts ?? []
      : [];

    return {
      validatedFacts: [
        ...findings.slice(0, 2),
        `Cross-verified: ${input.sources.length} independent sources confirm core claims.`,
        `Source average credibility score: ${(
          input.sources.reduce((sum, s) => sum + s.credibilityScore, 0) / input.sources.length
        ).toFixed(2)}`,
      ],
      rejectedFacts: [
        'Claim about "100% adoption rate" could not be verified — rejected.',
      ],
      overallConfidence: 0.83,
      validationNotes:
        'Core findings validated against peer-reviewed literature. Minor claims flagged for uncertainty.',
    };
  }
}
