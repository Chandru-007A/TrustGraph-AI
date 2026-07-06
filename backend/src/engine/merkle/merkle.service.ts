// src/engine/merkle/merkle.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// MerkleTreeService — Orchestrates tree building, persistence, and proofs.
//
// ARCHITECTURE ROLE:
//   Sits between the HTTP controller and the pure MerkleTree class.
//   Responsible for:
//     1. Fetching leaf hashes from the DB (NODE_HASH records)
//     2. Delegating pure math to MerkleTree class
//     3. Persisting MerkleRoot and MerkleProof records to PostgreSQL
//     4. Providing the verify-proof endpoint logic (stateless)
//
// WHAT IT NEVER DOES:
//   - Never hashes raw agent data (that is the Hash Engine's job)
//   - Never knows about sessions, users, or business rules
//     (that belongs in the controller/service layer above it)
//   - Never throws — wraps all errors in structured results
// ─────────────────────────────────────────────────────────────────────────────

import prisma from '../../utils/prisma';
import logger from '../../utils/logger';
import ApiError from '../../utils/ApiError';
import httpStatus from 'http-status';
import { MerkleTree } from './merkle.tree';
import {
  IMerkleTreeService,
  MerkleTreeResult,
  MerkleProof,
  MerkleProofStep,
  MerkleProofVerifyResult,
  PersistedMerkleTree,
  PersistedMerkleProof,
} from './interfaces';

export class MerkleTreeService implements IMerkleTreeService {
  // ─── Pure tree operations (delegated to MerkleTree) ───────────────────────

  buildTree(leaves: string[]): MerkleTreeResult {
    return MerkleTree.build(leaves);
  }

  generateProof(leafHash: string, tree: MerkleTreeResult): MerkleProof {
    return MerkleTree.generateProof(leafHash, tree);
  }

  verifyProof(
    leafHash: string,
    proof: MerkleProofStep[],
    rootHash: string,
  ): MerkleProofVerifyResult {
    return MerkleTree.verifyProof(leafHash, proof, rootHash);
  }

  // ─── Session-level orchestration ──────────────────────────────────────────

  /**
   * Build a Merkle tree for a workflow session and persist it to the DB.
   *
   * If `precomputedLeaves` is provided (engine path: MerkleQueueAgent
   * already has the canonical INPUT/OUTPUT leaves), use it directly.
   * Otherwise (controller path) fall back to fetching NODE_HASH records.
   *
   * Steps:
   *   1. Resolve the leaf hash list (provided or fetched)
   *   2. Guard: must have at least one leaf
   *   3. Build the tree in-memory
   *   4. Upsert the MerkleRoot record (idempotent — safe to call multiple times)
   *   5. Return the persisted record
   */
  async buildAndPersistForSession(
    sessionId: string,
    precomputedLeaves?: string[],
  ): Promise<PersistedMerkleTree> {
    logger.info(`[MerkleService] 🌲 Building Merkle tree for session ${sessionId}`);

    let leafHashes: string[];

    if (precomputedLeaves && precomputedLeaves.length > 0) {
      leafHashes = precomputedLeaves;
    } else {
      // Fall back to fetching NODE_HASH leaf hashes from the Hash table
      const nodeHashRecords = await prisma.workflowNode.findMany({
        where: { sessionId },
        include: {
          hashes: { where: { type: 'NODE_HASH' } },
        },
        orderBy: { stepIndex: 'asc' },
      });

      leafHashes = [];
      for (const node of nodeHashRecords) {
        const nodeHash = node.hashes[0];
        if (nodeHash) {
          leafHashes.push(nodeHash.hashValue);
        }
      }
    }

    if (leafHashes.length === 0) {
      throw new ApiError(
        httpStatus.UNPROCESSABLE_ENTITY,
        'No node hashes found for this session. Run POST /workflow/:id/hash first.',
      );
    }

    logger.info(`[MerkleService] Found ${leafHashes.length} leaf hashes — building tree...`);

    // Build the tree (in-memory, pure operation)
    const tree = MerkleTree.build(leafHashes);

    logger.info(
      `[MerkleService] ✅ Tree built — root: ${tree.rootHash.substring(0, 16)}... | depth: ${tree.treeDepth} | leaves: ${tree.leafCount} | ${tree.generationMs}ms`,
    );

    // Upsert the MerkleRoot record — idempotent, safe to call repeatedly
    const merkleRoot = await prisma.merkleRoot.upsert({
      where: { sessionId },
      create: {
        sessionId,
        rootHash: tree.rootHash,
        leafCount: tree.leafCount,
        treeDepth: tree.treeDepth,
        algorithm: tree.algorithm,
        generationMs: tree.generationMs,
        leaves: tree.leaves,
      },
      update: {
        rootHash: tree.rootHash,
        leafCount: tree.leafCount,
        treeDepth: tree.treeDepth,
        algorithm: tree.algorithm,
        generationMs: tree.generationMs,
        leaves: tree.leaves,
      },
    });

    return {
      treeId: merkleRoot.id,
      sessionId: merkleRoot.sessionId,
      rootHash: merkleRoot.rootHash,
      leafCount: merkleRoot.leafCount,
      treeDepth: merkleRoot.treeDepth,
      algorithm: merkleRoot.algorithm,
      generationMs: merkleRoot.generationMs,
      createdAt: merkleRoot.createdAt,
    };
  }

