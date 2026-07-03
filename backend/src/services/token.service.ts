import { TokenType, Role } from '@prisma/client';
import config from '../config/config';
import prisma from '../utils/prisma';
import { generateToken, verifyToken } from '../utils/tokens';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';
import logger from '../utils/logger';
import { AuthTokens } from '../types/auth.types';

/**
 * Persist a token record in the database.
 * Only REFRESH and RESET_PASSWORD tokens are stored.
 * ACCESS tokens are stateless and never stored.
 */
export const saveToken = async (
  token: string,
  userId: string,
  expires: Date,
  type: TokenType,
  blacklisted = false,
) => {
  return prisma.token.create({
    data: { token, userId, expires, type, blacklisted },
  });
};

/**
 * Verify a stored token (REFRESH or RESET_PASSWORD).
 * Confirms:
 *   1. JWT signature and expiry are valid
 *   2. Token exists in the database and is not blacklisted
 *   3. Token has not expired (extra DB-level check)
 */
export const verifyDbToken = async (token: string, type: TokenType) => {
  let payload;
  try {
    payload = verifyToken(token);
  } catch (err: any) {
    throw new ApiError(httpStatus.UNAUTHORIZED, err.message || 'Invalid token');
  }

  const tokenDoc = await prisma.token.findFirst({
    where: {
      token,
      type,
      userId: payload.sub,
      blacklisted: false,
      expires: { gte: new Date() }, // DB-level expiry check as second layer
    },
  });

  if (!tokenDoc) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Token is invalid or has expired');
  }

  return tokenDoc;
};

/**
 * Generate a paired access + refresh token set.
 * The refresh token is saved to the database.
 * The access token is stateless (not stored).
 */
export const generateAuthTokens = async (userId: string, role: Role): Promise<AuthTokens> => {
  const accessTokenExpires = new Date(
    Date.now() + config.jwt.accessExpirationMinutes * 60 * 1000,
  );
  const accessToken = generateToken(userId, role, accessTokenExpires, 'ACCESS');

  const refreshTokenExpires = new Date(
    Date.now() + config.jwt.refreshExpirationDays * 24 * 60 * 60 * 1000,
  );
  const refreshToken = generateToken(userId, role, refreshTokenExpires, 'REFRESH');

  await saveToken(refreshToken, userId, refreshTokenExpires, TokenType.REFRESH);

  return {
    access: { token: accessToken, expires: accessTokenExpires },
    refresh: { token: refreshToken, expires: refreshTokenExpires },
  };
};

/**
 * Generate a password reset token.
 * Deletes any existing reset tokens for the user before creating a new one.
 * Returns the raw token string (caller is responsible for emailing it).
 */
export const generateResetPasswordToken = async (email: string): Promise<string> => {
  const user = await prisma.user.findUnique({ where: { email } });

  // Security: Do NOT reveal whether the email exists or not.
  // Return a success-like response regardless. Caller handles the messaging.
  if (!user) {
    logger.warn(`Reset password requested for non-existent email: ${email}`);
    return ''; // Caller should treat empty string as "no action needed"
  }

  // Clean up any existing reset tokens to prevent accumulation
  await prisma.token.deleteMany({
    where: { userId: user.id, type: TokenType.RESET_PASSWORD },
  });

  const expires = new Date(
    Date.now() + config.jwt.resetPasswordExpirationMinutes * 60 * 1000,
  );
  const resetToken = generateToken(user.id, user.role, expires, 'RESET_PASSWORD');
  await saveToken(resetToken, user.id, expires, TokenType.RESET_PASSWORD);

  return resetToken;
};

/**
 * Delete all refresh tokens for a user — used during logout.
 */
export const deleteRefreshTokensForUser = async (userId: string): Promise<void> => {
  await prisma.token.deleteMany({
    where: { userId, type: TokenType.REFRESH },
  });
};
