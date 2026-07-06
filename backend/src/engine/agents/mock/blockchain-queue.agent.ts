// src/engine/agents/mock/blockchain-queue.agent.ts
// ─────────────────────────────────────────────────────────────────────────────
// MockBlockchainQueueAgent — Stage 10
//
// RESPONSIBILITY: Simulate anchoring the Merkle root to Arc L1.
//                 Creates a BlockchainReceipt record in the DB.
// In production: Replace the mock TX generation with Arc L1 SDK calls.
//                The DB write logic remains identical.
// ─────────────────────────────────────────────────────────────────────────────

import { IAgent, WorkflowContext, MerkleQueueOutput, BlockchainQueueOutput } from '../../interfaces';
import { generateAgentDid, generateMockTxId, sha256 } from '../../utils/hash.utils';
import prisma from '../../../utils/prisma';
import logger from '../../../utils/logger';

export class MockBlockchainQueueAgent implements IAgent {
  readonly agentDid = generateAgentDid('blockchain-queue-agent');
  readonly name = 'MockBlockchainQueueAgent';

  async execute(
    input: MerkleQueueOutput,
    context: Readonly<WorkflowContext>,
  ): Promise<BlockchainQueueOutput> {
    // Simulate network latency for blockchain transaction
    await new Promise((r) => setTimeout(r, 200));

    const txId = generateMockTxId();
    const blockHeight = Math.floor(Math.random() * 1_000_000) + 5_000_000;
    const anchoredAt = new Date();

    // Find the MerkleRoot record to link the BlockchainReceipt
    try {
      const merkleRootRecord = await prisma.merkleRoot.findUnique({
        where: { sessionId: context.sessionId },
      });

      if (merkleRootRecord) {
        await prisma.blockchainReceipt.create({
          data: {
            merkleRootId: merkleRootRecord.id,
            signature: sha256(`${txId}:${input.rootHash}:${context.sessionId}`),
          },
        });

        logger.info(
          `[BlockchainQueueAgent] Created blockchain receipt for session ${context.sessionId}. TxID: ${txId}`,
        );
      }
    } catch (err: any) {
      logger.warn(`[BlockchainQueueAgent] DB write failed: ${err.message}`);
    }

    return {
      txId,
      anchored: true,
      blockHeight,
      timestamp: anchoredAt,
    };
  }
}
