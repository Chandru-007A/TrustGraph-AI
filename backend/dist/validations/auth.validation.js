"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshTokenSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.changePasswordSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
/**
 * Password policy:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 digit
 * - At least 1 special character
 */
const passwordSchema = zod_1.z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');
const emailSchema = zod_1.z
    .string()
    .email('Invalid email address')
    .toLowerCase() // Normalise to lowercase
    .trim();
// ─────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────
exports.registerSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: emailSchema,
        password: passwordSchema,
        displayName: zod_1.z
            .string()
            .min(2, 'Display name must be at least 2 characters')
            .max(50, 'Display name must be at most 50 characters')
            .trim()
            .optional(),
        role: zod_1.z
            .nativeEnum(client_1.Role)
            .optional()
            .default(client_1.Role.CONSUMER)
            .refine((val) => val !== client_1.Role.ADMIN, { message: 'Cannot self-assign ADMIN role' }),
    }),
});
// ─────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────
exports.loginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: emailSchema,
        password: zod_1.z.string().min(1, 'Password is required'),
    }),
});
// ─────────────────────────────────────────────
// Change Password
// ─────────────────────────────────────────────
exports.changePasswordSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        oldPassword: zod_1.z.string().min(1, 'Old password is required'),
        newPassword: passwordSchema,
        confirmPassword: zod_1.z.string().min(1, 'Confirm password is required'),
    })
        .refine((data) => data.newPassword === data.confirmPassword, {
        message: 'New password and confirm password do not match',
        path: ['confirmPassword'],
    })
        .refine((data) => data.oldPassword !== data.newPassword, {
        message: 'New password must be different from old password',
        path: ['newPassword'],
    }),
});
// ─────────────────────────────────────────────
// Forgot Password
// ─────────────────────────────────────────────
exports.forgotPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: emailSchema,
    }),
});
// ─────────────────────────────────────────────
// Reset Password
// ─────────────────────────────────────────────
exports.resetPasswordSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        token: zod_1.z.string().min(1, 'Reset token is required'),
        newPassword: passwordSchema,
        confirmPassword: zod_1.z.string().min(1, 'Confirm password is required'),
    })
        .refine((data) => data.newPassword === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    }),
});
// ─────────────────────────────────────────────
// Refresh Token
// ─────────────────────────────────────────────
exports.refreshTokenSchema = zod_1.z.object({
    body: zod_1.z.object({
        refreshToken: zod_1.z.string().min(1, 'Refresh token is required').optional(),
    }),
});
