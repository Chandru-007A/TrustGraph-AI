// src/engine/agents/mock/payment-queue.agent.ts
// ─────────────────────────────────────────────────────────────────────────────
// MockPaymentQueueAgent — Stage 11
//
// RESPONSIBILITY: Calculate and simulate settling the USDC nanopayment for this
//                 research session. Creates a Payment record in the DB.
// In production: Replace settlement simulation with Arc L1 USDC transfer + escrow release.
// ─────────────────────────────────────────────────────────────────────────────

import { IAgent, WorkflowContext, BlockchainQueueOutput, PaymentQueueOutput } from '../../interfaces';
import { generateAgentDid } from '../../utils/hash.utils';
import logger from '../../../utils/logger';
import prisma from '../../../utils/prisma';

export class MockPaymentQueueAgent implements IAgent {
  readonly agentDid = generateAgentDid('payment-queue-agent');
  readonly name = 'MockPaymentQueueAgent';

  // Cost per stage in USDC (nano-level precision — 6 decimal places)
  private readonly COST_PER_STAGE_USDC = 0.000001;

  async execute(
    input: BlockchainQueueOutput,
    context: Readonly<WorkflowContext>,
  ): Promise<PaymentQueueOutput> {
    await new Promise((r) => setTimeout(r, 80));

    const completedStages = Object.values(context.stageOutputs).filter((s) => s.success).length;
    const totalCost = (completedStages * this.COST_PER_STAGE_USDC).toFixed(6);

    // In production: trigger escrow release via Arc L1 SDK here
    // await arcL1.releaseEscrow(context.sessionId, totalCost);

    // Update session total cost
    try {
      await prisma.researchSession.update({
        where: { id: context.sessionId },
        data: { totalCost: parseFloat(totalCost) },
      });
    } catch (err: any) {
      logger.warn(`[PaymentQueueAgent] Could not update session cost: ${err.message}`);
    }

    logger.info(
      `[PaymentQueueAgent] Payment settled: ${totalCost} USDC for session ${context.sessionId}`,
    );

    return {
      paymentId: `pay_mock_${Date.now()}`,
      amountUsdc: totalCost,
      status: 'SETTLED',
      settledAt: new Date(),
    };
  }
}
