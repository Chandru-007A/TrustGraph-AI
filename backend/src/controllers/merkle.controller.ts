// src/controllers/merkle.controller.ts
// ─────────────────────────────────────────────────────────────────────────────
// MerkleController — HTTP layer for the Merkle Tree Engine.
//
// Endpoints:
//   POST /api/v1/workflow/:id/merkle        — Build & persist tree
//   GET  /api/v1/workflow/:id/merkle        — Retrieve tree + proofs
//   POST /api/v1/workflow/:id/proof         — Generate proof for a node
//   POST /api/v1/workflow/verify-proof      — Stateless proof verification
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import ApiResponse from '../utils/ApiResponse';
import ApiError from '../utils/ApiError';
import { merkleTreeService } from '../engine/merkle/merkle.service';
import { MerkleProofStep } from '../engine/merkle/interfaces';
import prisma from '../utils/prisma';

/**
 * POST /api/v1/workflow/:id/merkle
 *
 * Builds the binary Merkle tree from all NODE_HASH records in the session.
 * Persists: rootHash, leafCount, treeDepth, algorithm, generationMs, leaves[].
 *
 * PREREQUISITE: POST /workflow/:id/hash must have been called first.
 *               Without node hashes, there are no leaves to build the tree from.
 */
export const buildMerkle = catchAsync(async (req: Request, res: Response) => {
  const sessionId = req.params.id;

  // Ownership validation
  const session = await prisma.researchSession.findFirst({
    where: { id: sessionId, userId: req.user!.id },
  });
  if (!session) throw new ApiError(httpStatus.NOT_FOUND, 'Session not found');

  const tree = await merkleTreeService.buildAndPersistForSession(sessionId);

  res.status(httpStatus.CREATED).json(
    new ApiResponse(httpStatus.CREATED, '🌲 Merkle tree built and persisted successfully', {
      treeId: tree.treeId,
      sessionId: tree.sessionId,
      rootHash: tree.rootHash,
      leafCount: tree.leafCount,
      treeDepth: tree.treeDepth,
      algorithm: tree.algorithm,
      generationMs: tree.generationMs,
      createdAt: tree.createdAt,
    }),
  );
});

/**
 * GET /api/v1/workflow/:id/merkle
 *
 * Retrieves the persisted Merkle tree for a session, including all
 * stored proofs generated so far.
 */
export const getMerkle = catchAsync(async (req: Request, res: Response) => {
  const sessionId = req.params.id;

  // Ownership validation
  const session = await prisma.researchSession.findFirst({
    where: { id: sessionId, userId: req.user!.id },
  });
  if (!session) throw new ApiError(httpStatus.NOT_FOUND, 'Session not found');

  const result = await merkleTreeService.getForSession(sessionId);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Merkle tree retrieved', result),
  );
});

/**
 * POST /api/v1/workflow/:id/proof
 *
 * Generates a Merkle proof for a specific WorkflowNode within a session.
 * Body: { nodeId: uuid }
 *
 * The returned proof allows anyone to verify this node's hash was included
 * in the Merkle tree — WITHOUT needing to see any other node's data.
 *
 * PREREQUISITE: Merkle tree must have been built first (POST /merkle).
 */
export const generateProof = catchAsync(async (req: Request, res: Response) => {
  const sessionId = req.params.id;
  const { nodeId } = req.body;

  // Ownership validation
  const session = await prisma.researchSession.findFirst({
    where: { id: sessionId, userId: req.user!.id },
  });
  if (!session) throw new ApiError(httpStatus.NOT_FOUND, 'Session not found');

  // Verify the node belongs to this session
  const node = await prisma.workflowNode.findFirst({
    where: { id: nodeId, sessionId },
  });
  if (!node) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Workflow node not found in this session',
    );
  }

  const proof = await merkleTreeService.generateAndPersistProof(sessionId, nodeId);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, '🔍 Merkle proof generated', {
      proofId: proof.proofId,
      nodeId: proof.nodeId,
      leafHash: proof.leafHash,
      rootHash: (await prisma.merkleRoot.findUnique({ where: { sessionId } }))?.rootHash,
      proofDepth: proof.proofDepth,
      proof: proof.proof,
      instruction:
        'Pass leafHash, proof, and rootHash to POST /workflow/verify-proof to verify this node independently.',
    }),
  );
});

/**
 * POST /api/v1/workflow/verify-proof
 *
 * STATELESS proof verification.
 * No database lookup required — pure cryptographic computation.
 *
 * Any external verifier (a third party, a smart contract, an auditor)
 * can send this request with a proof they received and verify it is authentic.
 *
 * Body: { leafHash, proof: [{ siblingHash, position }], rootHash }
 *
 * HOW IT WORKS:
 *   1. Domain-separate: H = SHA-256("LEAF:" + leafHash)
 *   2. For each proof step, combine H with its sibling (order by position)
 *   3. Compare the final H to rootHash
 *   4. isValid: true → node was in the tree
 *      isValid: false → proof is invalid or data was tampered
 */
export const verifyProof = catchAsync(async (req: Request, res: Response) => {
  const { leafHash, proof, rootHash } = req.body;

  const result = merkleTreeService.verifyProof(
    leafHash,
    proof as MerkleProofStep[],
    rootHash,
  );

  res.status(httpStatus.OK).json(
    new ApiResponse(
      httpStatus.OK,
      result.isValid
        ? '✅ Proof is valid — node hash is a confirmed member of the Merkle tree'
        : '⚠️  Proof is INVALID — this node hash is NOT in the Merkle tree, or data was tampered',
      result,
    ),
  );
});
