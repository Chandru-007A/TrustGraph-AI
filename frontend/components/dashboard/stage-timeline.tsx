// frontend/components/dashboard/stage-timeline.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Vertical progress timeline. Renders one row per workflow node in
// execution order. Each row is a labelled circle on the timeline rail +
// a card with the stage's runtime metadata.
//
// Visual states:
//   • completed  — emerald dot, completed label badge
//   • running    — animated amber dot, spinner badge
//   • failed     — red dot, destructive border, error message visible
//   • waiting    — muted dot, waiting badge
//
// "Running" animates via Tailwind's `animate-pulse`; no JS timers.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import type { WorkflowNode } from '@/lib/api/workflow.types';
import {
  deriveDisplayStatus,
  formatClock,
  formatDuration,
  getDisplayLabel,
  type DisplayStatus,
} from '@/lib/workflow/stages';
import { cn } from '@/lib/utils';

interface StageTimelineProps {
  nodes: WorkflowNode[];
}

const STATUS_META: Record<
  DisplayStatus,
  { ring: string; dot: string; badge: string; icon: LucideIcon; label: string }
> = {
  waiting: {
    ring: 'border-border/60 bg-card/40',
    dot: 'bg-muted-foreground/40',
    badge: 'border-border/60 text-muted-foreground bg-card/40',
    icon: AlertCircle,
    label: 'Waiting',
  },
  running: {
    ring: 'border-amber-500/40 bg-amber-500/5',
    dot: 'bg-amber-400 animate-pulse',
    badge: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
    icon: Loader2,
    label: 'Running',
  },
  completed: {
    ring: 'border-emerald-500/30 bg-emerald-500/5',
    dot: 'bg-emerald-400',
    badge: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
    icon: CheckCircle2,
    label: 'Completed',
  },
  failed: {
    ring: 'border-destructive/40 bg-destructive/5',
    dot: 'bg-destructive',
    badge: 'border-destructive/40 text-destructive bg-destructive/10',
    icon: AlertCircle,
    label: 'Failed',
  },
};

export function StageTimeline({ nodes }: StageTimelineProps) {
  if (nodes.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
        No stages have been recorded for this session yet.
      </div>
    );
  }

  // Sort defensively — the backend already orders by stepIndex asc, but
  // we never want the timeline out of order regardless of input.
  const ordered = [...nodes].sort((a, b) => a.stepIndex - b.stepIndex);

  return (
    <ol
      role="list"
      className="relative space-y-3 pl-8 sm:pl-10"
      aria-label="Workflow execution timeline"
    >
      {/* Vertical rail */}
      <span
        aria-hidden
        className="absolute left-3 sm:left-4 top-3 bottom-3 w-px bg-gradient-to-b from-border/80 via-border/40 to-transparent"
      />

      {ordered.map((node) => (
        <StageRow key={node.id} node={node} />
      ))}
    </ol>
  );
}

interface StageRowProps {
  node: WorkflowNode;
}

function StageRow({ node }: StageRowProps) {
  const status = deriveDisplayStatus(node);
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const label = getDisplayLabel(node.nodeName);
  const duration = formatDuration(node.startTime, node.endTime);
  const started = formatClock(node.startTime);
  const finished = formatClock(node.endTime);

  return (
    <li className="relative">
      {/* Dot on the rail */}
      <span
        aria-hidden
        className={cn(
          'absolute -left-[26px] sm:-left-[34px] top-4 size-4 rounded-full ring-2 ring-background',
          meta.dot,
        )}
      />

      <div
        className={cn(
          'rounded-2xl border p-4 sm:p-5 transition-colors',
          meta.ring,
        )}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                'flex items-center justify-center size-8 rounded-lg border',
                meta.badge,
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4',
                  status === 'running' ? 'animate-spin' : undefined,
                )}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span className="font-mono text-[10px] text-muted-foreground">
                  Step {String(node.stepIndex + 1).padStart(2, '0')}
                </span>
                <span aria-hidden className="text-muted-foreground/40">·</span>
                <span className="truncate">{label}</span>
              </div>
              <div
                className={cn(
                  'mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide',
                  meta.badge.split(' ').find((c) => c.startsWith('text-')) ?? 'text-muted-foreground',
                )}
              >
                {meta.label}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Duration
            </div>
            <div className="text-sm font-mono text-foreground/90">
              {duration ?? '—'}
            </div>
          </div>
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 text-xs">
          <Field label="Started" value={started ?? '—'} />
          <Field label="Finished" value={finished ?? '—'} />
          <Field
            label="Retry count"
            value={
              typeof node.retryCount === 'number'
                ? String(node.retryCount)
                : '—'
            }
          />
          <Field label="Current status" value={node.status} />
        </dl>

        {status === 'failed' && node.error ? (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <div className="font-mono uppercase tracking-wide text-[10px] mb-1">
              Failure reason
            </div>
            <div className="text-destructive/90 leading-relaxed">
              {node.error}
            </div>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <dt className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
        {label}
      </dt>
      <dd
        className="font-mono text-foreground/80 truncate text-right"
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
