// src/engine/agents/mock/workflow-recorder.agent.ts
// ─────────────────────────────────────────────────────────────────────────────
// MockWorkflowRecorderAgent — Stage 7
//
// RESPONSIBILITY: Create an immutable audit record of the entire workflow execution.
//                 This record is what gets hashed, Merkle-rooted, and anchored.
// In production: This remains deterministic code — no LLM replacement needed.
// ─────────────────────────────────────────────────────────────────────────────

import { IAgent, WorkflowContext, EvidenceAggregatorOutput, WorkflowRecorderOutput } from '../../interfaces';
import { generateAgentDid } from '../../utils/hash.utils';
import { v4 as uuidv4 } from 'uuid';

export class MockWorkflowRecorderAgent implements IAgent {
  readonly agentDid = generateAgentDid('workflow-recorder-agent');
  readonly name = 'MockWorkflowRecorderAgent';

  async execute(
    input: EvidenceAggregatorOutput,
    context: Readonly<WorkflowContext>,
  ): Promise<WorkflowRecorderOutput> {
    await new Promise((r) => setTimeout(r, 40));

    const completedStages = Object.keys(context.stageOutputs).filter(
      (k) => context.stageOutputs[k].success,
    );

    return {
      recordId: uuidv4(),
      workflowSummary: `Session ${context.sessionId}: ${completedStages.length} stages completed successfully. Query: "${context.originalQuery}". Final confidence: ${(input.confidence * 100).toFixed(1)}%.`,
      stageCount: completedStages.length,
      recordedAt: new Date(),
    };
  }
}
