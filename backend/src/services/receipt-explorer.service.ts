// src/services/receipt-explorer.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Phase 23 — Receipt Explorer Service
//
// Provides the data layer for the frontend receipt explorer:
//   GET /receipt/list       — paginated receipt list for a user
//   GET /receipt/:id        — full receipt detail (re-uses existing endpoint shape)
//   GET /receipt/:id/download — JSON / PDF blob
//
// The "receipt" concept in Phase 23 spans two Prisma models:
//   - PaymentEntitlement  (x402 payment state — per node)
//   - BlockchainReceipt   (on-chain anchor — per node or per session)
//
// A Phase 23 receipt row is a JOIN across both, enriched with the
// parent ResearchSession and the linked Transaction explorer URL.
// ─────────────────────────────────────────────────────────────────────────────

import httpStatus from 'http-status';
import prisma from '../utils/prisma';
import ApiError from '../utils/ApiError';
import config from '../config/config';

// ── Types ────────────────────────────────────────────────────────────────────

export type ReceiptVerificationStatus = 'verified' | 'pending' | 'failed' | 'unverified';

export interface ReceiptListRow {
  id: string;
  workflowId: string;
  workflowName: string | null;
  nodeId: string;
  nodeName: string | null;
  amount: string;
  currency: string;
  paymentStatus: string;
  verificationStatus: ReceiptVerificationStatus;
  txHash: string | null;
  merkleRoot: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlockchainAnchor {
  txHash: string | null;
  blockNumber: number | null;
  network: string | null;
  merkleRoot: string | null;
  registryId: string | null;
  confirmations: number | null;
  explorerUrl: string | null;
  anchoredAt: string | null;
}

export interface TimelineEvent {
  event: string;
  timestamp: string | null;
  done: boolean;
}

export interface ReceiptDetail extends ReceiptListRow {
  walletAddress: string | null;
  paymentReference: string;
  paidAt: string | null;
  x402Reference: string | null;
  gatewayStatus: string | null;
  connector: string | null;
  blockchain: BlockchainAnchor | null;
  timeline: TimelineEvent[];
}

export interface ListReceiptsParams {
  userId: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sort?: 'newest' | 'oldest';
}

export interface ListReceiptsResult {
  receipts: ReceiptListRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ── Service ──────────────────────────────────────────────────────────────────

class ReceiptExplorerService {
  /**
   * Paginated list of receipts for a user.
   * Joins PaymentEntitlement → ResearchSession → WorkflowNode → BlockchainReceipt → Transaction.
   */
  async list(params: ListReceiptsParams): Promise<ListReceiptsResult> {
    const {
      userId,
      page = 1,
      limit = 15,
      search = '',
      status,
      sort = 'newest',
    } = params;

    const skip = (page - 1) * limit;
    const q = search.trim().toLowerCase();

    // Fetch all entitlements for this user's sessions, then enrich
    const [entitlements, total] = await Promise.all([
      prisma.paymentEntitlement.findMany({
        where: {
          // Only rows belonging to this user's sessions
          workflowId: {
            in: await this._getUserWorkflowIds(userId),
          },
          ...(status && status !== 'ALL'
            ? { paymentStatus: status }
            : {}),
        },
        orderBy: { createdAt: sort === 'newest' ? 'desc' : 'asc' },
        skip,
        take: limit,
      }),
      prisma.paymentEntitlement.count({
        where: {
          workflowId: { in: await this._getUserWorkflowIds(userId) },
          ...(status && status !== 'ALL' ? { paymentStatus: status } : {}),
        },
      }),
    ]);

    // Filter by search term in-memory (id, workflowId, nodeId, facilitatorReference)
    const filtered = q
      ? entitlements.filter(
          (e) =>
            e.id.toLowerCase().includes(q) ||
            e.workflowId.toLowerCase().includes(q) ||
            e.nodeId.toLowerCase().includes(q) ||
            (e.facilitatorReference ?? '').toLowerCase().includes(q),
        )
      : entitlements;

    // Enrich with node name + blockchain receipt
    const rows = await Promise.all(filtered.map((e) => this._toListRow(e)));

    return {
      receipts: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Full receipt detail for a single PaymentEntitlement id.
   * Validates that the entitlement belongs to the requesting user's session.
   */
  async getDetail(receiptId: string, userId: string): Promise<ReceiptDetail> {
    const entitlement = await prisma.paymentEntitlement.findUnique({
      where: { id: receiptId },
    });

    if (!entitlement) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Receipt not found');
    }

    // Ownership check — the workflowId must belong to one of this user's sessions
    const session = await prisma.researchSession.findFirst({
      where: { id: entitlement.workflowId, userId },
      include: { merkleRoot: true },
    });

    if (!session) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'You do not have access to this receipt',
      );
    }

