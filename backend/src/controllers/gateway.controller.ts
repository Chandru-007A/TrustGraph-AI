// src/controllers/gateway.controller.ts
// ─────────────────────────────────────────────────────────────────────────────
// GatewayController — REST surface for Circle Gateway Unified Balance.
//
// Endpoints:
//   POST   /api/v1/gateway/deposit         — deposit USDC into Unified Balance
//   POST   /api/v1/gateway/spend           — spend USDC from Unified Balance
//   GET    /api/v1/gateway/balance         — query aggregated balance
//   GET    /api/v1/gateway/transactions    — list audit log
//   GET    /api/v1/gateway/status          — runtime mode (LIVE | MOCK)
//   POST   /api/v1/gateway/webhooks        — Circle Gateway webhook ingest
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import ApiResponse from '../utils/ApiResponse';
import ApiError from '../utils/ApiError';
import circleGatewayService, { GatewayError } from '../services/circle-gateway.service';

// ─── Wallet resolution helper ────────────────────────────────────────────────

import prisma from '../utils/prisma';
import { ethers } from 'ethers';

async function resolveWalletAddress(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, include: { wallets: true } });
  if (u && u.wallets.length > 0) return u.wallets[0].address;
  const userHash = ethers.keccak256(ethers.toUtf8Bytes(userId));
  return ethers.getAddress(ethers.dataSlice(userHash, 12));
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/gateway/status
 * Returns runtime mode (LIVE vs MOCK) so callers can adapt.
 * No auth required — this is a public, non-sensitive status.
 */
export const getStatus = catchAsync(async (_req: Request, res: Response) => {
  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Gateway status', circleGatewayService.status()),
  );
});

/**
 * POST /api/v1/gateway/deposit
 * Body: { walletAddress, amount, sourceChain?, token? }
 */
export const deposit = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    return res
      .status(httpStatus.UNAUTHORIZED)
      .json(new ApiResponse(httpStatus.UNAUTHORIZED, 'Authentication required', null));
  }
  const { walletAddress, amount, sourceChain, token } = req.body;
  const result = await circleGatewayService.deposit({
    walletAddress,
    amount,
    sourceChain,
    token,
    initiatedBy: req.user.id,
  });
  res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, 'Deposit settled', result));
});

/**
 * POST /api/v1/gateway/spend
 * Body: { walletAddress, amount, destinationChain, destinationAddress, workflowId?, nodeId?, paymentReference? }
 *
 * Note: this is the *manual* spend endpoint. x402 settlement calls
 * CircleGatewayService.spend() directly from the service layer; this
 * REST endpoint is for ad-hoc spends initiated by the operator UI.
 */
export const spend = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    return res
      .status(httpStatus.UNAUTHORIZED)
      .json(new ApiResponse(httpStatus.UNAUTHORIZED, 'Authentication required', null));
  }
  const {
    walletAddress,
    amount,
    destinationChain,
    destinationAddress,
    workflowId,
    nodeId,
    paymentReference,
  } = req.body;
  const result = await circleGatewayService.spend({
    walletAddress,
    amount,
    destinationChain,
    destinationAddress,
    workflowId,
    nodeId,
    paymentReference,
    initiatedBy: req.user.id,
  });
  res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, 'Spend settled', result));
});

/**
 * GET /api/v1/gateway/balance?walletAddress=0x...
 * If walletAddress is omitted, falls back to the authenticated user's wallet.
 */
export const getBalance = catchAsync(async (req: Request, res: Response) => {
  let { walletAddress, token = 'USDC', includePending = false } = req.query as Record<string, any>;
  if (!walletAddress && req.user) {
    walletAddress = await resolveWalletAddress(req.user.id);
  }
  if (!walletAddress) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'walletAddress is required');
  }
  const snap = await circleGatewayService.getBalance({
    walletAddress: String(walletAddress),
    token: token as 'USDC' | 'USDT',
    includePending: Boolean(includePending),
  });
  res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, 'Balance retrieved', snap));
});

/**
 * GET /api/v1/gateway/transactions
 * Filters: walletAddress, operation, status, workflowId, nodeId, limit
 */
export const getTransactions = catchAsync(async (req: Request, res: Response) => {
  const { walletAddress, operation, status, workflowId, nodeId, limit } = req.query as Record<string, any>;
  const rows = await circleGatewayService.getTransactions({
    walletAddress: walletAddress ? String(walletAddress) : undefined,
    operation: operation as any,
    status: status as any,
    workflowId: workflowId as any,
    nodeId: nodeId as any,
    limit: limit ? Number(limit) : undefined,
  });
  res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, 'Transactions retrieved', rows));
});

/**
 * POST /api/v1/gateway/webhooks
 *
 * Public, signature-protected endpoint for Circle Gateway async events.
 *
 * Required header: `X-Circle-Signature: <hex>` (HMAC-SHA256 of the raw
 * body keyed by GATEWAY_WEBHOOK_SECRET). If the secret is unset the
 * service runs in dev mode and accepts unverified webhooks with a
 * warning.
 *
 * Idempotent on `eventId`: a duplicate event is acknowledged with 200
 * and a `created: false` flag.
 */
export const ingestWebhook = catchAsync(async (req: Request, res: Response) => {
  const rawBody = (req as any).rawBody as string | undefined;
  const signature = (req.header('x-circle-signature') || req.header('X-Circle-Signature')) as string | undefined;

  // Body is required verbatim for HMAC; we re-serialize the parsed body
  // only if we couldn't capture the raw stream.
  const bodyString = rawBody ?? JSON.stringify(req.body ?? {});

  if (!circleGatewayService.verifyWebhookSignature(bodyString, signature)) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid webhook signature');
  }

  const { eventId, eventType, walletAddress, amount, token, transactionHash, gatewayTransferId, sourceChain, destinationChain, network, status, raw } = req.body;

  const result = await circleGatewayService.ingestWebhook({
    eventId,
    eventType,
    walletAddress,
    amount,
    token,
    transactionHash,
    gatewayTransferId,
    sourceChain,
    destinationChain,
    network,
    status,
    raw: raw ?? req.body,
  });

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, result.created ? 'Webhook accepted' : 'Webhook duplicate (idempotent)', {
      created: result.created,
      transaction: result.row,
    }),
  );
});

/**
 * GET /api/v1/gateway/transactions/:id
 * Returns one transaction by id.
 */
export const getTransactionById = catchAsync(async (req: Request, res: Response) => {
  const row = await circleGatewayService.getTransactionById(req.params.id);
  if (!row) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Transaction not found');
  }
  res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, 'Transaction retrieved', row));
});

// Re-export for routes
export { GatewayError };
