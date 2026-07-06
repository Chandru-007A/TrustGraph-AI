// frontend/app/dashboard/[sessionId]/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Live workflow progress monitor.
//
// Replaces the old "fetch /blockchain/receipt, render ReceiptCard" flow
// with a full execution view:
//   • Polls GET /workflow/sessions/:sessionId every 2s (via
//     useWorkflowProgress). Stops automatically when the session reaches
//     a terminal status (COMPLETED / FAILED / DISPUTED).
//   • Renders a summary card (Workflow ID, Session ID, overall status,
//     total execution time, total nodes executed).
//   • Renders a vertical timeline of all 11 stages with live status
//     (Waiting / Running / Completed / Failed) and per-stage metadata
//     (started, finished, duration, retry count when available, current
//     status).
//   • Shows the failure reason + retry action when the workflow fails.
//   • Shows a "View Execution Graph" CTA after COMPLETED (links to
//     /dashboard/[sessionId]/dag).
//   • Keeps the original ReceiptCard below so the user can still see
//     the anchored Merkle root / tx hash once it exists.
//
// Auth gate: middleware.ts handles the refresh-cookie check; useAuth()
// confirms the access token is valid on mount.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertOctagon, RefreshCcw } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useWorkflowProgress } from '@/lib/hooks/use-workflow-progress';
import { FailurePanel } from '@/components/dashboard/failure-panel';
import { ProgressSummaryCard } from '@/components/dashboard/progress-summary-card';
import { StageTimeline } from '@/components/dashboard/stage-timeline';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';

export default function WorkflowDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = (params.sessionId as string) ?? '';
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // ── Auth bootstrap guard ────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(`/login?next=/dashboard/${sessionId}`);
    }
  }, [authLoading, isAuthenticated, router, sessionId]);

  // ── Live progress (2s polling, auto-stops on terminal status) ─────
  const {
    data: session,
    isPending,
    isError,
    error,
    refetch,
  } = useWorkflowProgress(sessionId);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay">
      <div className="max-w-5xl mx-auto px-6 lg:px-12 py-10">
        {/* ── Top bar ──────────────────────────────────────────────── */}
        <div className="mb-10 flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            Back to dashboard
          </Link>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href="/dashboard">All sessions</Link>
          </Button>
        </div>

        {/* ── Header ───────────────────────────────────────────────── */}
        <header className="mb-8">
          <p className="text-sm text-muted-foreground font-mono mb-3">
            Workflow progress
          </p>
          <h1 className="text-3xl lg:text-4xl font-display tracking-tight mb-2">
            Live execution monitor
          </h1>
          <p className="text-sm text-muted-foreground">
            Session ID:{' '}
            <code className="text-xs bg-card/60 border border-border/60 px-2 py-1 rounded font-mono">
              {sessionId}
            </code>
          </p>
        </header>

        {/* ── Body ─────────────────────────────────────────────────── */}
        {isPending ? (
          <MonitorSkeleton />
        ) : isError ? (
          <MonitorError
            message={
              (error as { message?: string } | undefined)?.message ??
              'Failed to load workflow session'
            }
            onRetry={() => void refetch()}
          />
        ) : session ? (
          <div className="space-y-8">
            <ProgressSummaryCard session={session} />

            {session.status === 'FAILED' ? (
              <FailurePanel nodes={session.workflowNodes} />
            ) : null}

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-display tracking-tight">
                  Execution timeline
                </h2>
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  {session.workflowNodes.length} stages
                </span>
              </div>
              <StageTimeline nodes={session.workflowNodes} />
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────
function MonitorSkeleton() {
  return (
    <div className="space-y-8" aria-hidden>
      <div className="glass-strong rounded-2xl p-6 lg:p-8 border border-border/60 space-y-6">
        <Skeleton className="h-7 w-32" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
      <div className="space-y-3 pl-10">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-24 w-full rounded-2xl"
            style={{ opacity: 1 - i * 0.12 }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Error ─────────────────────────────────────────────────────────────
function MonitorError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 lg:p-8 space-y-4">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-lg border border-destructive/40 bg-destructive/10 flex items-center justify-center shrink-0">
          <AlertOctagon className="w-4 h-4 text-destructive" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-destructive">
            Could not load workflow session
          </h3>
          <p className="text-xs text-destructive/80 mt-1 leading-relaxed break-words">
            {message}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={onRetry}
      >
        <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
        Try again
      </Button>
    </div>
  );
}
