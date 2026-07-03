import express from 'express';
import * as authController from '../../controllers/auth.controller';
import validate from '../../middlewares/validate.middleware';
import * as authValidation from '../../validations/auth.validation';
import { authLimiter, passwordChangeLimiter } from '../../middlewares/rateLimiter';
import { auth } from '../../middlewares/auth.middleware';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Public Routes — no authentication required
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Rate limited: 10 requests / 15 min per IP (failed only)
 */
router.post(
  '/register',
  authLimiter,
  validate(authValidation.registerSchema),
  authController.register,
);

/**
 * POST /api/v1/auth/login
 * Rate limited: 10 requests / 15 min per IP (failed only)
 */
router.post(
  '/login',
  authLimiter,
  validate(authValidation.loginSchema),
  authController.login,
);

/**
 * POST /api/v1/auth/refresh
 * Rotates refresh token — no auth middleware needed (token in body/cookie)
 */
router.post(
  '/refresh',
  validate(authValidation.refreshTokenSchema),
  authController.refreshTokens,
);

/**
 * POST /api/v1/auth/logout
 * Deletes refresh token — works even if already logged out (idempotent)
 */
router.post('/logout', authController.logout);

/**
 * POST /api/v1/auth/forgot-password
 * Rate limited: 10 requests / 15 min per IP
 */
router.post(
  '/forgot-password',
  authLimiter,
  validate(authValidation.forgotPasswordSchema),
  authController.forgotPassword,
);

/**
 * POST /api/v1/auth/reset-password
 * Rate limited: 10 requests / 15 min per IP
 */
router.post(
  '/reset-password',
  authLimiter,
  validate(authValidation.resetPasswordSchema),
  authController.resetPassword,
);

// ─────────────────────────────────────────────────────────────────────────────
// Protected Routes — require valid access token
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/auth/me
 * Returns the currently authenticated user's profile.
 */
router.get('/me', auth, authController.getMe);

/**
 * POST /api/v1/auth/change-password
 * Rate limited: 5 requests / 1 hour per IP
 * Requires authentication.
 */
router.post(
  '/change-password',
  auth,
  passwordChangeLimiter,
  validate(authValidation.changePasswordSchema),
  authController.changePassword,
);

export default router;
