// src/controllers/blockchain.controller.ts

import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import ApiResponse from '../utils/ApiResponse';
import { arcBlockchainService } from '../engine/blockchain/arc.service';

/**
 * POST /api/v1/blockchain/commit
 * Queues a session's Merkle root to be anchored to the Arc blockchain.
 */
export const commitRoot = catchAsync(async (req: Request, res: Response) => {
  const { sessionId } = req.body;

  const result = await arcBlockchainService.commitMerkleRoot(sessionId);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, result.message, result),
  );
});

/**
 * GET /api/v1/blockchain/receipt/:workflowId
 * Retrieves the full combined blockchain receipt for a workflow session.
 */
export const getReceipt = catchAsync(async (req: Request, res: Response) => {
  const { workflowId } = req.params;

  const result = await arcBlockchainService.getReceipt(workflowId);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Blockchain receipt retrieved', result),
  );
});

/**
 * GET /api/v1/blockchain/status/:transactionHash
 * Gets the raw status of a specific blockchain transaction.
 */
export const getStatus = catchAsync(async (req: Request, res: Response) => {
  const { transactionHash } = req.params;

  const result = await arcBlockchainService.getTransactionStatus(transactionHash);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Transaction status retrieved', result),
  );
});

/**
 * POST /api/v1/blockchain/retry
 * Forces a retry on a FAILED transaction.
 */
export const retryTransaction = catchAsync(async (req: Request, res: Response) => {
  const { transactionHash } = req.body;

  const result = await arcBlockchainService.retryTransaction(transactionHash);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, result.message, result),
  );
});
