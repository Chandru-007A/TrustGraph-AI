// src/validations/gateway.validation.ts
// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas for the Circle Gateway REST API surface.
//
// All schemas are wrapped in `{ body, query, params }` to match the
// shape expected by `validate.middleware.ts` (which spreads the
// `req.body / req.query / req.params` and runs the schema on the result).
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';

const walletAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'walletAddress must be a 0x-prefixed EVM address');

const positiveDecimal = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'amount must be a positive decimal string (e.g. "100" or "0.5")');

const chainId = z.string().min(1).max(64);

const txHash = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'transactionHash must be a 0x-prefixed 32-byte hex string');

export const depositSchema = z.object({
  body: z.object({
    walletAddress,
    amount: positiveDecimal,
    sourceChain: chainId.optional(),
    token: z.enum(['USDC', 'USDT']).default('USDC'),
  }),
});

export const spendSchema = z.object({
  body: z.object({
    walletAddress,
    amount: positiveDecimal,
    destinationChain: chainId,
    destinationAddress: walletAddress,
    workflowId: z.string().uuid().optional(),
    nodeId: z.string().uuid().optional(),
    paymentReference: z.string().max(128).optional(),
  }),
});

export const balanceSchema = z.object({
  query: z.object({
    walletAddress: walletAddress.optional(),
    token: z.enum(['USDC', 'USDT']).default('USDC'),
    includePending: z
      .union([z.boolean(), z.string().transform((v) => v === 'true' || v === '1')])
      .optional(),
  }),
});

export const transactionsQuerySchema = z.object({
  query: z.object({
    walletAddress: walletAddress.optional(),
    operation: z.enum(['DEPOSIT', 'SPEND', 'BALANCE', 'WEBHOOK']).optional(),
    status: z.enum(['PENDING', 'BROADCAST', 'CONFIRMED', 'FAILED', 'EXPIRED']).optional(),
    workflowId: z.string().uuid().optional(),
    nodeId: z.string().uuid().optional(),
    limit: z
      .union([z.number().int().min(1).max(200), z.string().transform((v) => parseInt(v, 10))])
      .optional(),
  }),
});

export const webhookSchema = z.object({
  body: z.object({
    eventId: z.string().min(1).max(256),
    eventType: z.enum([
      'deposit.completed',
      'deposit.failed',
      'spend.completed',
      'spend.failed',
      'transfer.failed',
      'balance.updated',
    ]),
    walletAddress: walletAddress.optional(),
    amount: positiveDecimal.optional(),
    token: z.enum(['USDC', 'USDT']).default('USDC'),
    transactionHash: txHash.optional(),
    gatewayTransferId: z.string().max(128).optional(),
    sourceChain: chainId.optional(),
    destinationChain: chainId.optional(),
    network: z.string().optional(),
    status: z.enum(['PENDING', 'BROADCAST', 'CONFIRMED', 'FAILED', 'EXPIRED']).optional(),
    raw: z.record(z.any()).optional(),
  }),
});
