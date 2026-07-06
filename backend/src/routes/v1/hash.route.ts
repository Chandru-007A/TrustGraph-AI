// src/routes/v1/hash.route.ts
// Hash Engine API routes.
// Note: These are mounted under /api/v1/workflow to keep the resource path coherent.

import express from 'express';
import * as hashController from '../../controllers/hash.controller';
import validate from '../../middlewares/validate.middleware';
import * as hashValidation from '../../validations/hash.validation';
import { auth } from '../../middlewares/auth.middleware';

const router = express.Router();

// All hash routes require authentication
router.use(auth);

/**
 * POST /api/v1/workflow/:id/hash
 * Batch-generate SHA-256 hashes for all DAG nodes in a session.
 * Run this AFTER build-dag to ensure node relationships are persisted.
 */
router.post(
  '/:id/hash',
  validate(hashValidation.hashSessionSchema),
  hashController.hashSession,
);

/**
 * GET /api/v1/workflow/:id/hashes
 * Retrieve all computed hashes for a session.
 */
router.get(
  '/:id/hashes',
  validate(hashValidation.getSessionHashesSchema),
  hashController.getSessionHashes,
);

/**
 * POST /api/v1/workflow/hash/verify
 * Verify the cryptographic integrity of a specific node.
 * Body: { nodeId: uuid, expectedHash: string (64 hex chars) }
 *
 * NOTE: This route MUST be declared before /:id/hash to avoid
 * Express mistaking "hash" as an :id parameter.
 */
router.post(
  '/hash/verify',
  validate(hashValidation.verifyHashSchema),
  hashController.verifyHash,
);

export default router;
