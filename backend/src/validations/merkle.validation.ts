// src/validations/merkle.validation.ts
// Zod schemas for the Merkle Tree Engine REST API endpoints.

import { z } from 'zod';

const uuidParam = z.string().uuid('Must be a valid UUID');
const sha256Hex = z
  .string()
  .length(64, 'SHA-256 hash must be exactly 64 hex characters')
  .regex(/^[a-f0-9]{64}$/, 'Must be a valid lowercase hex-encoded SHA-256 hash');

/**
 * POST /api/v1/workflow/:id/merkle
 * Build and persist the Merkle tree for a session.
 */
export const buildMerkleSchema = z.object({
  params: z.object({ id: uuidParam }),
});

/**
 * GET /api/v1/workflow/:id/merkle
 * Retrieve the persisted Merkle tree + proofs for a session.
 */
export const getMerkleSchema = z.object({
  params: z.object({ id: uuidParam }),
});

/**
 * POST /api/v1/workflow/:id/proof
 * Generate a Merkle proof for a specific node within a session.
 * Body: { nodeId: uuid }
 */
export const generateProofSchema = z.object({
  params: z.object({ id: uuidParam }),
  body: z.object({
    nodeId: uuidParam.describe('The WorkflowNode ID to generate a proof for'),
  }),
});

/**
 * POST /api/v1/workflow/verify-proof
 * Stateless proof verification — no session lookup required.
 * Any party can call this to verify a node without accessing our DB.
 * Body: { leafHash, proof, rootHash }
 */
export const verifyProofSchema = z.object({
  body: z.object({
    leafHash: sha256Hex.describe('The raw leaf hash being verified'),
    rootHash: sha256Hex.describe('The Merkle root to verify against'),
    proof: z
      .array(
        z.object({
          siblingHash: sha256Hex,
          position: z.enum(['LEFT', 'RIGHT']),
        }),
      )
      .min(0)
      .describe('Ordered sibling path from the generateProof response'),
  }),
});
