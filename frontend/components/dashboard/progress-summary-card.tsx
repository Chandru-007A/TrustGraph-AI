// frontend/components/dashboard/progress-summary-card.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Workflow progress summary card.
//
// Renders the four spec items (Workflow ID, Session ID, Overall Status,
// Total Execution Time, Total Nodes Executed) as a grid of stat tiles,
// plus a "View Execution Graph" CTA that appears once the session is
// fully completed. The card itself is a non-interactive summary — the
// vertical timeline (StageTimeline) and the failure panel handle the
// per-stage story.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock, ListTree, Workflow as WorkflowIcon } from 'lucide-react';
import type { WorkflowSessionDetail } from '@/lib/api/workflow.types';
import { computeTotalDuration, countStages } from '@/lib/workflow/stages';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface ProgressSummaryCardProps {
  session: WorkflowSessionDetail;
}

const STATUS_TONE: Record<
  string,
  { dot: string; text: string; ring: string; label: string }
> = {
  PENDING: {
    dot: 'bg-muted-foreground/40',
    text: 'text-muted-foreground',
    ring: 'border-border/60 bg-card/40',
    label: 'Pending',
  },
  RUNNING: {
    dot: 'bg-amber-400 animate-pulse',
    text: 'text-amber-400',
    ring: 'border-amber-500/30 bg-amber-500/5',
    label: 'Running',
  },
  COMPLETED: {
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    ring: 'border-emerald-500/30 bg-emerald-500/5',
    label: 'Completed',
  },
  FAILED: {
    dot: 'bg-destructive',
    text: 'text-destructive',
    ring: 'border-destructive/30 bg-destructive/5',
    label: 'Failed',
  },
  DISPUTED: {
    dot: 'bg-destructive',
    text: 'text-destructive',
    ring: 'border-destructive/30 bg-destructive/5',
    label: 'Disputed',
  },
};

export function ProgressSummaryCard({ session }: ProgressSummaryCardProps) {
  const tone = STATUS_TONE[session.status] ?? STATUS_TONE.PENDING;
  const counts = countStages(session.workflowNodes);
  const isRunning = session.status === 'RUNNING' || session.status === 'PENDING';
  const total = computeTotalDuration(
    session.workflowNodes,
    session.createdAt,
    isRunning,
  );
  const isCompleted = session.status === 'COMPLETED';

  return (
    <div className="glass-strong rounded-2xl p-6 lg:p-8 border border-border/60 space-y-6">
      {/* Top row: status badge + View DAG CTA */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div
          className={cn(
            'inline-flex items-center gap-2.5 rounded-full border px-3 py-1.5 text-xs font-medium',
            tone.ring,
            tone.text,
          )}
        >
          <span className={cn('size-1.5 rounded-full', tone.dot)} />
          {tone.label}
          {isRunning ? <Spinner className="size-3 ml-0.5" /> : null}
        </div>

        {isCompleted ? (
          <Link
            href={`/dashboard/${session.id}/dag`}
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 h-9 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            View Execution Graph
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : null}
      </div>

      {/* Tile grid */}
      <dl className="grid gap-4 sm:grid-cols-2">
        <SummaryTile
          label="Workflow ID"
          icon={<WorkflowIcon className="w-3.5 h-3.5" />}
          value={session.workflowId}
        />
        <SummaryTile
          label="Session ID"
          icon={<ListTree className="w-3.5 h-3.5" />}
          value={session.id}
        />
        <SummaryTile
          label="Total execution time"
          icon={<Clock className="w-3.5 h-3.5" />}
          value={total ?? '—'}
          hint={isRunning ? 'Live' : undefined}
        />
        <SummaryTile
          label="Total nodes executed"
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          value={`${counts.completed} / ${counts.total}`}
          hint={
            counts.failed > 0
              ? `${counts.failed} failed`
              : counts.running > 0
                ? `${counts.running} running`
                : undefined
          }
        />
      </dl>
    </div>
  );
}

interface SummaryTileProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  hint?: string;
}

function SummaryTile({ label, value, icon, hint }: SummaryTileProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3 flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon ? <span className="text-muted-foreground/70">{icon}</span> : null}
      </div>
      <div
        className="text-sm font-mono truncate text-foreground/90"
        title={value}
      >
        {value}
      </div>
      {hint ? (
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}