    // Resolve workflow node
    const node = await prisma.workflowNode.findFirst({
      where: { id: entitlement.nodeId },
      include: {
        blockchainReceipt: {
          include: {
            transaction: true,
            receiptV2Events: { orderBy: { publishedAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    // Resolve wallet connector
    const wallet = entitlement.walletAddress
      ? await prisma.wallet.findFirst({
          where: { address: entitlement.walletAddress },
        })
      : null;

    // Resolve gateway transaction for gateway status
    const gatewayTx = await prisma.gatewayTransaction.findFirst({
      where: { paymentReference: entitlement.paymentReference },
      orderBy: { createdAt: 'desc' },
    });

    // Verification status derivation
    const blockchainReceipt = node?.blockchainReceipt;
    const verificationStatus = this._deriveVerificationStatus(
      blockchainReceipt?.registrationStatus ?? null,
    );

    // Blockchain anchor
    const latestEvent =
      blockchainReceipt?.receiptV2Events?.[0] ?? null;
    const tx = blockchainReceipt?.transaction ?? null;
    const explorerBase =
      (config as any).arcExplorerUrl ?? 'https://testnet.arcscan.app';

    const blockchain: BlockchainAnchor | null = blockchainReceipt
      ? {
          txHash: latestEvent?.txHash ?? tx?.txHash ?? null,
          blockNumber: latestEvent?.blockNumber ?? tx?.blockNumber ?? null,
          network: latestEvent ? 'Arc Testnet' : (tx?.chain ?? null),
          merkleRoot: latestEvent?.merkleRoot ?? session.merkleRoot?.rootHash ?? null,
          registryId: blockchainReceipt.onChainReceiptId ?? null,
          confirmations: null, // Would require live RPC call
          explorerUrl: tx?.explorerUrl ??
            (latestEvent?.txHash
              ? `${explorerBase}/tx/${latestEvent.txHash}`
              : null),
          anchoredAt: blockchainReceipt.publishedAt?.toISOString() ?? null,
        }
      : null;

    // Timeline
    const timeline = this._buildTimeline({
      sessionCreatedAt: session.createdAt,
      merkleCreatedAt: session.merkleRoot?.createdAt ?? null,
      entitlementCreatedAt: entitlement.createdAt,
      paidAt: entitlement.paidAt,
      anchoredAt: blockchainReceipt?.publishedAt ?? null,
      verificationStatus,
      nodeStatus: node?.status ?? null,
    });

    return {
      id: entitlement.id,
      workflowId: entitlement.workflowId,
      workflowName: null, // ResearchSession.workflowId is the blueprint id — no human name stored
      nodeId: entitlement.nodeId,
      nodeName: node?.nodeName ?? null,
      amount: entitlement.amount.toString(),
      currency: entitlement.currency,
      paymentStatus: entitlement.paymentStatus,
      verificationStatus,
      txHash: latestEvent?.txHash ?? tx?.txHash ?? null,
      merkleRoot: latestEvent?.merkleRoot ?? session.merkleRoot?.rootHash ?? null,
      createdAt: entitlement.createdAt.toISOString(),
      updatedAt: entitlement.updatedAt.toISOString(),
      // Payment extras
      walletAddress: entitlement.walletAddress,
      paymentReference: entitlement.paymentReference,
      paidAt: entitlement.paidAt?.toISOString() ?? null,
      x402Reference: entitlement.facilitatorReference,
      gatewayStatus: gatewayTx?.status ?? null,
      connector: wallet?.connector ?? null,
      blockchain,
      timeline,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Returns all workflowIds (ResearchSession.id) owned by a user */
  private async _getUserWorkflowIds(userId: string): Promise<string[]> {
    const sessions = await prisma.researchSession.findMany({
      where: { userId },
      select: { id: true },
    });
    return sessions.map((s) => s.id);
  }

  /** Convert a raw PaymentEntitlement to a ReceiptListRow */
  private async _toListRow(e: {
    id: string;
    workflowId: string;
    nodeId: string;
    amount: { toString(): string };
    currency: string;
    paymentStatus: string;
    facilitatorReference: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<ReceiptListRow> {
    const node = await prisma.workflowNode.findFirst({
      where: { id: e.nodeId },
      select: {
        nodeName: true,
        blockchainReceipt: {
          include: {
            transaction: { select: { txHash: true } },
            receiptV2Events: {
              select: { txHash: true, merkleRoot: true },
              orderBy: { publishedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    const latestEvent = node?.blockchainReceipt?.receiptV2Events?.[0] ?? null;
    const tx = node?.blockchainReceipt?.transaction ?? null;
    const verificationStatus = this._deriveVerificationStatus(
      node?.blockchainReceipt?.registrationStatus ?? null,
    );

    return {
      id: e.id,
      workflowId: e.workflowId,
      workflowName: null,
      nodeId: e.nodeId,
      nodeName: node?.nodeName ?? null,
      amount: e.amount.toString(),
      currency: e.currency,
      paymentStatus: e.paymentStatus,
      verificationStatus,
      txHash: latestEvent?.txHash ?? tx?.txHash ?? e.facilitatorReference ?? null,
      merkleRoot: latestEvent?.merkleRoot ?? null,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  }

  private _deriveVerificationStatus(
    registrationStatus: string | null,
  ): ReceiptVerificationStatus {
    if (!registrationStatus || registrationStatus === 'PENDING') return 'pending';
    if (registrationStatus === 'REGISTERED') return 'verified';
    if (registrationStatus === 'FAILED') return 'failed';
    return 'unverified';
  }

  private _buildTimeline(opts: {
    sessionCreatedAt: Date;
    merkleCreatedAt: Date | null;
    entitlementCreatedAt: Date;
    paidAt: Date | null;
    anchoredAt: Date | null;
    verificationStatus: ReceiptVerificationStatus;
    nodeStatus: string | null;
  }): TimelineEvent[] {
    return [
      {
        event: 'Workflow Started',
        timestamp: opts.sessionCreatedAt.toISOString(),
        done: true,
      },
      {
        event: 'Merkle Tree Generated',
        timestamp: opts.merkleCreatedAt?.toISOString() ?? null,
        done: !!opts.merkleCreatedAt,
      },
      {
        event: 'Receipt Created',
        timestamp: opts.entitlementCreatedAt.toISOString(),
        done: true,
      },
      {
        event: 'Payment Completed',
        timestamp: opts.paidAt?.toISOString() ?? null,
        done: !!opts.paidAt,
      },
      {
        event: 'Blockchain Anchored',
        timestamp: opts.anchoredAt?.toISOString() ?? null,
        done: !!opts.anchoredAt,
      },
      {
        event: 'Verification Successful',
        timestamp: opts.anchoredAt?.toISOString() ?? null,
        done: opts.verificationStatus === 'verified',
      },
      {
        event: 'Node Unlocked',
        timestamp: opts.paidAt?.toISOString() ?? null,
        done: opts.nodeStatus === 'COMPLETED' && !!opts.paidAt,
      },
    ];
  }
}

export const receiptExplorerService = new ReceiptExplorerService();
