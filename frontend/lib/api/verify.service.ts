// frontend/lib/api/verify.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Phase 24 — Verification Center API service.
// Wraps backend /verify/* and /workflow/:id/merkle endpoints.
// ─────────────────────────────────────────────────────────────────────────────

import apiClient from './client';
import { extractError } from './errors';
import type { ApiResponse } from './types';

// ── Shared types ─────────────────────────────────────────────────────────────

export interface MerkleProofStep {
  siblingHash: string;
  position: 'LEFT' | 'RIGHT';
}

export interface NodeVerificationResult {
  nodeId: string;
  expectedHash: string;
  computedHash: string;
  isValid: boolean;
  status: 'VERIFIED' | 'TAMPERED' | 'MISSING';
  discrepancy?: string;
  verifiedAt: string;
}

export interface ProofVerificationResult {
  leafHash: string;
  rootHash: string;
  isValid: boolean;
  computedRoot: string;
  verifiedAt: string;
  reason?: string;
}

export interface WorkflowIntegrityReport {
  sessionId: string;
  workflowId: string;
  verificationTime: string;
  totalNodes: number;
  verifiedNodesCount: number;
  tamperedNodesCount: number;
  missingNodesCount: number;
  tamperedNodes: string[];
  merkleRoot: string | null;
  isMerkleRootValid: boolean;
  overallResult: 'VERIFIED' | 'TAMPERED' | 'INCOMPLETE';
  integrityScore: number;
  durationMs: number;
}

export interface StoredMerkleProof {
  proofId: string;
  nodeId: string;
  leafHash: string;
  proof: MerkleProofStep[];
  proofDepth: number;
  isValid: boolean;
  createdAt: string;
}

export interface MerkleTreeData {
  treeId: string;
  sessionId: string;
  rootHash: string;
  leafCount: number;
  treeDepth: number;
  algorithm: string;
  generationMs: number;
  leaves: string[];
  createdAt: string;
  proofs: StoredMerkleProof[];
}

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

export interface VerificationListResponse {
  items: VerificationListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface VerificationDetail {
  // Workflow summary
  sessionId: string;
  workflowId: string;
  query: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  totalNodes: number;
  completedNodes: number;
  // Latest integrity report (raw JSON from backend — use unknown for safe casting)
  integrityReport: unknown;
  // Merkle tree
  merkle: MerkleTreeData | null;
  // Blockchain receipt
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
  // Payment receipt summary
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

export const verifyService = {
  /**
   * GET /verify/list — paginated list of all verified workflows for the user.
   */
  async list(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  } = {}): Promise<VerificationListResponse> {
    try {
      const res = await apiClient.get<ApiResponse<VerificationListResponse>>(
        '/verify/list',
        { params },
      );
      return (
        res.data.data ?? {
          items: [],
          pagination: { page: 1, limit: 15, total: 0, totalPages: 0 },
        }
      );
    } catch (err) {
      throw extractError(err, 'Failed to load verifications');
    }
  },

  /**
   * GET /verify/detail/:sessionId — full verification detail for one session.
   */
  async getDetail(sessionId: string): Promise<VerificationDetail> {
    try {
      const res = await apiClient.get<ApiResponse<VerificationDetail>>(
        `/verify/detail/${encodeURIComponent(sessionId)}`,
      );
      if (!res.data.data) throw new Error('Verification not found');
      return res.data.data;
    } catch (err) {
      throw extractError(err, 'Failed to load verification detail');
    }
  },

  /**
   * POST /verify/workflow — run a live integrity check on a session.
   */
  async verifyWorkflow(sessionId: string): Promise<WorkflowIntegrityReport> {
    try {
      const res = await apiClient.post<ApiResponse<WorkflowIntegrityReport>>(
        '/verify/workflow',
        { sessionId },
      );
      if (!res.data.data) throw new Error('Verification failed');
      return res.data.data;
    } catch (err) {
      throw extractError(err, 'Verification failed');
    }
  },

  /**
   * GET /workflow/:sessionId/merkle — retrieve Merkle tree + stored proofs.
   */
  async getMerkle(sessionId: string): Promise<MerkleTreeData> {
    try {
      const res = await apiClient.get<ApiResponse<MerkleTreeData>>(
        `/workflow/${encodeURIComponent(sessionId)}/merkle`,
      );
      if (!res.data.data) throw new Error('Merkle data not found');
      return res.data.data;
    } catch (err) {
      throw extractError(err, 'Failed to load Merkle tree');
    }
  },

  /**
   * POST /workflow/verify-proof — stateless Merkle proof verification.
   */
  async verifyProof(
    leafHash: string,
    proof: MerkleProofStep[],
    rootHash: string,
  ): Promise<ProofVerificationResult> {
    try {
      const res = await apiClient.post<ApiResponse<ProofVerificationResult>>(
        '/workflow/verify-proof',
        { leafHash, proof, rootHash },
      );
      if (!res.data.data) throw new Error('Proof verification failed');
      return res.data.data;
    } catch (err) {
      throw extractError(err, 'Failed to verify Merkle proof');
    }
  },
};
