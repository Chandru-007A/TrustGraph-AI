// src/engine/agents/production/blockchain-queue.agent.ts
// ─────────────────────────────────────────────────────────────────────────────
// ProductionBlockchainQueueAgent — Stage 10
//
// RESPONSIBILITY: Anchor the Merkle root to the real Arc L1 Testnet using the
//                 ReceiptRegistryV2 contract with exponential backoff.
// ─────────────────────────────────────────────────────────────────────────────

import { IAgent, WorkflowContext, MerkleQueueOutput, BlockchainQueueOutput } from '../../interfaces';
import { generateAgentDid } from '../../utils/hash.utils';
import { ReceiptRegistryService } from '../../blockchain/receipt-registry.service';
import logger from '../../../utils/logger';

// ─── Retry Utility for transient RPC/Network errors ──────────────────────────

const ARC_RETRYABLE_CODES = new Set([
  'NETWORK_ERROR',
  'TIMEOUT',
  'SERVER_ERROR',
  'NONCE_EXPIRED',
  'REPLACEMENT_UNDERPRICED',
  'UNPREDICTABLE_GAS_LIMIT'
]);

async function withArcRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 5,
): Promise<T> {
  let attempt = 0;
  let delay = 1000;

  while (attempt <= maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;
      
      const isRetryable = 
        ARC_RETRYABLE_CODES.has(error.code) ||
        error.message?.toLowerCase().includes('timeout') ||
        error.message?.toLowerCase().includes('nonce') ||
        error.message?.toLowerCase().includes('gas') ||
        error.message?.toLowerCase().includes('connection');

      if (attempt > maxRetries || !isRetryable) {
        logger.error(`[BlockchainQueueAgent] FAILED after ${attempt - 1} retries: ${error.message}`);
        throw error;
      }
      
      logger.warn(`[BlockchainQueueAgent] Transient error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms... Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 30_000); // Exponential backoff, cap at 30s
    }
  }
  throw new Error('[BlockchainQueueAgent] Unreachable');
}

export class ProductionBlockchainQueueAgent implements IAgent {
  readonly agentDid = generateAgentDid('production-blockchain-queue-agent');
  readonly name = 'ProductionBlockchainQueueAgent';
  private readonly registryService: ReceiptRegistryService;

  constructor() {
    this.registryService = new ReceiptRegistryService();
  }

  async execute(
    input: MerkleQueueOutput,
    context: Readonly<WorkflowContext>,
  ): Promise<BlockchainQueueOutput> {
    logger.info(`[BlockchainQueueAgent] Anchoring workflow ${context.sessionId} to Arc Testnet...`);

    const result = await withArcRetry(() => 
      this.registryService.publishReceipt(context.sessionId)
    );

    logger.info(
      `[BlockchainQueueAgent] Anchored successfully. TxID: ${result.txHash} | Explorer: ${result.explorerUrl}`
    );

    return {
      txId: result.txHash,
      anchored: true,
      blockHeight: (result as any).blockNumber || 0,
      timestamp: new Date(),
    };
  }
}
