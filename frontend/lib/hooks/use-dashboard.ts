// frontend/lib/hooks/use-dashboard.ts
// ─────────────────────────────────────────────────────────────────────────────
// React Query hooks for the dashboard. Each query has a stable queryKey so
// invalidation is precise. Mutations invalidate the dependent lists.
// ─────────────────────────────────────────────────────────────────────────────

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import {
  authService,
  gatewayService,
  paymentService,
  receiptService,
  verifyService,
  workflowService,
} from '@/lib/api';
import type { User } from '@/lib/api/types';
import type {
  GatewayBalanceSnapshot,
  PaymentEntitlementRow,
  ReceiptsListParams,
  ReceiptRow,
  ReceiptDetail,
  VerificationListResponse,
  VerificationDetail,
  WorkflowIntegrityReport,
} from '@/lib/api';
import type { WorkflowStats, WorkflowSession } from '@/lib/api/workflow.types';
import { withDerivedStatus, type WorkflowRow } from '@/lib/workflow/status';

export const SESSIONS_LIMIT = 10;

// ── Query keys (single source of truth for invalidation) ────────────────
export const queryKeys = {
  profile: ['profile'] as const,
  stats: ['workflow', 'stats'] as const,
  sessions: (page: number, limit: number) =>
    ['workflow', 'sessions', page, limit] as const,
  /**
   * Single-session cache. Stored under ['workflow', 'session', sessionId]
   * so any component that later subscribes to the same key (the detail
   * page, the receipt card, etc.) gets the data without a refetch.
   */
  session: (sessionId: string) =>
    ['workflow', 'session', sessionId] as const,
  /** Circle Gateway Unified Balance for the connected wallet. */
  gatewayStatus: ['gateway', 'status'] as const,
  unifiedBalance: (walletAddress?: string) =>
    ['gateway', 'balance', walletAddress ?? 'me'] as const,
  /** The user's full payment-entitlement history (newest first). */
  paymentHistory: ['payments', 'history'] as const,
  /** Phase 23: paginated receipt list */
  receipts: (params: ReceiptsListParams) =>
    ['receipts', 'list', params] as const,
  /** Phase 23: single receipt detail */
  receipt: (receiptId: string) =>
    ['receipts', 'detail', receiptId] as const,
  /** Phase 24: paginated verification list */
  verifications: (params: Record<string, unknown>) =>
    ['verifications', 'list', params] as const,
  /** Phase 24: verification detail for a session */
  verification: (sessionId: string) =>
    ['verifications', 'detail', sessionId] as const,
};

// ── Profile ─────────────────────────────────────────────────────────────
export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: async (): Promise<User> => authService.getMe(),
    staleTime: 60_000,
  });
}

// ── Stats ───────────────────────────────────────────────────────────────
export function useWorkflowStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: (): Promise<WorkflowStats> => workflowService.getStats(),
    staleTime: 30_000,
  });
}

// ── Sessions ────────────────────────────────────────────────────────────
export interface UseWorkflowSessionsArgs {
  page: number;
  limit?: number;
  /** Case-insensitive substring matched against the sessionId. */
  search?: string;
  /** Raw SessionStatus to filter on. 'ALL' disables filtering. */
  statusFilter?: 'ALL' | WorkflowSession['status'];
}

export function useWorkflowSessions({
  page,
  limit = SESSIONS_LIMIT,
  search = '',
  statusFilter = 'ALL',
}: UseWorkflowSessionsArgs) {
  const query = useQuery({
    queryKey: queryKeys.sessions(page, limit),
    queryFn: () => workflowService.listSessions({ page, limit }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  // Client-side filter + search, derived from the raw query data.
  const filteredRows = useMemo<WorkflowRow[]>(() => {
    if (!query.data) return [];
    const q = search.trim().toLowerCase();
    return query.data.sessions
      .filter((s: WorkflowSession) => (statusFilter === 'ALL' ? true : s.status === statusFilter))
      .filter((s: WorkflowSession) => (q ? s.sessionId.toLowerCase().includes(q) : true))
      .map(withDerivedStatus);
  }, [query.data, search, statusFilter]);

  const totalMatching = filteredRows.length;
  const total = query.data?.pagination.total ?? 0;
  const totalPages = query.data?.pagination.totalPages ?? 0;

  return {
    ...query,
    rows: filteredRows,
    totalMatching,
    total,
    totalPages,
  };
}

// ── Start workflow ──────────────────────────────────────────────────────
/**
 * Mutation that starts a new workflow via POST /api/v1/workflow/start.
 *
 * Takes a `StartWorkflowRequest` so callers can pass an optional
 * `context` block. The hook keeps a per-session copy of the response in
 * the React Query cache (`['workflow', 'session', sessionId]`) so the
 * detail page can read it instantly without a refetch.
 */
export function useStartWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: import('@/lib/api/workflow.types').StartWorkflowRequest) =>
      workflowService.startWorkflow(payload),
    onSuccess: (data) => {
      // Both the list and the stats need a refresh after a new workflow.
      void qc.invalidateQueries({ queryKey: ['workflow'] });
      // Pre-seed the per-session cache so the detail page can read it
      // immediately on mount without a round-trip.
      if (data?.sessionId) {
        qc.setQueryData(queryKeys.session(data.sessionId), data);
      }
    },
  });
}

