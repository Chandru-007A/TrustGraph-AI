// src/validations/verify.validation.ts
// Zod schemas for the Verification Engine REST API endpoints.

import { z } from 'zod';

const uuidParam = z.string().uuid('Must be a valid UUID');
const sha256Hex = z
  .string()
  .length(64, 'SHA-256 hash must be exactly 64 hex characters')
  .regex(/^[a-f0-9]{64}$/, 'Must be a valid lowercase hex-encoded SHA-256 hash');

/**
 * POST /api/v1/verify/node
 */
export const verifyNodeSchema = z.object({
  body: z.object({
    nodeId: uuidParam,
  }),
});

/**
 * POST /api/v1/verify/proof
 */
export const verifyProofSchema = z.object({
  body: z.object({
    leafHash: sha256Hex,
    rootHash: sha256Hex,
    proof: z.array(
      z.object({
        siblingHash: sha256Hex,
        position: z.enum(['LEFT', 'RIGHT']),
      })
    ),
  }),
});

/**
 * POST /api/v1/verify/workflow
 */
export const verifyWorkflowSchema = z.object({
  body: z.object({
    sessionId: uuidParam,
  }),
});

/**
 * GET /api/v1/verify/report/:workflowId
 */
export const getReportSchema = z.object({
  params: z.object({
    workflowId: uuidParam,
  }),
});

/**
 * POST /api/v1/verify/tamper
 */
export const tamperDemoSchema = z.object({
  body: z.object({
    nodeId: uuidParam,
  }),
});
