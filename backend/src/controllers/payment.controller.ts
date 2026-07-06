// src/controllers/payment.controller.ts
// ─────────────────────────────────────────────────────────────────────────────
// PaymentController — Exposes REST APIs for x402 payment lifecycle.
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import ApiResponse from '../utils/ApiResponse';
import x402Service from '../services/x402.service';
import paymentCenterService from '../services/payment-center.service';
import prisma from '../utils/prisma';
import { ethers } from 'ethers';

/**
 * POST /api/v1/payment/create
 *
 * Manually initiates a payment challenge for a workflow node.
 * Body: { workflowId: UUID, nodeId: UUID }
 */
export const createChallenge = catchAsync(async (req: Request, res: Response) => {
  const { workflowId, nodeId } = req.body;

  if (!req.user) {
    return res.status(httpStatus.UNAUTHORIZED).json(
      new ApiResponse(httpStatus.UNAUTHORIZED, 'Authentication required', null),
    );
  }

  // Resolve user's wallet address
  let walletAddress = '';
  const userWithWallets = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { wallets: true },
  });

  if (userWithWallets && userWithWallets.wallets.length > 0) {
    walletAddress = userWithWallets.wallets[0].address;
  } else {
    // Deterministic fallback address
    const userHash = ethers.keccak256(ethers.toUtf8Bytes(req.user.id));
    walletAddress = ethers.getAddress(ethers.dataSlice(userHash, 12));
  }

  const { challenge, reference } = await x402Service.createChallenge(
    workflowId,
    nodeId,
    walletAddress,
  );

  const challengeHeader = x402Service.encodeChallengeHeader(challenge);

  // Set PAYMENT-REQUIRED header to comply with Coinbase x402 protocol specification
  res.setHeader('PAYMENT-REQUIRED', challengeHeader);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Payment challenge created', {
      challenge,
      reference,
      header: challengeHeader,
    }),
  );
});

/**
 * POST /api/v1/payment/verify
 *
 * Verifies a PAYMENT-SIGNATURE payload and grants access.
 * Body: { signatureHeader: string }
 */
export const verifyPayment = catchAsync(async (req: Request, res: Response) => {
  const { signatureHeader } = req.body;

  if (!req.user) {
    return res.status(httpStatus.UNAUTHORIZED).json(
      new ApiResponse(httpStatus.UNAUTHORIZED, 'Authentication required', null),
    );
  }

  // Resolve user's wallet address
  let walletAddress = '';
  const userWithWallets = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { wallets: true },
  });

  if (userWithWallets && userWithWallets.wallets.length > 0) {
    walletAddress = userWithWallets.wallets[0].address;
  } else {
    // Deterministic fallback address
    const userHash = ethers.keccak256(ethers.toUtf8Bytes(req.user.id));
    walletAddress = ethers.getAddress(ethers.dataSlice(userHash, 12));
  }

  const result = await x402Service.verifyAndSettle(signatureHeader, walletAddress);

  if (result.success) {
    const responseHeader = x402Service.encodeResponseHeader(result);
    res.setHeader('PAYMENT-RESPONSE', responseHeader);

    return res.status(httpStatus.OK).json(
      new ApiResponse(httpStatus.OK, result.message, {
        result,
        header: responseHeader,
      }),
    );
  }

  res.status(httpStatus.PAYMENT_REQUIRED).json(
    new ApiResponse(httpStatus.PAYMENT_REQUIRED, result.message, result),
  );
});

/**
 * GET /api/v1/payment/history
 *
 * Retrieves the full purchase/entitlement history for the authenticated user.
 */
export const getPaymentHistory = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(httpStatus.UNAUTHORIZED).json(
      new ApiResponse(httpStatus.UNAUTHORIZED, 'Authentication required', null),
    );
  }

  // Resolve user's wallet address
  let walletAddress = '';
  const userWithWallets = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { wallets: true },
  });

  if (userWithWallets && userWithWallets.wallets.length > 0) {
    walletAddress = userWithWallets.wallets[0].address;
  } else {
    const userHash = ethers.keccak256(ethers.toUtf8Bytes(req.user.id));
    walletAddress = ethers.getAddress(ethers.dataSlice(userHash, 12));
  }

  const history = await x402Service.getPaymentHistory(walletAddress);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Payment history retrieved', history),
  );
});

/**
 * GET /api/v1/payment/status/:paymentId
 *
 * Retrieves the detailed status of a specific entitlement.
 */
export const getPaymentStatus = catchAsync(async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const status = await x402Service.getPaymentStatus(paymentId);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Payment status retrieved', status),
  );
});

/**
 * GET /api/v1/payment/stats
 * Get high-level payment metrics for Payment Center.
 */
export const getPaymentStats = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(httpStatus.UNAUTHORIZED).json(new ApiResponse(httpStatus.UNAUTHORIZED, 'Authentication required', null));
  }
  const walletAddress = await getWalletAddress(req.user.id);
  const stats = await paymentCenterService.getStats(walletAddress);
  res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, 'Stats retrieved', stats));
});

/**
 * GET /api/v1/payment/analytics
 * Get Recharts-ready analytics.
 */
export const getPaymentAnalytics = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(httpStatus.UNAUTHORIZED).json(new ApiResponse(httpStatus.UNAUTHORIZED, 'Authentication required', null));
  }
  const walletAddress = await getWalletAddress(req.user.id);
  const analytics = await paymentCenterService.getAnalytics(walletAddress);
  res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, 'Analytics retrieved', analytics));
});

/**
 * GET /api/v1/payment/center-history
 * Get paginated, searchable history for Payment Center.
 */
export const getPaymentCenterHistory = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(httpStatus.UNAUTHORIZED).json(new ApiResponse(httpStatus.UNAUTHORIZED, 'Authentication required', null));
  }
  const walletAddress = await getWalletAddress(req.user.id);
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const search = (req.query.search as string) || '';
  const status = (req.query.status as string) || 'ALL';

  const history = await paymentCenterService.getHistory(walletAddress, page, limit, search, status);
  res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, 'History retrieved', history));
});

/**
 * GET /api/v1/payment/center-detail/:paymentReference
 * Get deep details of a specific payment for the drawer.
 */
export const getPaymentDetail = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(httpStatus.UNAUTHORIZED).json(new ApiResponse(httpStatus.UNAUTHORIZED, 'Authentication required', null));
  }
  const walletAddress = await getWalletAddress(req.user.id);
  const detail = await paymentCenterService.getPaymentDetail(walletAddress, req.params.paymentReference);
  res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, 'Payment detail retrieved', detail));
});

/** Helper to resolve user wallet deterministically */
async function getWalletAddress(userId: string): Promise<string> {
  const userWithWallets = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallets: true },
  });
  if (userWithWallets && userWithWallets.wallets.length > 0) {
    return userWithWallets.wallets[0].address;
  }
  const userHash = ethers.keccak256(ethers.toUtf8Bytes(userId));
  return ethers.getAddress(ethers.dataSlice(userHash, 12));
}
