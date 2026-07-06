// frontend/lib/api/gateway.service.ts
// ----------------------------------------------------------------------------
// Frozen-object service for the Circle Gateway Unified Balance surface.
//
// Two endpoints are exposed to the dashboard:
//   • GET /gateway/status   — runtime mode (LIVE | MOCK) + network
//   • GET /gateway/balance  — the calling user's USDC unified balance
//
// The `getBalance` call does NOT require a walletAddress — the backend's
// gateway controller resolves the user's wallet from their auth session
// (or falls back to a deterministic keccak256-derived address), so the
// frontend can fetch a balance before the user connects a wallet.
// ----------------------------------------------------------------------------

import apiClient from './client';
import { extractError } from './errors';
import type { ApiResponse } from './types';

export type GatewayToken = 'USDC' | 'USDT';

export interface GatewayChainBalance {
  chain: string;
  confirmedBalance: string;
  pendingBalance?: string;
}

export interface GatewayBalanceSnapshot {
  walletAddress: string;
  token: GatewayToken | string;
  /** Human-readable decimal string (NOT atomic units). */
  totalConfirmed: string;
  totalPending?: string;
  breakdown: GatewayChainBalance[];
  isMock: boolean;
  capturedAt: string;
}

export interface GatewayStatus {
  mode: 'LIVE' | 'MOCK';
  network: string;
  operatorAddress?: string;
  initError?: string;
}

export interface GetBalanceOptions {
  /** Optional override; the backend falls back to the auth user's wallet. */
  walletAddress?: string;
  token?: GatewayToken;
  includePending?: boolean;
}

export const gatewayService = {
  /**
   * GET /gateway/status — runtime mode for the UI badge.
   * Public-ish (no auth required on the backend), but the interceptor
   * still attaches Authorization so the call is consistent.
   */
  async getStatus(): Promise<GatewayStatus> {
    try {
      const res = await apiClient.get<ApiResponse<GatewayStatus>>(
        '/gateway/status',
      );
      if (!res.data.data) throw new Error('Empty gateway status');
      return res.data.data;
    } catch (err) {
      throw extractError(err, 'Failed to load gateway status');
    }
  },

  /**
   * GET /gateway/balance — the user's Circle Gateway Unified Balance.
   */
  async getBalance(opts: GetBalanceOptions = {}): Promise<GatewayBalanceSnapshot> {
    try {
      const params: Record<string, string> = {};
      if (opts.walletAddress) params.walletAddress = opts.walletAddress;
      if (opts.token) params.token = opts.token;
      if (opts.includePending) params.includePending = 'true';
      const res = await apiClient.get<ApiResponse<GatewayBalanceSnapshot>>(
        '/gateway/balance',
        { params },
      );
      if (!res.data.data) throw new Error('Empty balance snapshot');
      return res.data.data;
    } catch (err) {
      throw extractError(err, 'Failed to load balance');
    }
  },
};
