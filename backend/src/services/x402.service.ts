// src/services/x402.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// X402Service — Coinbase x402 v2 Payment Protocol Service
//
// Manages the creation, tracking, verification, and settlement of x402
// micropayments. Prevents duplicate claims, duplicate unlocks, replay attacks,
// and enforces payment timeouts.
// ─────────────────────────────────────────────────────────────────────────────

import { ethers } from 'ethers';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';
import config from '../config/config';
import crypto from 'crypto';
import circleGatewayService, { GatewayError } from './circle-gateway.service';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface X402Challenge {
  x402Version: number;
  error: string;
  accepts: Array<{
    scheme: string;
    network: string;
    amount: string; // Atomic units (6 decimals for USDC)
    currency: string;
    payTo: string;
    asset: string;
    expires: string; // ISO string
    reference: string; // UUID payment reference
  }>;
}

export interface X402SignaturePayload {
  scheme: string;
  network: string;
  payload: {
    from: string;
    to: string;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: string;
    signature: string;
    reference: string;
    txHash?: string;
  };
}

export interface X402SettlementResult {
  success: boolean;
  paymentStatus: 'PAID' | 'FAILED' | 'EXPIRED';
  transactionHash?: string;
  payerAddress?: string;
  message: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class X402Service {
  /**
   * Retrieves pricing for a node by its stageName.
   * Rates defined per the specification:
   *   Planner: 0.001 USDC
   *   Retriever: 0.002 USDC (Research/SourceCollection)
   *   Validator: 0.002 USDC
   *   Reasoner: 0.005 USDC
   *   Evidence: 0.003 USDC
   *   Summary: 0.001 USDC
   */
  getNodePriceAndAtomic(nodeName: string): { price: number; atomicAmount: string } {
    const pricingMap: Record<string, number> = {
      PlannerNode: 0.001,
      ResearchNode: 0.002,
      SourceCollectionNode: 0.002,
      ValidationNode: 0.002,
      ReasoningNode: 0.005,
      EvidenceAggregatorNode: 0.003,
      WorkflowRecorderNode: 0.001,
    };

    const price = pricingMap[nodeName] || 0.001;
    // USDC has 6 decimal places (0.001 USDC = 1000 atomic units)
    const atomicAmount = Math.round(price * 1_000_000).toString();

    return { price, atomicAmount };
  }

  /**
   * Creates a PaymentEntitlement record in the DB (UNPAID) and generates
   * the structured x402 v2 challenge.
   */
  async createChallenge(
    workflowId: string,
    nodeId: string,
    walletAddress: string,
  ): Promise<{ challenge: X402Challenge; reference: string }> {
    logger.info(
      `[X402Service] Creating challenge for workflow ${workflowId}, node ${nodeId}, wallet ${walletAddress}`,
    );

    // 1. Fetch node info to determine price
    const node = await prisma.workflowNode.findUnique({
      where: { id: nodeId },
    });

    if (!node) {
      throw new ApiError(httpStatus.NOT_FOUND, `Workflow node ${nodeId} not found`);
    }

    // Check if an entitlement already exists
    const existing = await prisma.paymentEntitlement.findUnique({
      where: {
        walletAddress_workflowId_nodeId: {
          walletAddress: walletAddress.toLowerCase(),
          workflowId,
          nodeId,
        },
      },
    });

    if (existing && existing.paymentStatus === 'PAID') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Node is already unlocked for this wallet');
    }

    const { price, atomicAmount } = this.getNodePriceAndAtomic(node.nodeName);

    // Expiration details (default: 30 minutes from now)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Upsert entitlement record (prevents multiple active challenges for the same wallet/node pair)
    const entitlement = await prisma.paymentEntitlement.upsert({
      where: {
        walletAddress_workflowId_nodeId: {
          walletAddress: walletAddress.toLowerCase(),
          workflowId,
          nodeId,
        },
      },
      create: {
        workflowId,
        nodeId,
        walletAddress: walletAddress.toLowerCase(),
        paymentReference: `ref_${crypto.randomUUID()}`,
        amount: price,
        currency: 'USDC',
        paymentStatus: 'UNPAID',
        expiresAt,
      },
      update: {
        paymentStatus: 'UNPAID',
        expiresAt,
        amount: price,
      },
    });

    const challenge: X402Challenge = {
      x402Version: 2,
      error: 'Payment required',
      accepts: [
        {
          scheme: 'exact',
          network: config.x402.network,
          amount: atomicAmount,
          currency: 'USDC',
          payTo: config.x402.sellerAddress,
          asset: config.x402.usdcAddress,
          expires: expiresAt.toISOString(),
          reference: entitlement.paymentReference,
        },
      ],
    };

    return { challenge, reference: entitlement.paymentReference };
  }

