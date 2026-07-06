// frontend/lib/api/admin.service.ts
import apiClient from './client';

export interface AdminOverview {
  totalUsers: number;
  activeSessions: number;
  runningWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  verificationRequests: number;
  blockchainAnchors: number;
  x402Payments: number;
  gatewayTransactions: number;
  averageWorkflowTimeMs: number;
}

export interface AdminWorkflow {
  id: string;
  user: string;
  currentStage: string;
  status: string;
  started: string;
  elapsedTimeMs: number;
  paymentStatus: string;
  blockchainStatus: string;
  verification: string;
}

export interface AdminWorkflowsResponse {
  items: AdminWorkflow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminHealthV2 {
  backend: string;
  database: string;
  arcBlockchain: string;
  circleGateway: string;
  x402: string;
  openaiGemini: string;
  overallStatus: string;
}

export interface AdminPerformance {
  workflowExecutions: { date: string; value: number }[];
  avgLatency: { date: string; value: number }[];
  workflowDuration: { date: string; value: number }[];
  nodeExecutionTime: { name: string; value: number }[];
  verificationSuccess: { name: string; value: number }[];
  paymentVolume: { date: string; value: number }[];
}

export interface AdminFailure {
  id: string;
  errorMessage: string;
  stage: string;
  retryCount: number;
  durationMs: number;
  timestamp: string;
}

export interface AdminBlockchainV2 {
  id: string;
  receiptId: string;
  onChainId: string | null;
  txHash: string;
  merkleRoot: string | null;
  explorerLink: string;
  confirmationStatus: string;
  timestamp: string;
}

export interface AdminPaymentV2 {
  id: string;
  type: string;
  status: string;
  wallet: string | null;
  amount: number;
  timestamp: string;
}

export interface AdminPaymentsResponse {
  items: AdminPaymentV2[];
  successful: number;
  pending: number;
  failed: number;
}

export interface AdminSecurity {
  failedLogins: number;
  invalidSignatures: number;
  hashMismatches: number;
  verificationFailures: number;
  walletDisconnects: number;
  suspiciousActivity: number;
  items: {
    id: string;
    type: string;
    details: string;
    timestamp: string;
  }[];
}

export interface AdminActivityV2 {
  id: string;
  type: string;
  details: string;
  timestamp: string;
}

class AdminService {
  async getOverview() {
    const res = await apiClient.get<AdminOverview>('/admin/overview');
    return res.data;
  }
  async getWorkflows(params: { page: number; limit: number; search?: string; status?: string }) {
    const res = await apiClient.get<AdminWorkflowsResponse>('/admin/workflows', { params });
    return res.data;
  }
  async getHealth() {
    const res = await apiClient.get<AdminHealthV2>('/admin/health');
    return res.data;
  }
  async getPerformance() {
    const res = await apiClient.get<AdminPerformance>('/admin/performance');
    return res.data;
  }
  async getFailures() {
    const res = await apiClient.get<AdminFailure[]>('/admin/failures');
    return res.data;
  }
  async getBlockchain() {
    const res = await apiClient.get<AdminBlockchainV2[]>('/admin/blockchain');
    return res.data;
  }
  async getPayments() {
    const res = await apiClient.get<AdminPaymentsResponse>('/admin/payments');
    return res.data;
  }
  async getSecurity() {
    const res = await apiClient.get<AdminSecurity>('/admin/security');
    return res.data;
  }
  async getActivity() {
    const res = await apiClient.get<AdminActivityV2[]>('/admin/activity');
    return res.data;
  }
}

export const adminService = new AdminService();