// ── Single session (read-through cache) ─────────────────────────────────
/**
 * Reads a previously-started session out of the React Query cache.
 *
 * After `useStartWorkflow` succeeds, the session is `setQueryData`-ed under
 * `['workflow', 'session', sessionId]`. This hook returns whatever is in
 * the cache (which may be `undefined` if the user navigated to a session
 * they didn't start themselves). The detail page does its own fetch for
 * the receipt; this hook is purely an optimistic read-through.
 */
export function useWorkflowSession(sessionId: string | undefined) {
  const qc = useQueryClient();
  return sessionId ? qc.getQueryData(queryKeys.session(sessionId)) : undefined;
}

// ── Circle Gateway Unified Balance ──────────────────────────────────────

/**
 * GET /gateway/status — runtime mode (LIVE | MOCK) + network + operator.
 * Drives the LIVE/MOCK badge on the balance card. Cached for 5 min.
 */
export function useGatewayStatus() {
  return useQuery({
    queryKey: queryKeys.gatewayStatus,
    queryFn: () => gatewayService.getStatus(),
    staleTime: 5 * 60_000,
  });
}

/**
 * GET /gateway/balance — the user's Circle Gateway Unified Balance.
 * The balance is cached briefly (15s) but refetches on window focus so
 * the spendable total stays live during a payment session.
 */
export function useUnifiedBalance(opts?: { walletAddress?: string }) {
  return useQuery<GatewayBalanceSnapshot>({
    queryKey: queryKeys.unifiedBalance(opts?.walletAddress),
    queryFn: () => gatewayService.getBalance({ walletAddress: opts?.walletAddress }),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

// ── Payment history ─────────────────────────────────────────────────────

/**
 * GET /payment/history — full entitlement list, newest first.
 * Cached for 30s and revalidated on invalidate (called from the
 * payment modal after a successful settlement).
 */
export function usePaymentHistory() {
  return useQuery<PaymentEntitlementRow[]>({
    queryKey: queryKeys.paymentHistory,
    queryFn: () => paymentService.getHistory(),
    staleTime: 30_000,
  });
}

/**
 * Helper the payment modal + balance card call after a successful
 * settlement so the balance total + history row refresh on screen.
 * Returns a stable callback so the effect dependency arrays in the
 * modal don't churn.
 */
export function useInvalidatePaymentQueries() {
  const qc = useQueryClient();
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['gateway', 'balance'] });
    void qc.invalidateQueries({ queryKey: ['payments', 'history'] });
  }, [qc]);
}

// ── Phase 23: Receipt Explorer ───────────────────────────────────────────────

/**
 * Paginated receipt list for the authenticated user.
 * Supports search (id, workflowId, txHash, nodeName), status filter, and sort.
 */
export function useReceipts(params: ReceiptsListParams = {}) {
  return useQuery({
    queryKey: queryKeys.receipts(params),
    queryFn: () => receiptService.list(params),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}

/**
 * Full receipt detail including blockchain anchor + activity timeline.
 * Cached for 60 s; the user typically won't re-visit the same receipt
 * within a short session.
 */
export function useReceiptDetail(receiptId: string | undefined) {
  return useQuery<ReceiptDetail>({
    queryKey: queryKeys.receipt(receiptId ?? ''),
    queryFn: () => receiptService.getDetail(receiptId!),
    enabled: !!receiptId,
    staleTime: 60_000,
  });
}

// ── Phase 24: Verification Center ────────────────────────────────────────────

/**
 * Paginated list of all verified workflow sessions.
 */
export function useVerifications(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
} = {}) {
  return useQuery<VerificationListResponse>({
    queryKey: queryKeys.verifications(params as Record<string, unknown>),
    queryFn: () => verifyService.list(params),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}

/**
 * Full verification detail for a workflow session.
 * Cached for 60s — re-run via the "Verify Again" button invalidates the key.
 */
export function useVerificationDetail(sessionId: string | undefined) {
  return useQuery<VerificationDetail>({
    queryKey: queryKeys.verification(sessionId ?? ''),
    queryFn: () => verifyService.getDetail(sessionId!),
    enabled: !!sessionId,
    staleTime: 60_000,
  });
}

/**
 * Mutation: run a live verification of a workflow session.
 * Invalidates the detail cache on success.
 */
export function useVerifyWorkflow(sessionId: string) {
  const qc = useQueryClient();
  return useMutation<WorkflowIntegrityReport, Error, void>({
    mutationFn: () => verifyService.verifyWorkflow(sessionId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.verification(sessionId) });
      void qc.invalidateQueries({ queryKey: ['verifications', 'list'] });
    },
  });
}
