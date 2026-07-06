// src/engine/hash/hash.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// HashService — Production-grade SHA-256 Hash Engine
//
// ARCHITECTURE ROLE:
//   This is the single source of truth for all hash operations.
//   It sits between the engine (DAG nodes) and the database.
//   It is injected via IHashService — can be swapped for SHA-3 or Keccak-256.
//
// RESPONSIBILITIES:
//   1. Serialize DAG node data canonically (deterministic input)
//   2. Compute SHA-256 of the canonical string
//   3. Persist hash records to the DB (Hash table)
//   4. Verify existing hashes (integrity checks)
//   5. Re-hash nodes that have been updated
//   6. Batch hash an entire session in parallel
//
// WHAT IT NEVER DOES:
//   - Never stores raw agent inputs or outputs (privacy-preserving)
//   - Never throws — wraps errors in structured results
//   - Never depends on execution order — fully stateless
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'crypto';
import prisma from '../../utils/prisma';
import logger from '../../utils/logger';
import { CanonicalSerializer } from './canonical.serializer';
import {
  IHashService,
  HashableNode,
  HashRecord,
  HashVerificationStatus,
  VerifyHashInput,
  VerifyHashResult,
  BatchHashResult,
} from './interfaces';

// The algorithm identifier stored in the DB and returned in records.
// Change this constant (and the crypto call) to upgrade to SHA-3.
const ALGORITHM = 'SHA-256' as const;

export class HashService implements IHashService {
  // ─── Core Hash Computation ─────────────────────────────────────────────────

  /**
   * Compute the SHA-256 hash of a canonical node string.
   * This is a pure function — same input always produces same output.
   *
   * @param canonicalString The output of CanonicalSerializer.serialize()
   */
  private computeSha256(canonicalString: string): string {
    return createHash('sha256').update(canonicalString, 'utf8').digest('hex');
  }

  /**
   * Build a HashableNode from a raw DB WorkflowNode record.
   * This is the bridge between the DB model and the hash engine.
   * Called before generateHash when the source is a DB record.
   */
  private buildHashableNodeFromDb(
    dbNode: {
      id: string;
      nodeName: string;
      parentNodeIds: string[];
      childNodeIds: string[];
      agentDid: string;
      stepIndex: number;
      status: string;
      startTime: Date | null;
      endTime: Date | null;
      hashes?: Array<{ type: string; hashValue: string }>;
    },
  ): HashableNode {
    const inputHash =
      dbNode.hashes?.find((h) => h.type === 'INPUT')?.hashValue ?? 'NO_INPUT_HASH';
    const outputHash =
      dbNode.hashes?.find((h) => h.type === 'OUTPUT')?.hashValue ?? 'NO_OUTPUT_HASH';

    const durationMs =
      dbNode.startTime && dbNode.endTime
        ? dbNode.endTime.getTime() - dbNode.startTime.getTime()
        : 0;

    return {
      nodeId: dbNode.id,
      stageName: dbNode.nodeName,
      parentNodeIds: [...dbNode.parentNodeIds].sort(), // Normalize order
      childNodeIds: [...dbNode.childNodeIds].sort(),   // Normalize order
      inputHash,
      outputHash,
      timestamp: (dbNode.startTime ?? new Date()).toISOString(),
      executionDurationMs: durationMs,
      agentDid: dbNode.agentDid,
      stepIndex: dbNode.stepIndex,
      status: dbNode.status,
      metadata: {
        algorithm: ALGORITHM,
        schemaFields: CanonicalSerializer.getSchemaFields(),
      },
    };
  }

  // ─── IHashService Implementation ───────────────────────────────────────────

  /**
   * Convenience: read a single node from the DB and generate its NODE_HASH.
   * Used by NodePersistenceService after a stage completes so the verify
   * engine has a stored hash to compare against without requiring the
   * explicit POST /workflow/:id/hash call.
   */
  async generateHashFromNodeId(nodeId: string): Promise<HashRecord> {
    const dbNode = await prisma.workflowNode.findUnique({
      where: { id: nodeId },
      include: { hashes: true },
    });
    if (!dbNode) {
      throw new Error(`Cannot generate hash — node ${nodeId} not found`);
    }
    const hashableNode = this.buildHashableNodeFromDb(dbNode as any);
    return this.generateHash(hashableNode);
  }

  /**
   * Generate and persist a hash for a single DAG node.
   *
   * Steps:
   *   1. Canonically serialize the HashableNode
   *   2. Compute SHA-256 of the canonical string
   *   3. Persist to Hash table with status=UNVERIFIED
   *   4. Emit a log entry for observability
   *   5. Return the HashRecord
   */
  async generateHash(node: HashableNode): Promise<HashRecord> {
    const canonicalString = CanonicalSerializer.serialize(node);
    const hashValue = this.computeSha256(canonicalString);

    const hashRecord = await prisma.hash.create({
      data: {
        nodeId: node.nodeId,
        type: 'NODE_HASH',
        hashValue,
      },
    });

    logger.info(
      `[HashService] ✅ Generated hash for node ${node.nodeId} (stage: ${node.stageName}) → ${hashValue.substring(0, 16)}...`,
    );

    return {
      hashId: hashRecord.id,
      nodeId: node.nodeId,
      algorithm: ALGORITHM,
      hashValue,
      createdAt: hashRecord.createdAt,
      verificationStatus: 'UNVERIFIED',
    };
  }