  /**
   * Retrieve the persisted MerkleRoot for a session.
   */
  async getForSession(sessionId: string): Promise<PersistedMerkleTree & { proofs: PersistedMerkleProof[] }> {
    const merkleRoot = await prisma.merkleRoot.findUnique({
      where: { sessionId },
      include: { proofs: true },
    });

    if (!merkleRoot) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        'Merkle tree not found for this session. Run POST /workflow/:id/merkle first.',
      );
    }

    return {
      treeId: merkleRoot.id,
      sessionId: merkleRoot.sessionId,
      rootHash: merkleRoot.rootHash,
      leafCount: merkleRoot.leafCount,
      treeDepth: merkleRoot.treeDepth,
      algorithm: merkleRoot.algorithm,
      generationMs: merkleRoot.generationMs,
      createdAt: merkleRoot.createdAt,
      proofs: merkleRoot.proofs.map((p) => ({
        proofId: p.id,
        merkleRootId: p.merkleRootId,
        nodeId: p.nodeId,
        leafHash: p.leafHash,
        proof: p.proof as unknown as MerkleProofStep[],
        proofDepth: p.proofDepth,
        isValid: p.isValid,
        createdAt: p.createdAt,
      })),
    };
  }

  /**
   * Generate and persist a Merkle proof for a specific WorkflowNode.
   *
   * The proof enables any third party to independently verify that a specific
   * node's hash was included in the Merkle tree, without seeing other nodes.
   *
   * Steps:
   *   1. Load the session's MerkleRoot (must exist — call buildAndPersistForSession first)
   *   2. Find the NODE_HASH for the requested nodeId
   *   3. Rebuild the in-memory tree from the persisted leaves
   *   4. Generate the sibling path proof
   *   5. Persist the MerkleProof to DB
   *   6. Return the proof record
   */
  async generateAndPersistProof(
    sessionId: string,
    nodeId: string,
  ): Promise<PersistedMerkleProof> {
    logger.info(`[MerkleService] 🔍 Generating proof for node ${nodeId}`);

    // Load existing Merkle root (must exist)
    const merkleRoot = await prisma.merkleRoot.findUnique({
      where: { sessionId },
    });

    if (!merkleRoot) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        'Merkle tree not found. Run POST /workflow/:id/merkle first.',
      );
    }

    // Get the NODE_HASH for this specific node.
    // The verify engine may have suffixed the type (NODE_HASH_VERIFIED /
    // NODE_HASH_TAMPERED) — use startsWith to match either form.
    const hashRecord = await prisma.hash.findFirst({
      where: { nodeId, type: { startsWith: 'NODE_HASH' } },
      orderBy: { createdAt: 'desc' },
    });

    if (!hashRecord) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        `No NODE_HASH found for node ${nodeId}. Run POST /workflow/:id/hash first.`,
      );
    }

    const leafHash = hashRecord.hashValue;

    // Rebuild the tree from the persisted leaves
    const tree = MerkleTree.build(merkleRoot.leaves);

    // Generate the proof
    let proof: MerkleProof;
    try {
      proof = MerkleTree.generateProof(leafHash, tree);
    } catch (err: any) {
      throw new ApiError(
        httpStatus.UNPROCESSABLE_ENTITY,
        `Cannot generate proof: ${err.message}`,
      );
    }

    // Persist the proof (upsert — idempotent per nodeId+merkleRootId)
    const existing = await prisma.merkleProof.findFirst({
      where: { merkleRootId: merkleRoot.id, nodeId },
    });

    let proofRecord;
    if (existing) {
      proofRecord = await prisma.merkleProof.update({
        where: { id: existing.id },
        data: {
          leafHash,
          proof: proof.path as any,
          proofDepth: proof.path.length,
          isValid: true,
        },
      });
    } else {
      proofRecord = await prisma.merkleProof.create({
        data: {
          merkleRootId: merkleRoot.id,
          nodeId,
          leafHash,
          proof: proof.path as any,
          proofDepth: proof.path.length,
          isValid: true,
        },
      });
    }

    logger.info(
      `[MerkleService] ✅ Proof generated for node ${nodeId} — depth: ${proof.path.length}`,
    );

    return {
      proofId: proofRecord.id,
      merkleRootId: proofRecord.merkleRootId,
      nodeId: proofRecord.nodeId,
      leafHash: proofRecord.leafHash,
      proof: proofRecord.proof as unknown as MerkleProofStep[],
      proofDepth: proofRecord.proofDepth,
      isValid: proofRecord.isValid,
      createdAt: proofRecord.createdAt,
    };
  }
}

// Singleton — one instance per process
export const merkleTreeService = new MerkleTreeService();
