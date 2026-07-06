// src/middlewares/x402.middleware.ts
// ─────────────────────────────────────────────────────────────────────────────
// X402Middleware — Intercepts and enforces Coinbase x402 payment protocol.
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import ApiError from '../utils/ApiError';
import x402Service from '../services/x402.service';
import { ethers } from 'ethers';

export const x402Middleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const nodeId = req.params.nodeId;
    if (!nodeId) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Node ID is required for verification'));
    }

    // 1. Fetch node to ensure it exists and get its sessionId
    const node = await prisma.workflowNode.findUnique({
      where: { id: nodeId },
    });

    if (!node) {
      return next(new ApiError(httpStatus.NOT_FOUND, 'Workflow node not found'));
    }

    const workflowId = node.sessionId;

    // 2. Resolve buyer's wallet address from req.user
    if (!req.user) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required'));
    }

    let walletAddress = '';
    const userWithWallets = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { wallets: true },
    });

    if (userWithWallets && userWithWallets.wallets.length > 0) {
      walletAddress = userWithWallets.wallets[0].address;
    } else {
      // Fallback deterministic EVM address for mock/test users without linked wallets
      const userHash = ethers.keccak256(ethers.toUtf8Bytes(req.user.id));
      walletAddress = ethers.getAddress(ethers.dataSlice(userHash, 12));
    }

    // 3. Check if user already holds a valid entitlement (PAID and non-expired)
    const isPaid = await x402Service.checkEntitlement(workflowId, nodeId, walletAddress);

    if (isPaid) {
      logger.info(`[x402Middleware] Access Granted: Node ${nodeId} already paid by ${walletAddress}`);
      return next();
    }

    // 4. Read PAYMENT-SIGNATURE header
    // Header can be case-insensitive in Express, we look for both lowercase and standard keys
    const signatureHeader = (req.header('payment-signature') || req.header('PAYMENT-SIGNATURE')) as string;

    if (signatureHeader) {
      try {
        // Attempt to verify and settle payment
        const result = await x402Service.verifyAndSettle(signatureHeader, walletAddress);

        if (result.success) {
          logger.info(`[x402Middleware] Payment Verified & Unlock Granted for node ${nodeId}`);
          res.setHeader('PAYMENT-RESPONSE', x402Service.encodeResponseHeader(result));
          return next();
        } else {
          logger.warn(`[x402Middleware] Unlock Denied: Payment verification failed`);
        }
      } catch (err: any) {
        logger.error(`[x402Middleware] Facilitator Error or processing failure: ${err.message}`);
        // Fall through to issue a new challenge
      }
    }

    // 5. Entitlement is unpaid or signature validation failed. Generate challenge.
    const { challenge } = await x402Service.createChallenge(workflowId, nodeId, walletAddress);
    const challengeHeader = x402Service.encodeChallengeHeader(challenge);

    logger.info(`[x402Middleware] Payment Required: HTTP 402 Challenge returned for node ${nodeId}`);

    // Set the headers as required by Coinbase x402 protocol specification
    res.setHeader('PAYMENT-REQUIRED', challengeHeader);
    res.status(402).json({
      x402Version: 2,
      error: 'Payment required',
      accepts: challenge.accepts,
    });
  } catch (err: any) {
    logger.error(`[x402Middleware] Middleware encountered an error: ${err.message}`);
    next(err);
  }
};
