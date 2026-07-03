"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordChangeLimiter = exports.apiLimiter = exports.authLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
/**
 * authLimiter — Strict limiter for sensitive auth endpoints.
 * Applies to: /login, /register, /forgot-password, /reset-password
 * 10 attempts per 15 minutes per IP. Failed requests count toward the limit.
 */
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minute window
    max: 10, // 10 requests per window
    message: {
        status: 429,
        message: 'Too many authentication attempts. Please try again after 15 minutes.',
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skipSuccessfulRequests: true, // Only count failed attempts (brute-force protection)
});
/**
 * apiLimiter — General rate limiter for all API routes.
 * Applies to all /api/v1/* routes.
 * 100 requests per 15 minutes per IP.
 */
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        status: 429,
        message: 'Too many requests from this IP. Please slow down.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
/**
 * passwordChangeLimiter — Very strict limiter for password operations.
 * Applies to: /change-password
 * 5 attempts per hour per IP.
 */
exports.passwordChangeLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 5,
    message: {
        status: 429,
        message: 'Too many password change attempts. Please try again in an hour.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});
