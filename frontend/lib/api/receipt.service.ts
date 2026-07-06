// frontend/lib/api/receipt.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Phase 23 — Receipt Explorer API service.
// Wraps the backend `/receipt/*` endpoints.  All methods throw `Error` with a
// user-friendly message so sonner toasts display a clean string.
// ─────────────────────────────────────────────────────────────────────────────

import apiClient from './client';
import { extractError } from './errors';
import type { ApiResponse } from './types';
import type { PaymentEntitlementStatus } from './payment.service';

// ── Wire types (mirror Prisma model + backend serialiser) ───────────────────

export type ReceiptVerificationStatus = 'verified' | 'pending' | 'failed' | 'unverified';

export interface BlockchainAnchor {
  txHash: string | null;
  blockNumber: number | null;
  network: string | null;
  merkleRoot: string | null;
  registryId: string | null;        // ReceiptRegistryV2 on-chain ID
  confirmations: number | null;
  explorerUrl: string | null;       // stored by backend, never hardcoded here
  anchoredAt: string | null;
}

export interface ReceiptRow {
  /** Primary key — UUID from Prisma */
  id: string;
  /** The ResearchSession this receipt belongs to */
  workflowId: string;
  /** Human-readable workflow name / query (truncated) */
  workflowName: string | null;
  /** The WorkflowNode that was paid for */
  nodeId: string;
  nodeName: string | null;
  /** Human-readable amount e.g. "0.005" */
  amount: string;
  currency: string;
  paymentStatus: PaymentEntitlementStatus;
  verificationStatus: ReceiptVerificationStatus;
  /** tx hash from the facilitator / Arc */
  txHash: string | null;
  merkleRoot: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptTimeline {
  event: string;
  timestamp: string | null;
  done: boolean;
}

export interface ReceiptDetail extends ReceiptRow {
  // ── Payment ─────────────────────────────────────────────────────────
  walletAddress: string | null;
  paymentReference: string;
  paidAt: string | null;
  /** x402 challenge reference */
  x402Reference: string | null;
  /** Circle / facilitator gateway status */
  gatewayStatus: string | null;
  /** Wallet connector e.g. "metaMask" */
  connector: string | null;

  // ── Blockchain ───────────────────────────────────────────────────────
  blockchain: BlockchainAnchor | null;

  // ── Timeline ─────────────────────────────────────────────────────────
  timeline: ReceiptTimeline[];
}

export interface ReceiptsListResponse {
  receipts: ReceiptRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ReceiptsListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sort?: 'newest' | 'oldest';
}

// ── Service ─────────────────────────────────────────────────────────────────

export const receiptService = {
  /**
   * GET /receipt/list — paginated receipt list for the authenticated user.
   * Backend applies search (id, workflowId, txHash, nodeName) + filters.
   */
  async list(params: ReceiptsListParams = {}): Promise<ReceiptsListResponse> {
    try {
      const res = await apiClient.get<ApiResponse<ReceiptsListResponse>>(
        '/receipt/list',
        { params },
      );
      return res.data.data ?? { receipts: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    } catch (err) {
      throw extractError(err, 'Failed to load receipts');
    }
  },

  /**
   * GET /receipt/:receiptId — full receipt detail including blockchain anchor
   * and activity timeline.
   */
  async getDetail(receiptId: string): Promise<ReceiptDetail> {
    try {
      const res = await apiClient.get<ApiResponse<ReceiptDetail>>(
        `/receipt/detail/${encodeURIComponent(receiptId)}`,
      );
      if (!res.data.data) throw new Error('Receipt not found');
      return res.data.data;
    } catch (err) {
      throw extractError(err, 'Failed to load receipt');
    }
  },

  /**
   * GET /receipt/:receiptId/download?format=json|pdf
   * Returns a Blob for download.
   */
  async download(receiptId: string, format: 'json' | 'pdf'): Promise<Blob> {
    try {
      const res = await apiClient.get(
        `/receipt/detail/${encodeURIComponent(receiptId)}/download`,
        { params: { format }, responseType: 'blob' },
      );
      return res.data as Blob;
    } catch (err) {
      throw extractError(err, `Failed to download receipt as ${format.toUpperCase()}`);
    }
  },
};
