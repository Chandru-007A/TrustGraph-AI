// frontend/lib/api/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types matching the backend's auth + ApiResponse contract.
// The backend returns the standard ApiResponse envelope:
//   { statusCode, message, data }
// All "data" shapes below are derived from src/services/* on the backend.
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 'CONSUMER' | 'AGENT_OPERATOR' | 'ADMIN' | 'AUDITOR';

export interface UserWallet {
  id: string;
  address: string;
  chain: string;
  /**
   * The wallet connector used at the time of the most recent connect
   * (e.g. "metaMask" | "coinbaseWallet" | "walletConnect"). Optional —
   * older rows persisted before the field was added will be null.
   */
  connector?: string | null;
  /** ISO timestamp of the most recent connect, refreshed on every link. */
  connectedAt?: string | null;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  displayName?: string | null;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
  /** Backend now includes the user's wallets on /auth/me, login, and register. */
  wallets?: UserWallet[];
}

export interface AuthToken {
  token: string;
  expires: Date;
}

export interface AuthTokens {
  access: AuthToken;
  refresh: AuthToken;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RegisterResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RefreshResponse {
  tokens: AuthTokens;
}

/**
 * Standard backend response envelope.
 * Backend always returns 2xx with this shape on success, and an error
 * shape ({ statusCode, message }) on failure. We model both for axios.
 */
export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data?: T;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  /** Optional structured Zod error array from the validation middleware. */
  errors?: Array<{ field: string; message: string }>;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
  role?: Exclude<UserRole, 'ADMIN'>;
}

// ─── Coinbase x402 v2 wire types ────────────────────────────────────────
// Decoded forms of the base64-encoded PAYMENT-REQUIRED, PAYMENT-SIGNATURE,
// and PAYMENT-RESPONSE headers. The backend serialises through
// x402.service.ts; the shapes here mirror `X402Challenge`,
// `X402SignaturePayload`, and `X402SettlementResult` exactly.

// Decoded PAYMENT-REQUIRED header on HTTP 402.
export interface X402Accept {
  scheme: 'exact';
  network: string;
  /** Atomic units (USDC = 6 decimals). */
  amount: string;
  currency: string;
  payTo: string;
  asset: string;
  /** ISO string. */
  expires: string;
  reference: string;
}

export interface X402Challenge {
  x402Version: 2;
  error: string;
  accepts: X402Accept[];
}

// Built client-side and sent as the PAYMENT-SIGNATURE header on retry.
export interface X402SignaturePayload {
  scheme: string;
  network: string;
  payload: {
    from: string;
    to: string;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: string;
    signature: string;
    reference: string;
    txHash?: string;
  };
}

// Decoded PAYMENT-RESPONSE header on 200 after settlement.
export interface X402SettlementResult {
  success: boolean;
  paymentStatus: 'PAID' | 'FAILED' | 'EXPIRED';
  transactionHash?: string;
  payerAddress?: string;
  message: string;
}
