// frontend/components/dashboard/dag-node.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Custom React Flow node used by the DAG visualisation.
//
// Visual contract (matches the page spec exactly):
//   • Stage name  — user-facing display label (Planner, Retriever, …)
//   • Status      — small badge: Waiting / Running / Completed / Failed
//   • Hash        — first 10 chars of the node's anchor hash, monospaced
//   • Duration    — formatted wall-clock duration; "Live" while running
//
// Color coding:
//   waiting   → muted gray border + dot
//   running   → accent-blue border + pulsing dot
//   completed → emerald border + check
//   failed    → destructive red border + x
//
// Memoised so React Flow can skip re-renders when polling returns
// structurally-equal data for unrelated nodes.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  deriveDisplayStatus,
  formatDuration,
  getDisplayLabel,
  type DisplayStatus,
} from '@/lib/workflow/stages';
import type { NodeStatus, WorkflowNode } from '@/lib/api/workflow.types';

/**
 * The payload React Flow's data slot carries for each node. The canvas
 * layer is responsible for merging the live session detail (status,
 * times, hashes, parents, children) with the graph-json layout
 * (position, label, agentDid) before constructing these props.
 */
export interface DagNodeData {
  /** Display label resolved from the backend `nodeName`. */
  displayLabel: string;
  /** Stage name from the backend, kept so the drawer can show the raw name. */
  nodeName: string;
  /** Latest status — re-evaluated on every poll. */
  status: NodeStatus;
  /** Anchor hash, if any. The component truncates to 10 chars for display. */
  hash: string | null;
  /** Wall-clock duration, or null while the node is QUEUED. */
  durationLabel: string;
  /** True while the node is RUNNING — drives the pulse animation. */
  isRunning: boolean;
  /** Underlying workflow node (kept on data so future drawers can access). */
  workflowNode: WorkflowNode;
}

const STATUS_META: Record<
  DisplayStatus,
  {
    ring: string;
    icon: typeof AlertCircle;
    iconColor: string;
    label: string;
    badge: string;
  }
> = {
  waiting: {
    ring: 'border-border/70 bg-card/60',
    icon: CircleDashed,
    iconColor: 'text-muted-foreground',
    label: 'Waiting',
    badge: 'border-border/60 text-muted-foreground bg-card/60',
  },
  running: {
    ring: 'border-accent/60 bg-accent/5 shadow-[0_0_0_4px_color-mix(in_oklch,var(--accent)_18%,transparent)]',
    icon: Loader2,
    iconColor: 'text-accent',
    label: 'Running',
    badge: 'border-accent/40 text-accent bg-accent/10',
  },
  completed: {
    ring: 'border-emerald-500/40 bg-emerald-500/5',
    icon: CheckCircle2,
    iconColor: 'text-emerald-400',
    label: 'Completed',
    badge: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
  },
  failed: {
    ring: 'border-destructive/50 bg-destructive/5',
    icon: AlertCircle,
    iconColor: 'text-destructive',
    label: 'Failed',
    badge: 'border-destructive/40 text-destructive bg-destructive/10',
  },
};

function DagNodeImpl({ data, selected }: NodeProps) {
  const node = data as unknown as DagNodeData;
  const status = deriveDisplayStatus(
    node.workflowNode ?? ({ status: node.status } as WorkflowNode),
  );
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        'group relative w-[224px] rounded-2xl border p-3 transition-all duration-200',
        'backdrop-blur-sm cursor-pointer select-none',
        meta.ring,
        'hover:-translate-y-0.5 hover:shadow-lg',
        selected && 'ring-2 ring-primary/70 ring-offset-2 ring-offset-background',
      )}
    >
      {/* Source + target handles — invisible but required by React Flow */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !rounded-full !border-0 !bg-border/60"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !rounded-full !border-0 !bg-border/60"
      />

      {/* Top row — status icon + stage name + status badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-md border',
              meta.badge,
            )}
            aria-label={meta.label}
          >
            <Icon
              className={cn(
                'size-3.5',
                meta.iconColor,
                status === 'running' && 'animate-spin',
              )}
            />
          </div>
          <div className="min-w-0">
            <div
              className={cn(
                'truncate text-sm font-medium text-foreground/90',
                status === 'running' && 'animate-pulse-node',
              )}
              title={node.displayLabel}
            >
              {node.displayLabel}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/80">
              Step {String((node.workflowNode?.stepIndex ?? 0) + 1).padStart(2, '0')}
            </div>
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider',
            meta.badge,
          )}
        >
          {meta.label}
        </span>
      </div>

      {/* Hash + duration row */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md border border-border/50 bg-background/30 px-2 py-1.5 min-w-0">
          <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/70">
            Hash
          </div>
          <div
            className="truncate font-mono text-foreground/80"
            title={node.hash ?? 'Not anchored yet'}
          >
            {node.hash ? `${node.hash.slice(0, 10)}…` : '—'}
          </div>
        </div>
        <div className="rounded-md border border-border/50 bg-background/30 px-2 py-1.5 min-w-0">
          <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/70">
            Duration
          </div>
          <div className="truncate font-mono text-foreground/80">
            {node.isRunning ? (
              <span className="inline-flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-accent animate-pulse-node" />
                Live
              </span>
            ) : (
              node.durationLabel ?? '—'
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const DagNode = memo(DagNodeImpl);

/**
 * Helper used by the canvas to format the duration string once per
 * render — kept here so the canvas doesn't need to know the formatter.
 */
export function buildDurationLabel(
  startTime: string | null,
  endTime: string | null,
): string {
  return formatDuration(startTime, endTime) ?? '—';
}

/**
 * Pull the first hash out of the workflow node's `hashes` relation
 * (null if none has been anchored yet).
 */
export function pickAnchorHash(node: WorkflowNode | undefined): string | null {
  if (!node?.hashes || node.hashes.length === 0) return null;
  return node.hashes[0].hashValue;
}
