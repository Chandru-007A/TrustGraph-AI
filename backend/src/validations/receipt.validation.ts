// src/validations/receipt.validation.ts

import { z } from 'zod';

const uuidParam = z.string().uuid('Must be a valid UUID');

/** Validates a bytes32 hex string — "0x" prefix + 64 hex chars */
const bytes32Hex = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, 'Must be a bytes32 hex string (0x + 64 hex chars)');

/** Validates an array of bytes32 proof elements */
const bytes32Array = z.array(bytes32Hex);

// ─── POST /receipt/publish ────────────────────────────────────────────────────

export const publishSchema = z.object({
  body: z.object({
    workflowId:  uuidParam,
    /** Optional override for probability (0–10000). Defaults to node completion ratio. */
    probability: z.number().int().min(0).max(10_000).optional(),
    /** Optional override for confidence (0–10000). Defaults to probability. */
    confidence:  z.number().int().min(0).max(10_000).optional(),
    /** Optional IPFS CID for the trace. Auto-derived when omitted. */
    traceCid:    z.string().max(512).optional(),
  }),
});

// ─── GET /receipt/:workflowId ─────────────────────────────────────────────────

export const getReceiptSchema = z.object({
  params: z.object({
    workflowId: uuidParam,
  }),
});

// ─── GET /receipt/status/:receiptId ──────────────────────────────────────────

export const getStatusSchema = z.object({
  params: z.object({
    receiptId: uuidParam,
  }),
});

// ─── POST /receipt/verify ─────────────────────────────────────────────────────

export const verifyReceiptSchema = z.object({
  body: z.object({
    receiptId: uuidParam,
  }),
});

// ─── POST /receipt/verify-inclusion ──────────────────────────────────────────
// Stateless Merkle inclusion check — proxied directly to the contract's
// verifyInclusion(bytes32 root, bytes32 leaf, bytes32[] proof) view function.

export const verifyInclusionSchema = z.object({
  body: z.object({
    /** The Merkle root to verify against (bytes32) */
    root:  bytes32Hex,
    /** The leaf hash to prove membership of (bytes32) */
    leaf:  bytes32Hex,
    /** Ordered sibling path from leaf to root (bytes32[]) */
    proof: bytes32Array,
  }),
});
