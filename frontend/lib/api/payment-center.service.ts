// frontend/lib/api/payment-center.service.ts
import apiClient from './client';
import type { Pagination } from './workflow.types';

export interface PaginatedResponse<T> {
  items: T[];
  pagination: Pagination;
}

export interface PaymentStats {
  totalSpent: number;
  todaySpent: number;
  successfulCount: number;
  pendingCount: number;
  failedCount: number;
  purchasedNodes: number;
}

export interface PaymentAnalytics {
  dailySpending: { date: string; amount: number }[];
  successVsFailed: { name: string; value: number }[];
  gatewayVsDirect: { name: string; value: number }[];
}

export interface PaymentHistoryItem {
  id: string;
  paymentReference: string;
  workflowId: string;
  sessionId: string;
  nodeId: string;
  nodeName: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  txHash: string | null;
}

export interface PaymentCenterDetail {
  payment: {
    id: string;
    paymentReference: string;
    workflowId: string;
    nodeId: string;
    walletAddress: string;
    amount: number;
    currency: string;
    paymentStatus: string;
    paidAt: string | null;
    createdAt: string;
  };
  node: {
    id: string;
    nodeName: string;
    sessionId: string;
  } | null;
  gateway: {
    transactionId: string;
    status: string;
    txHash: string | null;
    sourceChain: string | null;
    destinationChain: string | null;
    createdAt: string;
    confirmedAt: string | null;
    explorerUrl: string | null;
  } | null;
  blockchain: {
    receiptId: string;
    onChainId: string | null;
    contract: string | null;
    status: string;
    txHash: string;
  } | null;
  verification: {
    status: string;
    verifiedAt: string;
  } | null;
}

export interface GetHistoryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

class PaymentCenterService {
  async getStats(): Promise<PaymentStats> {
    const res = await apiClient.get<PaymentStats>('/payment/stats');
    return res.data;
  }

  async getAnalytics(): Promise<PaymentAnalytics> {
    const res = await apiClient.get<PaymentAnalytics>('/payment/analytics');
    return res.data;
  }

  async getHistory(params?: GetHistoryParams): Promise<PaginatedResponse<PaymentHistoryItem>> {
    const res = await apiClient.get<PaginatedResponse<PaymentHistoryItem>>('/payment/center-history', {
      params,
    });
    return res.data;
  }

  async getDetail(paymentReference: string): Promise<PaymentCenterDetail> {
    const res = await apiClient.get<PaymentCenterDetail>(`/payment/center-detail/${paymentReference}`);
    return res.data;
  }
}

export const paymentCenterService = new PaymentCenterService();
