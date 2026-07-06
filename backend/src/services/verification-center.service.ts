// src/services/verification-center.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Phase 24 — Verification Center Service
//
// Provides the data layer for:
//   GET /verify/list       — paginated list of verifiable sessions for a user
//   GET /verify/detail/:sessionId — full verification detail
//
// Joins ResearchSession → MerkleRoot → BlockchainReceipt → ReceiptV2Event
// → PaymentEntitlement to produce a unified verification view.
// ─────────────────────────────────────────────────────────────────────────────

import httpStatus from 'http-status';
import prisma from '../utils/prisma';
import ApiError from '../utils/ApiError';
import config from '../config/config';

// ── Types ────────────────────────────────────────────────────────────────────

export interface VerificationListItem {
  sessionId: string;
  workflowId: string;
  overallResult: 'VERIFIED' | 'TAMPERED' | 'INCOMPLETE';
  merkleRoot: string | null;
  blockchainStatus: string | null;
  receiptStatus: string | null;
  receiptId: string | null;
  verifiedAt: string;
  integrityScore: number;
}

export interface VerificationListResult {
  items: VerificationListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface VerificationDetail {
  sessionId: string;
  workflowId: string;
  query: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  totalNodes: number;
  completedNodes: number;
  integrityReport: Record<string, unknown> | null;
  merkle: {
    treeId: string;
    sessionId: string;
    rootHash: string;
    leafCount: number;
    treeDepth: number;
    algorithm: string;
    generationMs: number;
    leaves: string[];
    createdAt: string;
    proofs: {
      proofId: string;
      nodeId: string;
      leafHash: string;
      proof: unknown[];
      proofDepth: number;
      isValid: boolean;
      createdAt: string;
    }[];
  } | null;
  blockchain: {
    txHash: string | null;
    blockNumber: number | null;
    network: string | null;
    registryId: string | null;
    explorerUrl: string | null;
    anchoredAt: string | null;
    merkleRoot: string | null;
    probability: number | null;
    confidence: number | null;
    schemaVersion: string | null;
    publisher: string | null;
    consumer: string | null;
    traceCid: string | null;
    traceHash: string | null;
  } | null;
  receipt: {
    id: string;
    amount: string;
    currency: string;
    paymentStatus: string;
    walletAddress: string | null;
    paidAt: string | null;
  } | null;
}

// ── Service ──────────────────────────────────────────────────────────────────

class VerificationCenterService {
  async list(
    userId: string,
    page = 1,
    limit = 15,
    search = '',
    status = '',
  ): Promise<VerificationListResult> {
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };
    if (search.trim()) {
      where.workflowId = { contains: search.trim(), mode: 'insensitive' };
    }

