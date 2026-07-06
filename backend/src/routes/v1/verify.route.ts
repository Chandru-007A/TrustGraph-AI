// src/routes/v1/verify.route.ts
// Verification Engine API routes.

import express from 'express';
import * as verifyController from '../../controllers/verify.controller';
import validate from '../../middlewares/validate.middleware';
import * as verifyValidation from '../../validations/verify.validation';
import { auth } from '../../middlewares/auth.middleware';

const router = express.Router();

router.use(auth);

// ── Phase 24: Verification Center ──────────────────────────────────────────

/** GET /api/v1/verify/list — paginated verification list */
router.get('/list', verifyController.listVerifications);

/** GET /api/v1/verify/detail/:sessionId — full verification detail */
router.get('/detail/:sessionId', verifyController.getVerificationDetail);

// ── Existing Verification Engine endpoints ─────────────────────────────────

router.post(
  '/node',
  validate(verifyValidation.verifyNodeSchema),
  verifyController.verifyNode,
);

router.post(
  '/proof',
  validate(verifyValidation.verifyProofSchema),
  verifyController.verifyProof,
);

router.post(
  '/workflow',
  validate(verifyValidation.verifyWorkflowSchema),
  verifyController.verifyWorkflow,
);

router.get(
  '/report/:workflowId',
  validate(verifyValidation.getReportSchema),
  verifyController.getReport,
);

router.post(
  '/tamper',
  validate(verifyValidation.tamperDemoSchema),
  verifyController.tamperDemo,
);

export default router;

