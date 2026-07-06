// src/validations/hash.validation.ts
// Zod schemas for Hash Engine REST API endpoints.

import { z } from 'zod';

/**
 * POST /api/v1/workflow/:id/hash
 * Trigger batch hashing for all nodes in a session.
 */
export const hashSessionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid session ID — must be a valid UUID'),
  }),
});

/**
 * GET /api/v1/workflow/:id/hashes
 * Retrieve all hash records for a session.
 */
export const getSessionHashesSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid session ID — must be a valid UUID'),
  }),
});

/**
 * POST /api/v1/workflow/hash/verify
 * Verify the integrity of a specific node hash.
 * Accepts the nodeId and the expectedHash to verify against.
 */
export const verifyHashSchema = z.object({
  body: z.object({
    nodeId: z
      .string()
      .uuid('nodeId must be a valid UUID'),
    expectedHash: z
      .string()
      .length(64, 'SHA-256 hash must be exactly 64 hex characters')
      .regex(/^[a-f0-9]{64}$/, 'expectedHash must be a valid hex-encoded SHA-256 hash'),
  }),
});
