import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import ApiError from '../utils/ApiError';
import { verifyToken } from '../utils/tokens';
import prisma from '../utils/prisma';
import logger from '../utils/logger';

/**
 * Authentication Middleware — `authenticate`
 *
 * Validates the Bearer token from the Authorization header.
 * On success: attaches the user (without password) to req.user.
 * On failure: forwards a 401 Unauthorized error.
 *
 * Token validation steps:
 * 1. Parse Bearer token from Authorization header
 * 2. Verify JWT signature and expiry
 * 3. Confirm token type is ACCESS (not REFRESH or RESET_PASSWORD)
 * 4. Load user from database and confirm they still exist
 * 5. Attach stripped user to req.user
 */
export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Missing or malformed Authorization header'));
    }

    const token = authHeader.split(' ')[1];

    // Verify the JWT signature and expiry
    let payload;
    try {
      payload = verifyToken(token);
    } catch (err: any) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, err.message || 'Invalid token'));
    }

    // Ensure only access tokens are accepted here
    if (payload.type !== 'ACCESS') {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Invalid token type — access token required'));
    }

    // Load the user from DB to confirm they still exist and aren't deleted
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        displayName: true,
        did: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        // Eagerly load the user's wallets so /auth/me can surface the
        // primary wallet address for the dashboard. Empty array if none.
        wallets: {
          select: {
            id: true,
            address: true,
            chain: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        // password is intentionally excluded
      },
    });

    if (!user) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'User no longer exists'));
    }

    // Normalise: a user with no wallets gets `wallets: []` for a stable shape
    // that matches SafeUser in src/types/auth.types.ts. The Prisma select
    // above can return undefined if the relation was never loaded.
    const safeUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      did: user.did,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      wallets: user.wallets ?? [],
    };
    req.user = safeUser;
    next();
  } catch (error) {
    logger.error('Unexpected error in authenticate middleware', error);
    next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication failed'));
  }
};

/** Convenience alias — use `auth` as the middleware name in routes. */
export const auth = authenticate;
