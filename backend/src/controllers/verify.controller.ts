// src/controllers/verify.controller.ts
// ─────────────────────────────────────────────────────────────────────────────
// VerificationController — HTTP layer for the Verification Engine.
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import ApiResponse from '../utils/ApiResponse';
import ApiError from '../utils/ApiError';
import prisma from '../utils/prisma';
import { verificationService } from '../engine/verify/verify.service';
import { verificationCenterService } from '../services/verification-center.service';

/**
 * POST /api/v1/verify/node
 */
export const verifyNode = catchAsync(async (req: Request, res: Response) => {
  const { nodeId } = req.body;
  const verifierId = req.user?.id;

  const result = await verificationService.verifyNodeHash(nodeId, verifierId);

  res.status(httpStatus.OK).json(
    new ApiResponse(
      httpStatus.OK,
      result.isValid ? 'Node integrity verified' : 'Node integrity check failed',
      result,
    ),
  );
});

/**
 * POST /api/v1/verify/proof
 */
export const verifyProof = catchAsync(async (req: Request, res: Response) => {
  const { leafHash, proof, rootHash } = req.body;
  const verifierId = req.user?.id;

  const result = await verificationService.verifyMerkleProof(
    leafHash,
    proof,
    rootHash,
    verifierId,
  );

  res.status(httpStatus.OK).json(
    new ApiResponse(
      httpStatus.OK,
      result.isValid ? 'Merkle proof verified' : 'Merkle proof invalid',
      result,
    ),
  );
});

/**
 * POST /api/v1/verify/workflow
 */
export const verifyWorkflow = catchAsync(async (req: Request, res: Response) => {
  const { sessionId } = req.body;
  const verifierId = req.user?.id;

  const session = await prisma.researchSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new ApiError(httpStatus.NOT_FOUND, 'Session not found');

  const report = await verificationService.verifyWorkflowIntegrity(sessionId, verifierId);

  res.status(httpStatus.OK).json(
    new ApiResponse(
      httpStatus.OK,
      report.overallResult === 'VERIFIED' ? 'Workflow integrity verified' : 'Workflow integrity compromised',
      report,
    ),
  );
});

/**
 * GET /api/v1/verify/report/:workflowId
 */
export const getReport = catchAsync(async (req: Request, res: Response) => {
  const { workflowId } = req.params;

  // Since workflowId here is the actual IPFS/Blueprint ID and not the sessionId, we search by workflowId.
  // We'll return the latest VERIFICATION_LOG of type WORKFLOW_INTEGRITY for this workflow.
  const sessions = await prisma.researchSession.findMany({
    where: { workflowId },
  });

  if (sessions.length === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No sessions found for this workflow ID');
  }

  const logs = await prisma.verificationLog.findMany({
    where: {
      sessionId: { in: sessions.map(s => s.id) },
      verificationType: 'WORKFLOW_INTEGRITY',
    },
    orderBy: { verifiedAt: 'desc' },
  });

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Verification reports retrieved', { reports: logs }),
  );
});

/**
 * POST /api/v1/verify/tamper
 * DEMO endpoint to intentionally tamper with a node to show verification failing.
 */
export const tamperDemo = catchAsync(async (req: Request, res: Response) => {
  const { nodeId } = req.body;
  const result = await verificationService.tamperNode(nodeId);

  if (!result.success) throw new ApiError(httpStatus.NOT_FOUND, result.message);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, result.message, result),
  );
});

// ── Phase 24: Verification Center ────────────────────────────────────────────

/**
 * GET /api/v1/verify/list
 * Paginated list of all verifiable workflow sessions for the authenticated user.
 * Query params: page, limit, search, status
 */
export const listVerifications = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '15'), 10)));
  const search = String(req.query.search ?? '');
  const status = String(req.query.status ?? '');

  const result = await verificationCenterService.list(userId, page, limit, search, status);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Verifications retrieved', result),
  );
});

/**
 * GET /api/v1/verify/detail/:sessionId
 * Full verification detail for a single workflow session.
 */
export const getVerificationDetail = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const { sessionId } = req.params;

  const result = await verificationCenterService.getDetail(sessionId, userId);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Verification detail retrieved', result),
  );
});

