// frontend/lib/api/wallet.service.ts
// ----------------------------------------------------------------------------
// Wallet persistence service — thin wrapper over the backend's
// POST /api/v1/users/me/wallet endpoint.
//
// All methods share the same error-handling contract as the other
// service modules in this layer: a thrown `Error` with a user-friendly
// `message` (extracted by the shared `extractError` helper) for sonner
// toasts in the UI.
// ----------------------------------------------------------------------------

import apiClient from './client';
import { extractError } from './errors';
import type { ApiResponse, UserWallet } from './types';

export interface LinkWalletPayload {
  address: string;
  chain: string;
  connector?: string;
  connectedAt?: string;
}

export const walletService = {
  /**
   * POST /users/me/wallet
   *
   * Idempotent — the backend upserts on (userId, address). Calling
   * twice with the same address is safe and updates the `connector`
   * + `connectedAt` fields.
   */
  async linkWallet(payload: LinkWalletPayload): Promise<UserWallet> {
    try {
      const res = await apiClient.post<ApiResponse<UserWallet>>(
        '/users/me/wallet',
        payload,
      );
      if (!res.data.data) throw new Error('Invalid server response');
      return res.data.data;
    } catch (err) {
      throw extractError(err, 'Failed to link wallet');
    }
  },

  /**
   * GET /users/me/wallet
   * Returns the calling user's persisted wallets, oldest first.
   */
  async listWallets(): Promise<UserWallet[]> {
    try {
      const res = await apiClient.get<ApiResponse<UserWallet[]>>(
        '/users/me/wallet',
      );
      return res.data.data ?? [];
    } catch (err) {
      throw extractError(err, 'Failed to load wallets');
    }
  },

  /**
   * DELETE /users/me/wallet/:id
   * Removes the row. The backend returns 204 on success and 404 if the
   * wallet does not belong to the calling user.
   */
  async unlinkWallet(walletId: string): Promise<void> {
    try {
      await apiClient.delete(`/users/me/wallet/${walletId}`);
    } catch (err) {
      throw extractError(err, 'Failed to unlink wallet');
    }
  },
};
