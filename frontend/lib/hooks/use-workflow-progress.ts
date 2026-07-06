// frontend/lib/hooks/use-workflow-progress.ts
// ─────────────────────────────────────────────────────────────────────────────
// Live workflow progress hook.
//
// Polls `GET /workflow/sessions/:sessionId` every 2 seconds while the
// session is still running, and stops automatically the moment the
// session reaches a terminal state (COMPLETED / FAILED / DISPUTED).
//
// The poll stops via React Query's `refetchInterval` callback returning
// `false` — that's the documented way to halt polling without touching
// the cache or unmounting the component. If the user hard-refreshes the
// page, the cache is gone but the same `useQuery` re-mounts, runs the
// queryFn once (which is the same call the polling path uses), and the
// refetchInterval callback re-evaluates — so polling "resumes" on the
// very next render after the first data lands.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query';
import { workflowService } from '@/lib/api/workflow.service';
import type { SessionStatus } from '@/lib/api/workflow.types';

export const POLL_INTERVAL_MS = 2_000;

/** Statuses at which polling stops — the workflow can no longer progress. */
export const TERMINAL_STATUSES: SessionStatus[] = [
  'COMPLETED',
  'FAILED',
  'DISPUTED',
];

/** Query key factory — also re-exported so the page can prefetch / invalidate. */
export const workflowProgressKeys = {
  all: ['workflow', 'progress'] as const,
  detail: (sessionId: string) =>
    ['workflow', 'progress', sessionId] as const,
};

export function useWorkflowProgress(sessionId: string | undefined) {
  return useQuery({
    queryKey: workflowProgressKeys.detail(sessionId ?? '__missing__'),
    queryFn: () => {
      if (!sessionId) throw new Error('sessionId is required');
      return workflowService.getSessionDetail(sessionId);
    },
    enabled: !!sessionId,

    // The trick that gives us "stop polling on terminal status": return
    // a number to keep polling, return `false` to halt. We have access
    // to the most recent `data` via the function form.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_STATUSES.includes(status)) return false;
      return POLL_INTERVAL_MS;
    },

    // Keep polling even when the tab is in the background — the user
    // expects the page to be up-to-date when they come back.
    refetchIntervalInBackground: true,

    // Re-fetch on focus so a return from a background tab snaps to fresh.
    refetchOnWindowFocus: true,

    // The data is genuinely live; the QueryClient's 30s default would
    // happily return a stale snapshot.
    staleTime: 1_000,
  });
}
