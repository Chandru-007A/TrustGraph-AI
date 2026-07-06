// src/engine/hash/interfaces.ts
// ─────────────────────────────────────────────────────────────────────────────
// Type contracts for the Hash Engine.
//
// DESIGN: Strictly typed. The HashEngine never touches raw agent data —
//         it receives a HashableNode (a sanitized snapshot) and produces
//         a deterministic HashRecord.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Input contract ────────────────────────────────────────────────────────────

/**
 * The canonical snapshot of a DAG node that is hashed.
 * EVERY field that participates in the hash must be declared here.
 * Adding new fields is a BREAKING CHANGE — old hashes won't verify.
 */
export interface HashableNode {
  /** The WorkflowNode.id from PostgreSQL */
  nodeId: string;

  /** The human-readable stage name (e.g., "PlannerNode") */
  stageName: string;

  /** IDs of parent nodes in the DAG */
  parentNodeIds: string[];

  /** IDs of child nodes in the DAG */
  childNodeIds: string[];

  /** The SHA-256 of the raw input passed to the agent */
  inputHash: string;

  /** The SHA-256 of the raw output produced by the agent */
  outputHash: string;

  /** When this node started execution (ISO 8601 string — timezone-safe) */
  timestamp: string;

  /** How long execution took, in milliseconds */
  executionDurationMs: number;

  /** The DID of the agent that executed this node */
  agentDid: string;

  /** The 0-based position in the pipeline */
  stepIndex: number;

  /** The status of the node at the time of hashing */
  status: string;

  /** Arbitrary metadata — must be deterministically serializable */
  metadata: Record<string, unknown>;
}

// ─── Output contract ───────────────────────────────────────────────────────────

/**
 * The result of a hash computation.
 * Written to the Hash table and returned to callers.
 */
export interface HashRecord {
  /** The DB Hash.id */
  hashId: string;

  /** The WorkflowNode.id this hash belongs to */
  nodeId: string;

  /** Algorithm used (currently always 'SHA-256') */
  algorithm: 'SHA-256';

  /** The hex-encoded hash value */
  hashValue: string;

  /** When the hash was computed */
  createdAt: Date;

  /** Whether the hash has been independently verified */
  verificationStatus: HashVerificationStatus;
}

export type HashVerificationStatus = 'UNVERIFIED' | 'VERIFIED' | 'TAMPERED';

// ─── Verification contract ─────────────────────────────────────────────────────

export interface VerifyHashInput {
  /** The nodeId to re-hash and compare */
  nodeId: string;

  /** The hash value to verify against */
  expectedHash: string;
}

export interface VerifyHashResult {
  nodeId: string;
  expectedHash: string;
  computedHash: string;
  isValid: boolean;
  verifiedAt: Date;
  discrepancy?: string;
}

// ─── Batch result contract ─────────────────────────────────────────────────────

export interface BatchHashResult {
  sessionId: string;
  totalNodes: number;
  successCount: number;
  failedCount: number;
  hashes: HashRecord[];
  errors: Array<{ nodeId: string; error: string }>;
  completedAt: Date;
  totalDurationMs: number;
}

// ─── Service interface ─────────────────────────────────────────────────────────

/**
 * Contract that any hash service must implement.
 * Allows swapping SHA-256 for SHA-3 or Keccak-256 without touching callers.
 */
export interface IHashService {
  /**
   * Generate a deterministic hash for a single DAG node.
   * Persists the hash to the DB automatically.
   */
  generateHash(node: HashableNode): Promise<HashRecord>;

  /**
   * Verify a previously computed hash by re-hashing the node.
   * Updates the verificationStatus in the DB.
   */
  verifyHash(input: VerifyHashInput): Promise<VerifyHashResult>;

  /**
   * Re-compute the hash of a node (e.g., after a field was corrected).
   * Creates a new Hash record — preserves the old one for audit trail.
   */
  rehash(node: HashableNode): Promise<HashRecord>;

  /**
   * Generate hashes for all nodes in a session in parallel.
   */
  hashSession(sessionId: string): Promise<BatchHashResult>;
}
