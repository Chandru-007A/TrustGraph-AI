// src/routes/v1/gateway.route.ts
// ─────────────────────────────────────────────────────────────────────────────
// REST routes for Circle Gateway Unified Balance.
//
// Auth:
//   - All non-webhook endpoints require `auth` middleware (user session).
//   - The webhook endpoint is PUBLIC but signature-protected (HMAC-SHA256).
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import * as gatewayController from '../../controllers/gateway.controller';
import validate from '../../middlewares/validate.middleware';
import * as gatewayValidation from '../../validations/gateway.validation';
import { auth } from '../../middlewares/auth.middleware';
import { gatewayWebhookJsonParser } from '../../middlewares/gateway-webhook.middleware';

const router = express.Router();

/**
 * POST /api/v1/gateway/webhooks
 * PUBLIC — protected by HMAC-SHA256 signature.
 * NOTE: This route is registered *first* and *without* the global JSON
 * body parser so the raw bytes can be captured for HMAC validation.
 * The route uses its own JSON parser with a `verify` hook.
 */
router.post(
  '/webhooks',
  gatewayWebhookJsonParser,
  validate(gatewayValidation.webhookSchema),
  gatewayController.ingestWebhook,
);

// All other routes are auth-protected
router.use(auth);

/**
 * GET /api/v1/gateway/status
 * Public-ish runtime status (mode, network, operator address).
 */
router.get('/status', gatewayController.getStatus);

/**
 * POST /api/v1/gateway/deposit
 * Body: { walletAddress, amount, sourceChain?, token? }
 */
router.post(
  '/deposit',
  validate(gatewayValidation.depositSchema),
  gatewayController.deposit,
);

/**
 * POST /api/v1/gateway/spend
 * Body: { walletAddress, amount, destinationChain, destinationAddress, workflowId?, nodeId?, paymentReference? }
 */
router.post(
  '/spend',
  validate(gatewayValidation.spendSchema),
  gatewayController.spend,
);

/**
 * GET /api/v1/gateway/balance?walletAddress=0x...
 */
router.get(
  '/balance',
  validate(gatewayValidation.balanceSchema),
  gatewayController.getBalance,
);

/**
 * GET /api/v1/gateway/transactions
 */
router.get(
  '/transactions',
  validate(gatewayValidation.transactionsQuerySchema),
  gatewayController.getTransactions,
);

/**
 * GET /api/v1/gateway/transactions/:id
 */
router.get('/transactions/:id', gatewayController.getTransactionById);

export default router;
