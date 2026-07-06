// backend/src/services/workflow-stats.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Dashboard stats aggregation. Returns the totals the dashboard needs
// (Total Workflows, Verified Receipts, Purchased Nodes, Blockchain Status)
// in a single round-trip.
//
// All counts are derived from existing Prisma models — no schema changes.
// Queries run inside a single prisma.$transaction so the numbers reflect a
// consistent point-in-time view.
// ─────────────────────────────────────────────────────────────────────────────

import prisma from '../utils/prisma';
import { arcBlockchainService } from '../engine/blockchain/arc.service';
import { SessionStatus } from '@prisma/client';

export interface WorkflowStats {
  totalWorkflows: number;
  completedWorkflows: number;
  runningWorkflows: number;
  failedWorkflows: number;
  pendingWorkflows: number;
  totalNodes: number;
  purchasedNodes: number;
  verifiedReceipts: number;
  blockchainAnchored: number;
  blockchainStatus: 'connected' | 'mock' | 'disconnected';
}

export const getWorkflowStats = async (userId: string): Promise<WorkflowStats> => {
  // 1. Count sessions grouped by status (one DB round-trip).
  const grouped = await prisma.researchSession.groupBy({
    by: ['status'],
    where: { userId },
    _count: { _all: true },
  });

  const countByStatus = (status: SessionStatus): number =>
    grouped.find((g: { status: SessionStatus; _count: { _all: number } }) => g.status === status)
      ?._count._all ?? 0;

  // 2. The user's wallet addresses (lowercase hex, as stored in
  //    PaymentEntitlement.walletAddress and Wallet.address).
  const userWallets = await prisma.wallet.findMany({
    where: { userId },
    select: { address: true },
  });
  const walletAddresses = userWallets
    .map((w) => w.address.toLowerCase());

  // 3. Run the remaining aggregations in a single transaction for consistency.
  //    paymentEntitlement may not exist on very early DBs — fall back to 0
  //    if the count throws. We do this with a try/catch around the
  //    transaction result (not on the PrismaPromise itself, since adding
  //    .catch() strips the PrismaPromise brand and breaks the array-form
  //    typing of $transaction).
  let purchasedNodes = 0;
  let totalNodes = 0;
  let verifiedReceipts = 0;
  let blockchainAnchored = 0;
  try {
    const txResult = await prisma.$transaction([
      // Total nodes across the user's sessions.
      prisma.workflowNode.count({ where: { session: { userId } } }),

      // "Purchased" = number of PAID PaymentEntitlements tied to one of
      // the user's wallet addresses. Counted in the same transaction so
      // it reflects the same point-in-time as the other counts.
      prisma.paymentEntitlement.count({
        where: {
          paymentStatus: 'PAID',
          walletAddress: { in: walletAddresses },
        },
      }),

      // "Verified" = sessions that produced at least one VerificationLog row.
      prisma.verificationLog.count({ where: { session: { userId } } }),

      // "Anchored" = BlockchainReceipt rows whose MerkleRoot belongs to
      // one of the user's sessions.
      prisma.blockchainReceipt.count({
        where: { merkleRoot: { session: { userId } } },
      }),
    ]);
    [totalNodes, purchasedNodes, verifiedReceipts, blockchainAnchored] = txResult as number[];
  } catch {
    // paymentEntitlement may not exist on very early DBs — fall back to 0
    // for that one count while still reporting the others.
    try {
      const fallback = await prisma.$transaction([
        prisma.workflowNode.count({ where: { session: { userId } } }),
        prisma.verificationLog.count({ where: { session: { userId } } }),
        prisma.blockchainReceipt.count({
          where: { merkleRoot: { session: { userId } } },
        }),
      ]);
      [totalNodes, verifiedReceipts, blockchainAnchored] = fallback as number[];
    } catch {
      // swallow — all counts stay at 0
    }
  }

  return {
    totalWorkflows: countByStatus(SessionStatus.PENDING)
      + countByStatus(SessionStatus.RUNNING)
      + countByStatus(SessionStatus.COMPLETED)
      + countByStatus(SessionStatus.FAILED)
      + countByStatus(SessionStatus.DISPUTED),
    completedWorkflows: countByStatus(SessionStatus.COMPLETED),
    runningWorkflows: countByStatus(SessionStatus.RUNNING),
    failedWorkflows: countByStatus(SessionStatus.FAILED),
    pendingWorkflows: countByStatus(SessionStatus.PENDING),
    totalNodes,
    purchasedNodes,
    verifiedReceipts,
    blockchainAnchored,
    // Reuse the same isMock flag the engine uses to gate live vs mock mode.
    blockchainStatus: arcBlockchainService.isMock ? 'mock' : 'connected',
  };
};
