import httpStatus from 'http-status';
import { Role, TokenType } from '@prisma/client';
import prisma from '../utils/prisma';
import ApiError from '../utils/ApiError';
import { hashPassword, isPasswordMatch } from '../utils/encryption';
import { verifyDbToken, deleteRefreshTokensForUser } from './token.service';
import { SafeUser } from '../types/auth.types';
import logger from '../utils/logger';

/** Strip password from user object before returning to any client. */
const toSafeUser = (user: { password: string } & Record<string, any>): SafeUser => {
  const { password, wallets, ...safe } = user;
  return { ...(safe as Omit<SafeUser, 'wallets'>), wallets: wallets ?? [] };
};

// ─────────────────────────────────────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a new user.
 * Throws 409 if the email is already taken.
 * Returns the created user without the password field, with an empty
 * `wallets` array (new users have no wallets yet).
 */
export const registerUser = async (data: {
  email: string;
  password: string;
  displayName?: string;
  role?: Role;
}): Promise<SafeUser> => {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, 'Email address is already registered');
  }

  const hashedPassword = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      displayName: data.displayName ?? null,
      role: data.role ?? Role.CONSUMER,
    },
  });

  logger.info(`New user registered: ${user.email} (role: ${user.role})`);
  return toSafeUser(user);
};

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Authenticate a user with email and password.
 * Returns the full user object (including role) for token generation.
 * Eagerly loads the user's wallets so the login response shape matches
 * what /auth/me returns (no client-side flicker after login).
 * Throws 401 with a generic message — never reveals whether the email exists.
 */
export const loginWithEmailAndPassword = async (
  email: string,
  password: string,
) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      wallets: {
        select: { id: true, address: true, chain: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  // Use constant-time comparison even for missing users to prevent timing attacks
  const passwordValid = user ? await isPasswordMatch(password, user.password) : false;

  if (!user || !passwordValid) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid email or password');
  }

  logger.info(`User logged in: ${user.email}`);
  return toSafeUser(user);
};

// ─────────────────────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Logout user by deleting their refresh token from the database.
 * If no token is found, we still return success (idempotent logout).
 */
export const logoutUser = async (refreshToken: string): Promise<void> => {
  const tokenDoc = await prisma.token.findFirst({
    where: { token: refreshToken, type: TokenType.REFRESH, blacklisted: false },
  });

  if (tokenDoc) {
    await prisma.token.delete({ where: { id: tokenDoc.id } });
    logger.info(`Refresh token deleted for user: ${tokenDoc.userId}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Refresh Tokens
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rotate refresh token — invalidate old one, return the user for new token generation.
 * Implements "refresh token rotation" — each refresh produces a new refresh token.
 */
export const refreshUserToken = async (refreshToken: string) => {
  const tokenDoc = await verifyDbToken(refreshToken, TokenType.REFRESH);
  const user = await prisma.user.findUnique({ where: { id: tokenDoc.userId } });

  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User no longer exists');
  }

  // Delete the consumed refresh token (rotation)
  await prisma.token.delete({ where: { id: tokenDoc.id } });

  return user;
};

// ─────────────────────────────────────────────────────────────────────────────
// Change Password
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Change a user's password.
 * Validates old password, updates to new hash, and invalidates all refresh tokens
 * to force re-login on all devices.
 */
export const changeUserPassword = async (
  userId: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const isMatch = await isPasswordMatch(oldPassword, user.password);
  if (!isMatch) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect current password');
  }

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });

  // Invalidate all active sessions by deleting all refresh tokens
  await deleteRefreshTokensForUser(userId);

  logger.info(`Password changed for user: ${user.email}. All sessions invalidated.`);
};

// ─────────────────────────────────────────────────────────────────────────────
// Reset Password
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reset a user's password using a valid reset token.
 * On success: updates password, deletes all reset tokens, deletes all refresh tokens.
 */
export const resetUserPassword = async (
  resetToken: string,
  newPassword: string,
): Promise<void> => {
  const tokenDoc = await verifyDbToken(resetToken, TokenType.RESET_PASSWORD);

  const user = await prisma.user.findUnique({ where: { id: tokenDoc.userId } });
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } }),
    prisma.token.deleteMany({ where: { userId: user.id, type: TokenType.RESET_PASSWORD } }),
    prisma.token.deleteMany({ where: { userId: user.id, type: TokenType.REFRESH } }),
  ]);

  logger.info(`Password reset for user: ${user.email}. All sessions invalidated.`);
};

// ─────────────────────────────────────────────────────────────────────────────
// Get Current User
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a user's profile by ID, returning a safe user (no password).
 */
export const getUserById = async (userId: string): Promise<SafeUser> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  return toSafeUser(user);
};
