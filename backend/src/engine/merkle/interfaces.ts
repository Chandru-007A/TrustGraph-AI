// src/engine/merkle/interfaces.ts
// ─────────────────────────────────────────────────────────────────────────────
// Type contracts for the Merkle Tree Engine.
//
// DESIGN: The engine operates on raw hash strings (hex-encoded SHA-256).
//         It knows nothing about WorkflowNodes, agents, or sessions —
//         those concerns belong to the service layer above it.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Tree construction ─────────────────────────────────────────────────────────

/** Position of a sibling node in a Merkle proof path */
export type ProofNodePosition = 'LEFT' | 'RIGHT';

/** A single step in the sibling path from leaf to root */
export interface MerkleProofStep {
  /** The sibling hash at this level of the tree */
  siblingHash: string;
  /** Whether the sibling is on the LEFT or RIGHT of the current hash */
  position: ProofNodePosition;
}

/** The full Merkle proof for a single leaf */
export interface MerkleProof {
  /** The leaf hash being proven */
  leafHash: string;
  /** The root hash this proof verifies against */
  rootHash: string;
  /** Ordered sibling path from leaf (index 0) to root (last index) */
  path: MerkleProofStep[];
  /** Tree depth at proof generation time */
  treeDepth: number;
  /** Leaf index (0-based) in the sorted leaf array */
  leafIndex: number;
}

/** The full result of building a Merkle tree */
export interface MerkleTreeResult {
  /** The Merkle root hash (hex SHA-256) */
  rootHash: string;
  /** Ordered leaf hashes (after sorting) — preserved for later proof generation */
  leaves: string[];
  /** Depth of the binary tree (log2 of leaf count, rounded up) */
  treeDepth: number;
  /** Total number of leaves */
  leafCount: number;
  /** Algorithm used */
  algorithm: 'SHA-256';
  /** Full tree layers for debugging (layer[0] = leaves, last layer = [rootHash]) */
  layers: string[][];
  /** How long the tree took to build in milliseconds */
  generationMs: number;
}

/** The result of verifying a Merkle proof */
export interface MerkleProofVerifyResult {
  leafHash: string;
  rootHash: string;
  isValid: boolean;
  computedRoot: string;
  verifiedAt: Date;
  reason?: string;
}

// ─── Persisted records ─────────────────────────────────────────────────────────

/** The DB record returned after persisting a Merkle tree */
export interface PersistedMerkleTree {
  treeId: string;
  sessionId: string;
  rootHash: string;
  leafCount: number;
  treeDepth: number;
  algorithm: string;
  generationMs: number;
  createdAt: Date;
}

/** The DB record returned after persisting a Merkle proof */
export interface PersistedMerkleProof {
  proofId: string;
  merkleRootId: string;
  nodeId: string;
  leafHash: string;
  proof: MerkleProofStep[];
  proofDepth: number;
  isValid: boolean;
  createdAt: Date;
}

// ─── Service interface ─────────────────────────────────────────────────────────

/** Contract for the Merkle Tree Service — swappable for SHA-3 / Keccak-256 */
export interface IMerkleTreeService {
  /**
   * Build a Merkle tree from an ordered list of leaf hashes.
   * Pure in-memory operation — does NOT write to DB.
   */
  buildTree(leaves: string[]): MerkleTreeResult;

  /**
   * Generate a Merkle proof for a specific leaf hash.
   * The proof is the minimal set of sibling hashes needed to reconstruct the root.
   */
  generateProof(leafHash: string, tree: MerkleTreeResult): MerkleProof;

  /**
   * Verify that a leaf hash is a member of the tree with the given root.
   * Reconstructs the root by walking the proof path — no tree required.
   */
  verifyProof(
    leafHash: string,
    proof: MerkleProofStep[],
    rootHash: string,
  ): MerkleProofVerifyResult;

  /**
   * Build the tree for a session, persist it to DB, and return the record.
   * Fetches NODE_HASH records from the Hash table as leaves.
   */
  buildAndPersistForSession(sessionId: string): Promise<PersistedMerkleTree>;

  /**
   * Generate and persist a proof for a specific WorkflowNode.
   */
  generateAndPersistProof(
    sessionId: string,
    nodeId: string,
  ): Promise<PersistedMerkleProof>;
}
