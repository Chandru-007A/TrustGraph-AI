// frontend/lib/api/payment.service.ts
// ----------------------------------------------------------------------------
// Frozen-object service for the payment entitlement endpoints.
//
// The backend exposes the user's full payment history + per-payment
// status. The frontend caches the history in React Query (so the
// dashboard table updates after every successful unlock without a
// full page reload) and pulls a single entitlement on the receipt
// deep-link.
//
// All methods share the standard contract: throws `Error` with a
// user-friendly `message` (extracted by `extractError`) so sonner
// toasts display a clean string.
// ----------------------------------------------------------------------------

import apiClient from './client';
import { extractError } from './errors';
import type { ApiResponse } from './types';

export type PaymentEntitlementStatus =
  | 'UNPAID'
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'REFUNDED';

export interface PaymentEntitlementRow {
  id: string;
  workflowId: string;
  nodeId: string;
  walletAddress: string;
  paymentReference: string;
  /** Human-readable amount, e.g. "0.005" (NOT atomic units). */
  amount: string;
  currency: string;
  paymentStatus: PaymentEntitlementStatus;
  paidAt: string | null;
  expiresAt: string | null;
  facilitatorReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export const paymentService = {
  /**
   * GET /payment/history — the authenticated user's full payment
   * entitlements, newest first (per backend `orderBy: createdAt desc`).
   */
  async getHistory(): Promise<PaymentEntitlementRow[]> {
    try {
      const res = await apiClient.get<ApiResponse<PaymentEntitlementRow[]>>(
        '/payment/history',
      );
      return res.data.data ?? [];
    } catch (err) {
      throw extractError(err, 'Failed to load payment history');
    }
  },

  /**
   * GET /payment/status/:paymentId — single entitlement detail.
   * Used by the "View Receipt" deep-link from the modal success state.
   */
  async getStatus(paymentId: string): Promise<PaymentEntitlementRow> {
    try {
      const res = await apiClient.get<ApiResponse<PaymentEntitlementRow>>(
        `/payment/status/${encodeURIComponent(paymentId)}`,
      );
      if (!res.data.data) throw new Error('Payment entitlement not found');
      return res.data.data;
    } catch (err) {
      throw extractError(err, 'Failed to load payment status');
    }
  },
};
