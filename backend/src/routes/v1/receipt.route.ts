// src/routes/v1/receipt.route.ts

import express from 'express';
import * as receiptController from '../../controllers/receipt.controller';
import validate from '../../middlewares/validate.middleware';
import * as receiptValidation from '../../validations/receipt.validation';
import { auth } from '../../middlewares/auth.middleware';

const router = express.Router();

// All receipt routes require a valid JWT
router.use(auth);

// ── Phase 23: Receipt Explorer ─────────────────────────────────────────────

/**
 * GET /api/v1/receipt/list
 * Paginated receipt list for the authenticated user.
 * Query: page, limit, search, status, sort
 */
router.get('/list', receiptController.listReceipts);

/**
 * GET /api/v1/receipt/detail/:receiptId/download?format=json|pdf
 * Download a receipt as JSON. Must be registered before /detail/:receiptId.
 */
router.get(
  '/detail/:receiptId/download',
  receiptController.downloadReceipt,
);

/**
 * GET /api/v1/receipt/detail/:receiptId
 * Full receipt detail — PaymentEntitlement + BlockchainReceipt + timeline.
 */
router.get(
  '/detail/:receiptId',
  receiptController.getReceiptDetail,
);

// ── Existing ReceiptRegistryV2 routes ──────────────────────────────────────

/**
 * POST /api/v1/receipt/publish
 * Calls publishV2() on ReceiptRegistryV2. Derives all 8 ABI fields from DB.
 */
router.post(
  '/publish',
  validate(receiptValidation.publishSchema),
  receiptController.publishReceipt,
);

/**
 * GET /api/v1/receipt/status/:receiptId
 * Returns lightweight registration status for a receipt.
 * Must be registered BEFORE the wildcard /:workflowId route.
 */
router.get(
  '/status/:receiptId',
  validate(receiptValidation.getStatusSchema),
  receiptController.getStatus,
);

/**
 * POST /api/v1/receipt/verify
 * Re-verifies a receipt by recomputing traceHash from DB and confirming registration.
 */
router.post(
  '/verify',
  validate(receiptValidation.verifyReceiptSchema),
  receiptController.verifyReceipt,
);

/**
 * POST /api/v1/receipt/verify-inclusion
 * Stateless Merkle inclusion proof check via verifyInclusion() (pure view function).
 * Body: { root: bytes32, leaf: bytes32, proof: bytes32[] }
 */
router.post(
  '/verify-inclusion',
  validate(receiptValidation.verifyInclusionSchema),
  receiptController.verifyInclusion,
);

/**
 * GET /api/v1/receipt/:workflowId
 * Returns the full receipt with all V2 fields and persisted ReceiptV2 events.
 */
router.get(
  '/:workflowId',
  validate(receiptValidation.getReceiptSchema),
  receiptController.getReceipt,
);

export default router;

