// src/engine/verify/interfaces.ts
// ─────────────────────────────────────────────────────────────────────────────
// Type contracts for the Verification Engine.
// ─────────────────────────────────────────────────────────────────────────────

/** Result of a single node hash verification */
export interface NodeVerificationResult {
  nodeId: string;
  expectedHash: string;
  computedHash: string;
  isValid: boolean;
  status: 'VERIFIED' | 'TAMPERED' | 'MISSING';
  discrepancy?: string;
  verifiedAt: Date;
}

/** Result of a Merkle Proof verification */
export interface ProofVerificationResult {
  leafHash: string;
  rootHash: string;
  isValid: boolean;
  computedRoot: string;
  verifiedAt: Date;
  reason?: string;
}

/** Full report of a workflow's cryptographic integrity */
export interface WorkflowIntegrityReport {
  sessionId: string;
  workflowId: string;
  verificationTime: Date;
  totalNodes: number;
  verifiedNodesCount: number;
  tamperedNodesCount: number;
  missingNodesCount: number;
  tamperedNodes: string[]; // List of nodeIds that failed hash verification
  merkleRoot: string | null;
  isMerkleRootValid: boolean;
  overallResult: 'VERIFIED' | 'TAMPERED' | 'INCOMPLETE';
  integrityScore: number; // 0 to 100
  durationMs: number;
}
