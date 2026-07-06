// frontend/lib/hooks/use-admin.ts
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../api';

export const adminKeys = {
  all: ['admin'] as const,
  overview: () => [...adminKeys.all, 'overview'] as const,
  workflows: (params: any) => [...adminKeys.all, 'workflows', params] as const,
  health: () => [...adminKeys.all, 'health'] as const,
  performance: () => [...adminKeys.all, 'performance'] as const,
  failures: () => [...adminKeys.all, 'failures'] as const,
  blockchain: () => [...adminKeys.all, 'blockchain'] as const,
  payments: () => [...adminKeys.all, 'payments'] as const,
  security: () => [...adminKeys.all, 'security'] as const,
  activity: () => [...adminKeys.all, 'activity'] as const,
};

// Hooks
export const useAdminOverview = () => useQuery({
  queryKey: adminKeys.overview(),
  queryFn: () => adminService.getOverview(),
  refetchInterval: 10000,
});

export const useAdminWorkflows = (params: { page: number; limit: number; search?: string; status?: string }) => useQuery({
  queryKey: adminKeys.workflows(params),
  queryFn: () => adminService.getWorkflows(params),
  refetchInterval: 5000,
});

export const useAdminHealth = () => useQuery({
  queryKey: adminKeys.health(),
  queryFn: () => adminService.getHealth(),
  refetchInterval: 10000,
});

export const useAdminPerformance = () => useQuery({
  queryKey: adminKeys.performance(),
  queryFn: () => adminService.getPerformance(),
});

export const useAdminFailures = () => useQuery({
  queryKey: adminKeys.failures(),
  queryFn: () => adminService.getFailures(),
  refetchInterval: 10000,
});

export const useAdminBlockchain = () => useQuery({
  queryKey: adminKeys.blockchain(),
  queryFn: () => adminService.getBlockchain(),
  refetchInterval: 5000,
});

export const useAdminPayments = () => useQuery({
  queryKey: adminKeys.payments(),
  queryFn: () => adminService.getPayments(),
  refetchInterval: 10000,
});

export const useAdminSecurity = () => useQuery({
  queryKey: adminKeys.security(),
  queryFn: () => adminService.getSecurity(),
  refetchInterval: 10000,
});

export const useAdminActivity = () => useQuery({
  queryKey: adminKeys.activity(),
  queryFn: () => adminService.getActivity(),
  refetchInterval: 5000,
});
