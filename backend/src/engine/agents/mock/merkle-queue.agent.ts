// src/engine/agents/mock/merkle-queue.agent.ts
// ─────────────────────────────────────────────────────────────────────────────
// MockMerkleQueueAgent — Stage 9
//
// RESPONSIBILITY: Build a Merkle tree from all stage hashes.
//                 The Merkle root is what gets anchored to the blockchain.
// In production: Same deterministic logic — no LLM needed.
//                Persists MerkleRoot to the DB.
// ─────────────────────────────────────────────────────────────────────────────

import { IAgent, WorkflowContext, HashQueueOutput, MerkleQueueOutput } from '../../interfaces';
import { generateAgentDid } from '../../utils/hash.utils';
import { merkleTreeService } from '../../merkle/merkle.service';
import prisma from '../../../utils/prisma';
import logger from '../../../utils/logger';

export class MockMerkleQueueAgent implements IAgent {
  readonly agentDid = generateAgentDid('merkle-queue-agent');
  readonly name = 'MockMerkleQueueAgent';

  async execute(
    _input: HashQueueOutput,
    context: Readonly<WorkflowContext>,
  ): Promise<MerkleQueueOutput> {
    await new Promise((r) => setTimeout(r, 60));

    // Pull the canonical NODE_HASH leaves from the DB in stepIndex order.
    // This is the single source of truth for merkle leaves — the same
    // hashes the verify engine reads on subsequent /proof requests.
    const nodeRecords = await prisma.workflowNode.findMany({
      where: { sessionId: context.sessionId },
      include: { hashes: { where: { type: 'NODE_HASH' } } },
      orderBy: { stepIndex: 'asc' },
    });
    const leaves = nodeRecords
      .map((n) => n.hashes[0]?.hashValue)
      .filter((h): h is string => Boolean(h));

    if (leaves.length === 0) {
      throw new Error(
        `[MerkleQueueAgent] No NODE_HASH leaves found for session ${context.sessionId}. ` +
          'Ensure BaseWorkflowNode is persisting canonical NODE_HASH records.',
      );
    }

    const persisted = await merkleTreeService.buildAndPersistForSession(
      context.sessionId,
      leaves,
    );
    const rootHash = persisted.rootHash;
    const depth = persisted.treeDepth;

    logger.info(
      `[MerkleQueueAgent] Persisted Merkle root ${rootHash} for session ${context.sessionId} (${leaves.length} leaves)`,
    );

    return {
      rootHash,
      leaves,
      treeDepth: depth,
    };
  }
}
