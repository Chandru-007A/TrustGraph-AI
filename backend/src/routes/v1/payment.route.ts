// src/routes/v1/payment.route.ts

import express from 'express';
import * as paymentController from '../../controllers/payment.controller';
import validate from '../../middlewares/validate.middleware';
import * as paymentValidation from '../../validations/payment.validation';
import { auth } from '../../middlewares/auth.middleware';

const router = express.Router();

// Require authorization for all payment routes
router.use(auth);

/**
 * POST /api/v1/payment/create
 * Creates a payment challenge for a given node.
 */
router.post(
  '/create',
  validate(paymentValidation.createPaymentChallengeSchema),
  paymentController.createChallenge,
);

/**
 * POST /api/v1/payment/verify
 * Settle payment by verifying the signature.
 */
router.post(
  '/verify',
  validate(paymentValidation.verifyPaymentSignatureSchema),
  paymentController.verifyPayment,
);

/**
 * GET /api/v1/payment/history
 * Gets user's payment entitlements history.
 */
router.get(
  '/history',
  paymentController.getPaymentHistory,
);

/**
 * GET /api/v1/payment/status/:paymentId
 * Get status of specific payment entitlement.
 */
router.get(
  '/status/:paymentId',
  validate(paymentValidation.getPaymentStatusSchema),
  paymentController.getPaymentStatus,
);

/**
 * GET /api/v1/payment/stats
 */
router.get('/stats', paymentController.getPaymentStats);

/**
 * GET /api/v1/payment/analytics
 */
router.get('/analytics', paymentController.getPaymentAnalytics);

/**
 * GET /api/v1/payment/center-history
 */
router.get('/center-history', paymentController.getPaymentCenterHistory);

/**
 * GET /api/v1/payment/center-detail/:paymentReference
 */
router.get('/center-detail/:paymentReference', paymentController.getPaymentDetail);

export default router;