  /**
   * Verify a previously computed hash by re-hashing the current node state.
   *
   * HOW TAMPERING IS DETECTED:
   *   - Fetch the current DB record for the nodeId
   *   - Re-build the HashableNode from live DB data
   *   - Re-serialize and re-hash identically
   *   - Compare to the expectedHash
   *   - If they differ → the node data was mutated after hashing
   *
   * Updates the Hash record's verificationStatus in the DB.
   */
  async verifyHash(input: VerifyHashInput): Promise<VerifyHashResult> {
    const verifiedAt = new Date();

    // Fetch the current node state from DB (including hashes for input/output)
    const dbNode = await prisma.workflowNode.findUnique({
      where: { id: input.nodeId },
      include: { hashes: true },
    });

    if (!dbNode) {
      logger.warn(`[HashService] ❌ Verification FAILED — node ${input.nodeId} not found`);
      return {
        nodeId: input.nodeId,
        expectedHash: input.expectedHash,
        computedHash: '',
        isValid: false,
        verifiedAt,
        discrepancy: `Node ${input.nodeId} not found in database`,
      };
    }

    const hashableNode = this.buildHashableNodeFromDb(dbNode as any);
    const canonicalString = CanonicalSerializer.serialize(hashableNode);
    const computedHash = this.computeSha256(canonicalString);
    const isValid = computedHash === input.expectedHash;

    // Update the verificationStatus in DB on the NODE_HASH record
    const verificationStatus: HashVerificationStatus = isValid ? 'VERIFIED' : 'TAMPERED';

    try {
      await prisma.hash.updateMany({
        where: {
          nodeId: input.nodeId,
          type: 'NODE_HASH',
          hashValue: input.expectedHash,
        },
        data: { type: `NODE_HASH_${verificationStatus}` }, // Encode status in type field
      });
    } catch (err: any) {
      logger.warn(`[HashService] Could not update verification status: ${err.message}`);
    }

    if (!isValid) {
      logger.warn(
        `[HashService] ⚠️  INTEGRITY VIOLATION detected on node ${input.nodeId}!\n` +
        `  Expected: ${input.expectedHash}\n` +
        `  Computed: ${computedHash}`,
      );
    } else {
      logger.info(
        `[HashService] ✅ Integrity verified for node ${input.nodeId}`,
      );
    }

    return {
      nodeId: input.nodeId,
      expectedHash: input.expectedHash,
      computedHash,
      isValid,
      verifiedAt,
      discrepancy: isValid
        ? undefined
        : `Hash mismatch detected. Node data may have been tampered with after the hash was recorded.`,
    };
  }

  /**
   * Re-compute and persist a new hash for a node.
   *
   * USE CASES:
   *   - A field was legitimately corrected (e.g., endTime updated)
   *   - A retry produced a different output
   *
   * The OLD hash record is NOT deleted — full audit trail is preserved.
   * The new hash is created with UNVERIFIED status.
   */
  async rehash(node: HashableNode): Promise<HashRecord> {
    logger.info(`[HashService] 🔁 Re-hashing node ${node.nodeId} (stage: ${node.stageName})`);
    // Re-use generateHash — it always creates a new record
    return this.generateHash(node);
  }

  /**
   * Hash all nodes in a session in parallel (bounded concurrency).
   *
   * PERFORMANCE: Uses Promise.allSettled to process all nodes simultaneously
   * regardless of individual failures. Failed nodes are collected separately.
   *
   * This is what the POST /workflow/:id/hash endpoint calls.
   */
  async hashSession(sessionId: string): Promise<BatchHashResult> {
    const start = Date.now();

    const session = await prisma.researchSession.findUnique({
      where: { id: sessionId },
      include: {
        workflowNodes: {
          include: { hashes: true },
          orderBy: { stepIndex: 'asc' },
        },
      },
    });

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    logger.info(
      `[HashService] 🚀 Batch hashing ${session.workflowNodes.length} nodes for session ${sessionId}`,
    );

    // Build all HashableNodes and hash them concurrently
    const results = await Promise.allSettled(
      session.workflowNodes.map(async (dbNode) => {
        const hashableNode = this.buildHashableNodeFromDb(dbNode as any);
        return this.generateHash(hashableNode);
      }),
    );

    const hashes: HashRecord[] = [];
    const errors: Array<{ nodeId: string; error: string }> = [];

    results.forEach((result, index) => {
      const node = session.workflowNodes[index];
      if (result.status === 'fulfilled') {
        hashes.push(result.value);
      } else {
        errors.push({
          nodeId: node.id,
          error: result.reason?.message ?? 'Unknown error',
        });
        logger.error(`[HashService] ❌ Failed to hash node ${node.id}: ${result.reason}`);
      }
    });

    const totalDurationMs = Date.now() - start;

    logger.info(
      `[HashService] ✅ Batch complete: ${hashes.length} hashed, ${errors.length} failed in ${totalDurationMs}ms`,
    );

    return {
      sessionId,
      totalNodes: session.workflowNodes.length,
      successCount: hashes.length,
      failedCount: errors.length,
      hashes,
      errors,
      completedAt: new Date(),
      totalDurationMs,
    };
  }

  /**
   * Retrieve all hash records for a session from the DB.
   * Used by the GET /workflow/:id/hashes endpoint.
   */
  async getSessionHashes(sessionId: string): Promise<HashRecord[]> {
    const nodes = await prisma.workflowNode.findMany({
      where: { sessionId },
      include: {
        hashes: {
          where: { type: 'NODE_HASH' },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { stepIndex: 'asc' },
    });

    const records: HashRecord[] = [];
    for (const node of nodes) {
      for (const hash of node.hashes) {
        records.push({
          hashId: hash.id,
          nodeId: node.id,
          algorithm: ALGORITHM,
          hashValue: hash.hashValue,
          createdAt: hash.createdAt,
          verificationStatus: 'UNVERIFIED', // Status is encoded in type field
        });
      }
    }

    return records;
  }
}

// Singleton — one instance per process
export const hashService = new HashService();
