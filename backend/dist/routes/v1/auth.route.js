"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController = __importStar(require("../../controllers/auth.controller"));
const validate_middleware_1 = __importDefault(require("../../middlewares/validate.middleware"));
const authValidation = __importStar(require("../../validations/auth.validation"));
const rateLimiter_1 = require("../../middlewares/rateLimiter");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const router = express_1.default.Router();
// ─────────────────────────────────────────────────────────────────────────────
// Public Routes — no authentication required
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/v1/auth/register
 * Rate limited: 10 requests / 15 min per IP (failed only)
 */
router.post('/register', rateLimiter_1.authLimiter, (0, validate_middleware_1.default)(authValidation.registerSchema), authController.register);
/**
 * POST /api/v1/auth/login
 * Rate limited: 10 requests / 15 min per IP (failed only)
 */
router.post('/login', rateLimiter_1.authLimiter, (0, validate_middleware_1.default)(authValidation.loginSchema), authController.login);
/**
 * POST /api/v1/auth/refresh
 * Rotates refresh token — no auth middleware needed (token in body/cookie)
 */
router.post('/refresh', (0, validate_middleware_1.default)(authValidation.refreshTokenSchema), authController.refreshTokens);
/**
 * POST /api/v1/auth/logout
 * Deletes refresh token — works even if already logged out (idempotent)
 */
router.post('/logout', authController.logout);
/**
 * POST /api/v1/auth/forgot-password
 * Rate limited: 10 requests / 15 min per IP
 */
router.post('/forgot-password', rateLimiter_1.authLimiter, (0, validate_middleware_1.default)(authValidation.forgotPasswordSchema), authController.forgotPassword);
/**
 * POST /api/v1/auth/reset-password
 * Rate limited: 10 requests / 15 min per IP
 */
router.post('/reset-password', rateLimiter_1.authLimiter, (0, validate_middleware_1.default)(authValidation.resetPasswordSchema), authController.resetPassword);
// ─────────────────────────────────────────────────────────────────────────────
// Protected Routes — require valid access token
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/v1/auth/me
 * Returns the currently authenticated user's profile.
 */
router.get('/me', auth_middleware_1.auth, authController.getMe);
/**
 * POST /api/v1/auth/change-password
 * Rate limited: 5 requests / 1 hour per IP
 * Requires authentication.
 */
router.post('/change-password', auth_middleware_1.auth, rateLimiter_1.passwordChangeLimiter, (0, validate_middleware_1.default)(authValidation.changePasswordSchema), authController.changePassword);
exports.default = router;
