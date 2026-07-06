// src/engine/agents/mock/hash-queue.agent.ts
// ─────────────────────────────────────────────────────────────────────────────
// MockHashQueueAgent — Stage 8
//
// RESPONSIBILITY: Compute SHA-256 hashes of ALL stage outputs and produce
//                 a combined hash that will be the input to Merkle computation.
// In production: This remains deterministic code — no LLM replacement.
// ─────────────────────────────────────────────────────────────────────────────

import { IAgent, WorkflowContext, WorkflowRecorderOutput, HashQueueOutput } from '../../interfaces';
import { generateAgentDid, sha256 } from '../../utils/hash.utils';

export class MockHashQueueAgent implements IAgent {
  readonly agentDid = generateAgentDid('hash-queue-agent');
  readonly name = 'MockHashQueueAgent';

  async execute(
    input: WorkflowRecorderOutput,
    context: Readonly<WorkflowContext>,
  ): Promise<HashQueueOutput> {
    await new Promise((r) => setTimeout(r, 50));

    // Hash each stage's output deterministically
    const hashes = Object.entries(context.stageOutputs).map(([stageName, stageOutput]) => ({
      stageName,
      hash: sha256(stageOutput.data),
    }));

    // Also hash the recorder record itself
    hashes.push({
      stageName: 'WorkflowRecord',
      hash: sha256(input),
    });

    // Combine all hashes into a single combined hash
    const combinedHash = sha256(hashes.map((h) => h.hash).join(''));

    return {
      hashes,
      combinedHash,
    };
  }
}