    const [sessions, total] = await Promise.all([
      prisma.researchSession.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          merkleRoot: { select: { rootHash: true } },
          _count: { select: { workflowNodes: true } },
        },
      }),
      prisma.researchSession.count({ where: where as any }),
    ]);

    const rawItems = await Promise.all(
      sessions.map(async (s): Promise<VerificationListItem | null> => {
        // Get latest integrity verification log
        const latestLog = await prisma.verificationLog.findFirst({
          where: { sessionId: s.id, verificationType: 'WORKFLOW_INTEGRITY' },
          orderBy: { verifiedAt: 'desc' },
        });

        const logResult = latestLog?.result as Record<string, unknown> | null;
        const overallResult = (logResult?.overallResult as string) ?? 'INCOMPLETE';
        const integrityScore = (logResult?.integrityScore as number) ?? 0;

        // PaymentEntitlement (first one for this session)
        const entitlement = await prisma.paymentEntitlement.findFirst({
          where: { workflowId: s.id },
          orderBy: { createdAt: 'desc' },
        });

        // Filter by status if provided
        if (status && status !== 'ALL' && overallResult !== status) {
          return null;
        }

        return {
          sessionId: s.id,
          workflowId: s.workflowId,
          overallResult: overallResult as VerificationListItem['overallResult'],
          merkleRoot: s.merkleRoot?.rootHash ?? null,
          blockchainStatus: null,
          receiptStatus: entitlement?.paymentStatus ?? null,
          receiptId: entitlement?.id ?? null,
          verifiedAt: latestLog?.verifiedAt.toISOString() ?? s.updatedAt.toISOString(),
          integrityScore,
        };
      }),
    );

    const filtered = rawItems.filter((i): i is VerificationListItem => i !== null);


    return {
      items: filtered,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDetail(sessionId: string, userId: string): Promise<VerificationDetail> {
    const session = await prisma.researchSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        workflowNodes: {
          select: { id: true, status: true, nodeName: true },
          orderBy: { stepIndex: 'asc' },
        },
        merkleRoot: {
          include: {
            proofs: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!session) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Workflow session not found');
    }

    const completedNodes = session.workflowNodes.filter(
      (n) => n.status === 'COMPLETED',
    ).length;

    // Latest integrity report
    const latestLog = await prisma.verificationLog.findFirst({
      where: { sessionId, verificationType: 'WORKFLOW_INTEGRITY' },
      orderBy: { verifiedAt: 'desc' },
    });
    const integrityReport = latestLog?.result as Record<string, unknown> | null;

    // Merkle data
    let merkle: VerificationDetail['merkle'] = null;
    if (session.merkleRoot) {
      const mr = session.merkleRoot;
      merkle = {
        treeId: mr.id,
        sessionId: mr.sessionId,
        rootHash: mr.rootHash,
        leafCount: mr.leafCount,
        treeDepth: mr.treeDepth,
        algorithm: mr.algorithm,
        generationMs: mr.generationMs,
        leaves: mr.leaves,
        createdAt: mr.createdAt.toISOString(),
        proofs: mr.proofs.map((p) => ({
          proofId: p.id,
          nodeId: p.nodeId,
          leafHash: p.leafHash,
          proof: Array.isArray(p.proof) ? p.proof : [],
          proofDepth: p.proofDepth,
          isValid: p.isValid,
          createdAt: p.createdAt.toISOString(),
        })),
      };
    }

    // Blockchain receipt (from MerkleRoot if available)
    let blockchain: VerificationDetail['blockchain'] = null;
    if (session.merkleRoot) {
      const br = await prisma.blockchainReceipt.findUnique({
        where: { merkleRootId: session.merkleRoot.id },
        include: {
          transaction: true,
          receiptV2Events: { orderBy: { publishedAt: 'desc' }, take: 1 },
        },
      }).catch(() => null);

      if (br) {
        const ev = br.receiptV2Events?.[0] ?? null;
        const tx = br.transaction ?? null;
        const explorerBase = (config as any).arcExplorerUrl ?? 'https://testnet.arcscan.app';
        blockchain = {
          txHash: ev?.txHash ?? tx?.txHash ?? null,
          blockNumber: ev?.blockNumber ?? tx?.blockNumber ?? null,
          network: ev ? 'Arc Testnet' : (tx?.chain ?? null),
          registryId: br.onChainReceiptId ?? null,
          explorerUrl:
            tx?.explorerUrl ??
            (ev?.txHash ? `${explorerBase}/tx/${ev.txHash}` : null),
          anchoredAt: br.publishedAt?.toISOString() ?? null,
          merkleRoot: ev?.merkleRoot ?? session.merkleRoot?.rootHash ?? null,
          probability: br.probability ?? null,
          confidence: br.confidence ?? null,
          schemaVersion: br.schemaVersion ?? null,
          publisher: ev?.publisher ?? null,
          consumer: ev?.consumer ?? null,
          traceCid: ev?.traceCid ?? br.traceCid ?? null,
          traceHash: ev?.traceHash ?? br.traceHash ?? null,
        };
      }
    }

    // Payment receipt summary
    const entitlement = await prisma.paymentEntitlement.findFirst({
      where: { workflowId: sessionId },
      orderBy: { createdAt: 'desc' },
    });
    const receipt: VerificationDetail['receipt'] = entitlement
      ? {
          id: entitlement.id,
          amount: entitlement.amount.toString(),
          currency: entitlement.currency,
          paymentStatus: entitlement.paymentStatus,
          walletAddress: entitlement.walletAddress,
          paidAt: entitlement.paidAt?.toISOString() ?? null,
        }
      : null;

    return {
      sessionId: session.id,
      workflowId: session.workflowId,
      query: session.workflowId, // workflowId doubles as the blueprint/query ref
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      totalNodes: session.workflowNodes.length,
      completedNodes,
      integrityReport,
      merkle,
      blockchain,
      receipt,
    };
  }
}

export const verificationCenterService = new VerificationCenterService();
