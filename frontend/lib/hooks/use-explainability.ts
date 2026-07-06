// frontend/lib/hooks/use-explainability.ts
import { useQuery } from '@tanstack/react-query';
import { explainService } from '../api';

export const explainKeys = {
  all: ['explain'] as const,
  detail: (sessionId: string) => [...explainKeys.all, sessionId] as const,
};

export function useExplainability(sessionId: string) {
  return useQuery({
    queryKey: explainKeys.detail(sessionId),
    queryFn: () => explainService.getReport(sessionId),
    enabled: !!sessionId,
  });
}
