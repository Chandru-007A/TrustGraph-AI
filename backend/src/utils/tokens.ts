import jwt, { SignOptions } from 'jsonwebtoken';
import config from '../config/config';
import { Role } from '@prisma/client';
import { TokenPayload } from '../types/auth.types';

/**
 * Generate a signed JWT.
 * Role is embedded in the payload so authorization middleware
 * can enforce RBAC without an additional database round-trip.
 */
export const generateToken = (
  userId: string,
  role: Role,
  expires: Date,
  type: TokenPayload['type'],
): string => {
  const payload: Omit<TokenPayload, 'iat' | 'exp'> & { exp: number; iat: number } = {
    sub: userId,
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(expires.getTime() / 1000),
    type,
  };
  return jwt.sign(payload, config.jwt.secret as jwt.Secret);
};

/**
 * Verify and decode a JWT.
 * Throws a clean error if the token is expired, tampered with, or malformed.
 */
export const verifyToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, config.jwt.secret as jwt.Secret) as TokenPayload;
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    }
    throw new Error('Invalid or malformed token');
  }
};
