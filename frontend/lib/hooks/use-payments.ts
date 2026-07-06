// frontend/lib/hooks/use-payments.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentCenterService } from '../api';
import type { GetHistoryParams } from '../api';

export const paymentKeys = {
  all: ['payment-center'] as const,
  stats: () => [...paymentKeys.all, 'stats'] as const,
  analytics: () => [...paymentKeys.all, 'analytics'] as const,
  history: (params: GetHistoryParams) => [...paymentKeys.all, 'history', params] as const,
  detail: (id: string) => [...paymentKeys.all, 'detail', id] as const,
};

export function usePaymentStats() {
  return useQuery({
    queryKey: paymentKeys.stats(),
    queryFn: () => paymentCenterService.getStats(),
  });
}

export function usePaymentAnalytics() {
  return useQuery({
    queryKey: paymentKeys.analytics(),
    queryFn: () => paymentCenterService.getAnalytics(),
  });
}

export function usePaymentHistory(params: GetHistoryParams) {
  return useQuery({
    queryKey: paymentKeys.history(params),
    queryFn: () => paymentCenterService.getHistory(params),
  });
}

export function usePayment(paymentReference: string | null) {
  return useQuery({
    queryKey: paymentKeys.detail(paymentReference || ''),
    queryFn: () => paymentCenterService.getDetail(paymentReference!),
    enabled: !!paymentReference,
  });
}
