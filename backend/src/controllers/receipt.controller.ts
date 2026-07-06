// src/controllers/receipt.controller.ts

import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import ApiResponse from '../utils/ApiResponse';
import { receiptRegistryService } from '../engine/blockchain/receipt-registry.service';
import { receiptExplorerService } from '../services/receipt-explorer.service';

/**
 * POST /api/v1/receipt/publish
 *
 * Publishes a workflow's receipt to the ReceiptRegistryV2 contract via publishV2().
 * Derives all 8 ABI parameters from the session's DB records:
 *   - traceHash      = keccak256(sorted node hashes)
 *   - marketId       = keccak256(sessionId)
 *   - probability    = body.probability || node completion ratio × 10000
 *   - confidence     = body.confidence  || probability
 *   - consumer       = user wallet address || keccak-derived address
 *   - merkleRoot     = MerkleRoot.rootHash padded to bytes32
 *   - schemaVersion  = "LEO_RECEIPT_V1" encoded as bytes16
 *   - traceCid       = body.traceCid || ipfs://{firstLeafHash}
 *
 * Body:
 *   { workflowId: UUID, probability?: 0-10000, confidence?: 0-10000, traceCid?: string }
 */
export const publishReceipt = catchAsync(async (req: Request, res: Response) => {
  const { workflowId, probability, confidence, traceCid } = req.body;

  const result = await receiptRegistryService.publishReceipt(workflowId, {
    probability,
    confidence,
    traceCid,
  });

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Receipt published successfully', result),
  );
});

/**
 * GET /api/v1/receipt/:workflowId
 *
 * Returns the full receipt record including all V2 fields and every
 * ReceiptV2 on-chain event that has been emitted and persisted.
 */
export const getReceipt = catchAsync(async (req: Request, res: Response) => {
  const { workflowId } = req.params;

  const result = await receiptRegistryService.getReceipt(workflowId);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Receipt retrieved', result),
  );
});

/**
 * GET /api/v1/receipt/status/:receiptId
 *
 * Returns the lightweight registration status of a specific receipt.
 */
export const getStatus = catchAsync(async (req: Request, res: Response) => {
  const { receiptId } = req.params;

  const result = await receiptRegistryService.getStatus(receiptId);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Receipt status retrieved', result),
  );
});

/**
 * POST /api/v1/receipt/verify
 *
 * Verifies a stored receipt by:
 *   1. Re-computing the traceHash from the session's current DB hashes
 *   2. Comparing it against the stored traceHash
 *   3. Confirming registrationStatus === 'REGISTERED'
 *
 * Body: { receiptId: UUID }
 */
export const verifyReceipt = catchAsync(async (req: Request, res: Response) => {
  const { receiptId } = req.body;

  const result = await receiptRegistryService.verifyReceipt(receiptId);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, result.message, result),
  );
});

/**
 * POST /api/v1/receipt/verify-inclusion
 *
 * Stateless Merkle inclusion proof verification.
 * Proxies directly to the contract's verifyInclusion(bytes32 root, bytes32 leaf,
 * bytes32[] proof) pure view function — no DB lookup needed.
 *
 * In live mode  → delegates to the contract on-chain.
 * In mock mode  → mirrors the Solidity algorithm locally.
 *
 * Body: { root: bytes32, leaf: bytes32, proof: bytes32[] }
 */
export const verifyInclusion = catchAsync(async (req: Request, res: Response) => {
  const { root, leaf, proof } = req.body;

  const isValid = await receiptRegistryService.verifyInclusion(root, leaf, proof);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, isValid ? 'Leaf is included in the Merkle tree' : 'Leaf NOT found in the Merkle tree', {
      isValid,
      root,
      leaf,
      proofSteps: proof.length,
    }),
  );
});

// ── Phase 23: Receipt Explorer ────────────────────────────────────────────────

/**
 * GET /api/v1/receipt/list
 *
 * Paginated receipt list for the authenticated user.
 * Query params: page, limit, search, status, sort
 */
export const listReceipts = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '15'), 10)));
  const search = String(req.query.search ?? '');
  const status = String(req.query.status ?? '');
  const sort = req.query.sort === 'oldest' ? 'oldest' : 'newest';

  const result = await receiptExplorerService.list({
    userId,
    page,
    limit,
    search,
    status,
    sort,
  });

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Receipts retrieved', result),
  );
});

/**
 * GET /api/v1/receipt/detail/:receiptId
 *
 * Full receipt detail including blockchain anchor and activity timeline.
 * The :receiptId is a PaymentEntitlement UUID.
 */
export const getReceiptDetail = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const { receiptId } = req.params;

  const result = await receiptExplorerService.getDetail(receiptId, userId);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Receipt detail retrieved', result),
  );
});

/**
 * GET /api/v1/receipt/detail/:receiptId/download?format=json|pdf
 *
 * Downloads a receipt as JSON. PDF is handled client-side via print dialog.
 */
export const downloadReceipt = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  const { receiptId } = req.params;
  const format = req.query.format === 'pdf' ? 'pdf' : 'json';

  const detail = await receiptExplorerService.getDetail(receiptId, userId);

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="receipt-${receiptId}.json"`,
    );
    res.send(JSON.stringify(detail, null, 2));
  } else {
    // PDF is rendered client-side; return 400
    res.status(httpStatus.BAD_REQUEST).json(
      new ApiResponse(httpStatus.BAD_REQUEST, 'PDF download is handled client-side', null),
    );
  }
});

