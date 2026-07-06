// backend/src/routes/v1/wallet.route.ts
// ----------------------------------------------------------------------------
// Router for the /users/me/wallet endpoints.
//
// All routes require authentication (`auth` middleware from
// auth.middleware.ts). Mounted under /users in routes/v1/index.ts, BEFORE
// userRoute, so the /me/wallet paths are not shadowed by userRoute's
// `/:id` parameterised route.
// ----------------------------------------------------------------------------

import express from 'express';
import * as walletController from '../../controllers/wallet.controller';
import validate from '../../middlewares/validate.middleware';
import * as walletValidation from '../../validations/wallet.validation';
import { auth } from '../../middlewares/auth.middleware';

const router = express.Router();

/**
 * POST /api/v1/users/me/wallet
 * Idempotent link — upserts the connected wallet for the calling user.
 */
router.post(
  '/me/wallet',
  auth,
  validate(walletValidation.linkWalletSchema),
  walletController.linkWallet,
);

/**
 * GET /api/v1/users/me/wallet
 * List the calling user's persisted wallets.
 */
router.get('/me/wallet', auth, walletController.listMyWallets);

/**
 * DELETE /api/v1/users/me/wallet/:id
 * Remove a wallet from the calling user. Foreign wallets return 404.
 */
router.delete(
  '/me/wallet/:id',
  auth,
  validate(walletValidation.unlinkWalletSchema),
  walletController.unlinkWallet,
);

export default router;
