// src/controllers/hash.controller.ts
// ─────────────────────────────────────────────────────────────────────────────
// HashController — HTTP layer for the Hash Engine.
//
// Endpoints:
//   POST /api/v1/workflow/:id/hash       — Batch hash all nodes in a session
//   GET  /api/v1/workflow/:id/hashes     — Retrieve all hashes for a session
//   POST /api/v1/workflow/hash/verify    — Verify a specific node hash
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import ApiResponse from '../utils/ApiResponse';
import ApiError from '../utils/ApiError';
import { hashService } from '../engine/hash/hash.service';
import prisma from '../utils/prisma';

/**
 * POST /api/v1/workflow/:id/hash
 *
 * Triggers the hash engine to generate SHA-256 hashes for all DAG nodes
 * in a session. Processes all nodes in parallel via Promise.allSettled.
 *
 * Returns a BatchHashResult with per-node hash values and any errors.
 */
export const hashSession = catchAsync(async (req: Request, res: Response) => {
  const sessionId = req.params.id;

  // Ownership check — user can only hash their own sessions
  const session = await prisma.researchSession.findFirst({
    where: { id: sessionId, userId: req.user!.id },
  });

  if (!session) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Session not found');
  }

  const result = await hashService.hashSession(sessionId);

  const statusCode =
    result.failedCount === 0 ? httpStatus.OK : httpStatus.MULTI_STATUS;

  res.status(statusCode).json(
    new ApiResponse(
      statusCode,
      result.failedCount === 0
        ? `Successfully hashed ${result.successCount} nodes`
        : `Hashed ${result.successCount}/${result.totalNodes} nodes (${result.failedCount} failed)`,
      result,
    ),
  );
});

/**
 * GET /api/v1/workflow/:id/hashes
 *
 * Retrieves all hash records persisted for a session.
 * Returns them ordered by node step index.
 */
export const getSessionHashes = catchAsync(async (req: Request, res: Response) => {
  const sessionId = req.params.id;

  // Ownership check
  const session = await prisma.researchSession.findFirst({
    where: { id: sessionId, userId: req.user!.id },
  });

  if (!session) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Session not found');
  }

  const hashes = await hashService.getSessionHashes(sessionId);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, `Retrieved ${hashes.length} hash records`, {
      sessionId,
      count: hashes.length,
      hashes,
    }),
  );
});

/**
 * POST /api/v1/workflow/hash/verify
 *
 * Verify the integrity of a specific node hash.
 *
 * HOW IT WORKS:
 *   1. Accepts { nodeId, expectedHash } in the body
 *   2. Fetches the current node state from DB
 *   3. Re-serializes and re-hashes it identically to the original computation
 *   4. Compares to expectedHash
 *   5. If they differ → INTEGRITY VIOLATION detected
 *
 * This endpoint is the cryptographic proof mechanism.
 * A 200 + isValid=true means the node was not tampered with.
 * A 200 + isValid=false means tampering is detected — treat this as a CRITICAL ALERT.
 */
export const verifyHash = catchAsync(async (req: Request, res: Response) => {
  const { nodeId, expectedHash } = req.body;

  const result = await hashService.verifyHash({ nodeId, expectedHash });

  // 200 in both cases — the HTTP status is about the request processing,
  // not the verification outcome. The `isValid` field carries the truth.
  const statusCode = httpStatus.OK;

  res.status(statusCode).json(
    new ApiResponse(
      statusCode,
      result.isValid ? '✅ Hash integrity verified — node has not been tampered with' : '⚠️  INTEGRITY VIOLATION — hash mismatch detected',
      result,
    ),
  );
});
