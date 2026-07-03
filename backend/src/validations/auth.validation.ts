import { z } from 'zod';
import { Role } from '@prisma/client';

/**
 * Password policy:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 digit
 * - At least 1 special character
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const emailSchema = z
  .string()
  .email('Invalid email address')
  .toLowerCase()        // Normalise to lowercase
  .trim();

// ─────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────
export const registerSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    displayName: z
      .string()
      .min(2, 'Display name must be at least 2 characters')
      .max(50, 'Display name must be at most 50 characters')
      .trim()
      .optional(),
    role: z
      .nativeEnum(Role)
      .optional()
      .default(Role.CONSUMER)
      .refine(
        (val) => val !== Role.ADMIN,
        { message: 'Cannot self-assign ADMIN role' },
      ),
  }),
});

// ─────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────
export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
  }),
});

// ─────────────────────────────────────────────
// Change Password
// ─────────────────────────────────────────────
export const changePasswordSchema = z.object({
  body: z
    .object({
      oldPassword: z.string().min(1, 'Old password is required'),
      newPassword: passwordSchema,
      confirmPassword: z.string().min(1, 'Confirm password is required'),
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
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

// ─────────────────────────────────────────────
// Reset Password
// ─────────────────────────────────────────────
export const resetPasswordSchema = z.object({
  body: z
    .object({
      token: z.string().min(1, 'Reset token is required'),
      newPassword: passwordSchema,
      confirmPassword: z.string().min(1, 'Confirm password is required'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }),
});

// ─────────────────────────────────────────────
// Refresh Token
// ─────────────────────────────────────────────
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required').optional(),
  }),
});