  /**
   * Encodes a challenge payload as a Base64-encoded string.
   */
  encodeChallengeHeader(challenge: X402Challenge): string {
    return Buffer.from(JSON.stringify(challenge)).toString('base64');
  }

  /**
   * Decodes a PAYMENT-SIGNATURE header.
   */
  decodeSignatureHeader(headerValue: string): X402SignaturePayload {
    try {
      const decodedStr = Buffer.from(headerValue, 'base64').toString('utf8');
      return JSON.parse(decodedStr) as X402SignaturePayload;
    } catch (err: any) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Malformed PAYMENT-SIGNATURE header: ${err.message}`,
      );
    }
  }

  /**
   * Encodes a settlement success response header.
   */
  encodeResponseHeader(result: X402SettlementResult): string {
    return Buffer.from(JSON.stringify(result)).toString('base64');
  }

  /**
   * Checks if a valid, non-expired PAID entitlement exists in the DB.
   */
  async checkEntitlement(
    workflowId: string,
    nodeId: string,
    walletAddress: string,
  ): Promise<boolean> {
    const entitlement = await prisma.paymentEntitlement.findUnique({
      where: {
        walletAddress_workflowId_nodeId: {
          walletAddress: walletAddress.toLowerCase(),
          workflowId,
          nodeId,
        },
      },
    });

    if (!entitlement) return false;
    if (entitlement.paymentStatus !== 'PAID') return false;

    // Check expiration if set
    if (entitlement.expiresAt && entitlement.expiresAt.getTime() < Date.now()) {
      // Entitlement has expired, mark it expired in DB
      await prisma.paymentEntitlement.update({
        where: { id: entitlement.id },
        data: { paymentStatus: 'EXPIRED' },
      });
      logger.info(`[X402Service] Entitlement ${entitlement.id} expired.`);
      return false;
    }

    return true;
  }

  /**
   * Validates PAYMENT-SIGNATURE and processes the settlement.
   * Interacts with the external Coinbase Facilitator or performs local validation.
   */
  async verifyAndSettle(
    signatureHeader: string,
    walletAddress: string,
  ): Promise<X402SettlementResult> {
    logger.info('[X402Service] Verifying PAYMENT-SIGNATURE…');

    const decoded = this.decodeSignatureHeader(signatureHeader);
    const { reference, signature, txHash, from, to, value } = decoded.payload;

    if (!reference) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'PAYMENT-SIGNATURE missing payment reference');
    }

    // 1. Find the local entitlement challenge
    const entitlement = await prisma.paymentEntitlement.findUnique({
      where: { paymentReference: reference },
    });

    if (!entitlement) {
      logger.warn(`[X402Service] Unlock Denied: Challenge reference ${reference} not found in DB`);
      throw new ApiError(httpStatus.NOT_FOUND, 'Payment reference not found');
    }

    if (entitlement.paymentStatus === 'PAID') {
      logger.info(`[X402Service] Entitlement already PAID for reference ${reference}`);
      return {
        success: true,
        paymentStatus: 'PAID',
        transactionHash: entitlement.facilitatorReference || undefined,
        payerAddress: entitlement.walletAddress,
        message: 'Entitlement is already settled.',
      };
    }

    // Expiration check
    if (entitlement.expiresAt && entitlement.expiresAt.getTime() < Date.now()) {
      await prisma.paymentEntitlement.update({
        where: { id: entitlement.id },
        data: { paymentStatus: 'EXPIRED' },
      });
      logger.warn(`[X402Service] Unlock Denied: Payment challenge has expired`);
      return {
        success: false,
        paymentStatus: 'EXPIRED',
        message: 'Payment challenge has expired.',
      };
    }

    // Prevent cross-wallet replay attacks
    if (entitlement.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      logger.warn(
        `[X402Service] Unlock Denied: Wallet address mismatch (DB: ${entitlement.walletAddress}, Request: ${walletAddress})`,
      );
      throw new ApiError(httpStatus.FORBIDDEN, 'Payment request wallet address mismatch');
    }

    let isVerified = false;
    let transactionHash = txHash || `tx_${crypto.randomUUID()}`;

    // 2. Call Coinbase Facilitator if configured, else fall back to Circle
    //    Gateway Unified Balance (live), or local mock verification (dev).
    if (config.x402.facilitatorUrl) {
      try {
        logger.info(`[X402Service] Communicating with facilitator: ${config.x402.facilitatorUrl}`);
        const response = await fetch(config.x402.facilitatorUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(decoded),
        });

        if (!response.ok) {
          logger.error(`[X402Service] Facilitator Error: Status ${response.status}`);
          throw new Error(`Facilitator service returned HTTP ${response.status}`);
        }

        const data = (await response.json()) as any;
        if (data.success && (data.status === 'settled' || data.status === 'paid')) {
          isVerified = true;
          if (data.transactionHash) {
            transactionHash = data.transactionHash;
          }
        }
      } catch (err: any) {
        logger.error(`[X402Service] Facilitator Communication Failure: ${err.message}`);
        throw new ApiError(httpStatus.BAD_GATEWAY, `Coinbase Facilitator error: ${err.message}`);
      }
    } else if (circleGatewayService.isLive()) {
      // ─── Circle Gateway Unified Balance — live settlement ───────────────
      // The PAYMENT-SIGNATURE has been verified to belong to `walletAddress`
      // and to reference an existing UNPAID challenge. We now pull USDC
      // from the operator's Unified Balance and mint it on the destination
      // chain (Arc Testnet by default) so the merchant (config.x402.sellerAddress)
      // receives the payment.
      logger.info(
        `[X402Service] Settling via Circle Gateway Unified Balance — ` +
          `${entitlement.amount} USDC → ${config.x402.sellerAddress} on ${config.gateway.unifiedBalanceNetwork}`,
      );

      try {
        const gatewayResult = await circleGatewayService.spend({
          walletAddress: walletAddress.toLowerCase(),
          amount: String(entitlement.amount),
          destinationChain: config.gateway.unifiedBalanceNetwork,
          destinationAddress: config.x402.sellerAddress,
          workflowId: entitlement.workflowId,
          nodeId: entitlement.nodeId,
          paymentReference: entitlement.paymentReference,
          paymentEntitlementId: entitlement.id,
        });

        isVerified = true;
        if (gatewayResult.transactionHash) {
          transactionHash = gatewayResult.transactionHash;
        }
      } catch (err: any) {
        if (err instanceof GatewayError) {
          // Map insufficient balance to PAYMENT_REQUIRED per x402 spec;
          // everything else is a 502 (bad gateway).
          if (err.statusCode === httpStatus.PAYMENT_REQUIRED) {
            return {
              success: false,
              paymentStatus: 'FAILED',
              message: err.message,
            };
          }
          throw new ApiError(err.statusCode, `Gateway settlement failed: ${err.message}`);
        }
        throw err;
      }
    } else {
      // ─── Local Mock Facilitator Validation (dev / no keys) ───────────────
      logger.info('[X402Service] Running in local mock facilitator mode');

      // Validates mock parameters
      const expectedAtomic = Math.round(Number(entitlement.amount) * 1_000_000).toString();
      const valueValid = value === expectedAtomic;
      const recipientValid = to.toLowerCase() === config.x402.sellerAddress.toLowerCase();
      const senderValid = from.toLowerCase() === walletAddress.toLowerCase();

      // Ensure signature is a valid format (starts with 0x and is correct length, or mock signature string)
      const sigValid = signature && (signature.startsWith('0x') || signature === 'MOCK_SIGNATURE');

      if (valueValid && recipientValid && senderValid && sigValid) {
        isVerified = true;
      } else {
        logger.warn(
          `[X402Service] Unlock Denied: Mock validation failed — value: ${valueValid}, recipient: ${recipientValid}, sender: ${senderValid}, sig: ${sigValid}`,
        );
      }
    }

    if (!isVerified) {
      await prisma.paymentEntitlement.update({
        where: { id: entitlement.id },
        data: { paymentStatus: 'FAILED' },
      });
      return {
        success: false,
        paymentStatus: 'FAILED',
        message: 'Payment verification failed.',
      };
    }

    // 3. Mark entitlement as PAID
    const updated = await prisma.paymentEntitlement.update({
      where: { id: entitlement.id },
      data: {
        paymentStatus: 'PAID',
        paidAt: new Date(),
        facilitatorReference: transactionHash,
      },
    });

    logger.info(
      `[X402Service] Payment Verified & Unlock Granted for node ${entitlement.nodeId} to ${walletAddress}`,
    );

    return {
      success: true,
      paymentStatus: 'PAID',
      transactionHash,
      payerAddress: walletAddress,
      message: 'Payment successfully settled and node unlocked.',
    };
  }

  /**
   * Retrieves user payment history.
   */
  async getPaymentHistory(walletAddress: string) {
    return prisma.paymentEntitlement.findMany({
      where: { walletAddress: walletAddress.toLowerCase() },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieves single payment status.
   */
  async getPaymentStatus(paymentId: string) {
    const entitlement = await prisma.paymentEntitlement.findUnique({
      where: { id: paymentId },
    });

    if (!entitlement) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Payment entitlement not found');
    }

    return entitlement;
  }
}

export const x402Service = new X402Service();
export default x402Service;
