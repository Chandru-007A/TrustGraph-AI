// src/types/auth.types.ts
// Shared TypeScript interfaces and types used across the authentication module.

import { Role } from '@prisma/client';

/** The shape of the JWT payload encoded in both access and refresh tokens. */
export interface TokenPayload {
  sub: string;       // userId
  role: Role;        // user's role — used for RBAC without a DB hit on every request
  iat: number;       // issued at (epoch seconds)
  exp: number;       // expiry (epoch seconds)
  type: 'ACCESS' | 'REFRESH' | 'RESET_PASSWORD';
}

export interface UserWallet {
  id: string;
  address: string;
  chain: string;
  createdAt: Date;
}

/** Returned from generateAuthTokens — both tokens with their expiry dates. */
export interface AuthTokens {
  access: {
    token: string;
    expires: Date;
  };
  refresh: {
    token: string;
    expires: Date;
  };
}

/** Sanitised user object — password is always stripped before returning to clients. */
export interface SafeUser {
  id: string;
  email: string;
  displayName: string | null;
  did: string | null;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
  /** Wallets attached to the user. Always present; empty array if none. */
  wallets: UserWallet[];
}

/** Body of a successful login/register response. */
export interface AuthResponse {
  user: SafeUser;
  tokens: AuthTokens;
}
