// src/routes/v1/merkle.route.ts
// Merkle Tree Engine API routes.
// Mounted under /api/v1/workflow to keep resource URLs coherent.

import express from 'express';
import * as merkleController from '../../controllers/merkle.controller';
import validate from '../../middlewares/validate.middleware';
import * as merkleValidation from '../../validations/merkle.validation';
import { auth } from '../../middlewares/auth.middleware';

const router = express.Router();

// All merkle routes require authentication
router.use(auth);

// ─────────────────────────────────────────────────────────────────────────────
// CRITICAL ROUTING ORDER:
//   Static routes MUST be declared before dynamic /:id routes.
//   Otherwise Express will match "verify-proof" as an :id parameter.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/workflow/verify-proof
 * Stateless Merkle proof verification.
 * MUST be declared before /:id routes.
 */
router.post(
  '/verify-proof',
  validate(merkleValidation.verifyProofSchema),
  merkleController.verifyProof,
);

/**
 * POST /api/v1/workflow/:id/merkle
 * Build and persist a Merkle tree for a session.
 * PREREQUISITE: POST /workflow/:id/hash must be called first.
 */
router.post(
  '/:id/merkle',
  validate(merkleValidation.buildMerkleSchema),
  merkleController.buildMerkle,
);

/**
 * GET /api/v1/workflow/:id/merkle
 * Retrieve the persisted Merkle tree and all stored proofs.
 */
router.get(
  '/:id/merkle',
  validate(merkleValidation.getMerkleSchema),
  merkleController.getMerkle,
);

/**
 * POST /api/v1/workflow/:id/proof
 * Generate and persist a Merkle proof for a specific node.
 * Body: { nodeId: uuid }
 * PREREQUISITE: POST /workflow/:id/merkle must be called first.
 */
router.post(
  '/:id/proof',
  validate(merkleValidation.generateProofSchema),
  merkleController.generateProof,
);

export default router;
