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
exports.resetPassword = exports.forgotPassword = exports.changePassword = exports.getMe = exports.logout = exports.refreshTokens = exports.login = exports.register = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../utils/catchAsync"));
const authService = __importStar(require("../services/auth.service"));
const tokenService = __importStar(require("../services/token.service"));
const ApiResponse_1 = __importDefault(require("../utils/ApiResponse"));
const config_1 = __importDefault(require("../config/config"));
/** Helper: set refresh token cookie with correct production-grade options. */
const setRefreshCookie = (res, token, expires) => {
    res.cookie('refreshToken', token, {
        httpOnly: true, // Not accessible by JavaScript
        secure: config_1.default.isProduction, // HTTPS-only in production
        sameSite: config_1.default.isProduction ? 'strict' : 'lax', // CSRF protection
        expires,
    });
};
/** Helper: clear refresh token cookie. */
const clearRefreshCookie = (res) => {
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: config_1.default.isProduction,
        sameSite: config_1.default.isProduction ? 'strict' : 'lax',
    });
};
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/register
// ─────────────────────────────────────────────────────────────────────────────
exports.register = (0, catchAsync_1.default)(async (req, res) => {
    const user = await authService.registerUser(req.body);
    const tokens = await tokenService.generateAuthTokens(user.id, user.role);
    setRefreshCookie(res, tokens.refresh.token, tokens.refresh.expires);
    res.status(http_status_1.default.CREATED).json(new ApiResponse_1.default(http_status_1.default.CREATED, 'Registration successful', { user, tokens }));
});
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/login
// ─────────────────────────────────────────────────────────────────────────────
exports.login = (0, catchAsync_1.default)(async (req, res) => {
    const { email, password } = req.body;
    const user = await authService.loginWithEmailAndPassword(email, password);
    const tokens = await tokenService.generateAuthTokens(user.id, user.role);
    setRefreshCookie(res, tokens.refresh.token, tokens.refresh.expires);
    // Never return the password hash in responses
    const { password: _, ...safeUser } = user;
    res.status(http_status_1.default.OK).json(new ApiResponse_1.default(http_status_1.default.OK, 'Login successful', { user: safeUser, tokens }));
});
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/refresh
// ─────────────────────────────────────────────────────────────────────────────
exports.refreshTokens = (0, catchAsync_1.default)(async (req, res) => {
    // Accept token from cookie (preferred) or request body (API clients)
    const refreshToken = req.cookies?.refreshToken ?? req.body?.refreshToken;
    if (!refreshToken) {
        return res
            .status(http_status_1.default.UNAUTHORIZED)
            .json(new ApiResponse_1.default(http_status_1.default.UNAUTHORIZED, 'Refresh token not provided'));
    }
    // Rotate the token — old one is invalidated, new pair is issued
    const user = await authService.refreshUserToken(refreshToken);
    const tokens = await tokenService.generateAuthTokens(user.id, user.role);
    setRefreshCookie(res, tokens.refresh.token, tokens.refresh.expires);
    res.status(http_status_1.default.OK).json(new ApiResponse_1.default(http_status_1.default.OK, 'Tokens refreshed successfully', { tokens }));
});
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/logout
// ─────────────────────────────────────────────────────────────────────────────
exports.logout = (0, catchAsync_1.default)(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken ?? req.body?.refreshToken;
    if (refreshToken) {
        await authService.logoutUser(refreshToken);
    }
    clearRefreshCookie(res);
    res.status(http_status_1.default.NO_CONTENT).send();
});
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/auth/me
// ─────────────────────────────────────────────────────────────────────────────
exports.getMe = (0, catchAsync_1.default)(async (req, res) => {
    // req.user is populated by auth middleware (password already excluded)
    res.status(http_status_1.default.OK).json(new ApiResponse_1.default(http_status_1.default.OK, 'Current user', req.user));
});
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/change-password
// ─────────────────────────────────────────────────────────────────────────────
exports.changePassword = (0, catchAsync_1.default)(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    await authService.changeUserPassword(req.user.id, oldPassword, newPassword);
    // Clear the refresh cookie — user must log in again on all devices
    clearRefreshCookie(res);
    res.status(http_status_1.default.OK).json(new ApiResponse_1.default(http_status_1.default.OK, 'Password changed successfully. Please log in again.'));
});
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/forgot-password
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Architecture Note:
 * This endpoint always returns 200 OK regardless of whether the email exists.
 * This prevents email enumeration attacks.
 *
 * In a full production system:
 *   1. generateResetPasswordToken returns a token if user exists
 *   2. An email service (SendGrid, Resend, SES) emails the link
 *   3. The link contains the token in a URL param
 *
 * For this implementation, the token is returned in the response body
 * for testing purposes. In production, remove this and send via email only.
 */
exports.forgotPassword = (0, catchAsync_1.default)(async (req, res) => {
    const { email } = req.body;
    const resetToken = await tokenService.generateResetPasswordToken(email);
    // Always return the same response to prevent email enumeration
    const responseData = config_1.default.isProduction
        ? undefined
        : resetToken ? { resetToken } : undefined; // Only expose token in development
    res.status(http_status_1.default.OK).json(new ApiResponse_1.default(http_status_1.default.OK, 'If an account with that email exists, a password reset link has been sent.', responseData));
});
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/reset-password
// ─────────────────────────────────────────────────────────────────────────────
exports.resetPassword = (0, catchAsync_1.default)(async (req, res) => {
    const { token, newPassword } = req.body;
    await authService.resetUserPassword(token, newPassword);
    res.status(http_status_1.default.OK).json(new ApiResponse_1.default(http_status_1.default.OK, 'Password has been reset successfully. Please log in.'));
});
