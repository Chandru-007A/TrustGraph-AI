// frontend/components/dashboard/dag-node.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Custom React Flow node used by the DAG visualisation — cinematic edition.
//
// Visual contract (preserved from Phase 22):
//   • Stage name  — user-facing display label (Planner, Retriever, …)
//   • Status      — small badge: Waiting / Running / Completed / Failed
//   • Hash        — first 10 chars of the node's anchor hash, monospaced
//   • Duration    — formatted wall-clock duration; "Live" while running
//
// Cinematic additions (Phase 24):
//   • Entry animation — framer-motion spring reveal (opacity + y + scale)
//   • Status-driven ambient glow — running pulses, completed soft-emerald,
//     failed soft-red, waiting is still
//   • Status-driven left stripe — vertical gradient bar with status tint
//   • Progress bar at the bottom — fills while running, snaps at 100% on
//     completion. Streams a faint highlight when active.
//   • Hover lift + tap scale — micro-interactions
//   • Selected ring — primary-tinted 2px ring (driven by `selected` prop)
//
// Memoised so React Flow can skip re-renders when polling returns
// structurally-equal data for unrelated nodes.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Binary,
  Brain,
  Boxes,
  CheckCircle2,
  FileText,
  Hash as HashIcon,
  LayoutDashboard,
  Loader2,
  SearchCode,
  Settings,
  ShieldCheck,
  Timer,
  CircleDashed,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  deriveDisplayStatus,
  formatDuration,
  getDisplayLabel,
  getStageIconKey,
  type DisplayStatus,
  type StageIconKey,
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

// ── Status-driven class maps ─────────────────────────────────────────────
const RING_BY_STATUS: Record<DisplayStatus, string> = {
  waiting: 'border-border/70 bg-card/60',
  running:
    'border-accent/60 bg-accent/5 animate-node-running',
  completed: 'border-emerald-500/40 bg-emerald-500/5 animate-node-completed',
  failed: 'border-destructive/50 bg-destructive/5 animate-node-failed',
};

const STRIPE_BY_STATUS: Record<DisplayStatus, string> = {
  waiting:
    'bg-gradient-to-b from-muted-foreground/40 via-muted-foreground/20 to-transparent',
  running:
    'bg-gradient-to-b from-accent via-accent/60 to-transparent shadow-[0_0_12px_2px_oklch(0.7_0.13_232_/_0.4)]',
  completed:
    'bg-gradient-to-b from-emerald-400 via-emerald-500/60 to-transparent shadow-[0_0_12px_2px_oklch(0.78_0.15_168_/_0.35)]',
  failed:
    'bg-gradient-to-b from-destructive via-destructive/60 to-transparent shadow-[0_0_12px_2px_oklch(0.62_0.2_20_/_0.35)]',
};

const BADGE_BY_STATUS: Record<DisplayStatus, string> = {
  waiting: 'border-border/60 text-muted-foreground bg-card/60',
  running: 'border-accent/40 text-accent bg-accent/10',
  completed: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
  failed: 'border-destructive/40 text-destructive bg-destructive/10',
};

const STATUS_ICON: Record<DisplayStatus, LucideIcon> = {
  waiting: CircleDashed,
  running: Loader2,
  completed: CheckCircle2,
  failed: AlertCircle,
};

const STAGE_ICON: Record<StageIconKey, LucideIcon> = {
  plan: LayoutDashboard,
  research: SearchCode,
  validate: ShieldCheck,
  reason: Brain,
  evidence: FileText,
  hash: Binary,
  blockchain: Boxes,
  completed: CheckCircle2,
  generic: Settings,
};

// ── Component ───────────────────────────────────────────────────────────
function DagNodeImpl({ data, selected }: NodeProps) {
  const node = data as unknown as DagNodeData;
  const status = deriveDisplayStatus(
    node.workflowNode ?? ({ status: node.status } as WorkflowNode),
  );
  const Icon = STATUS_ICON[status];
  const StageIcon = STAGE_ICON[getStageIconKey(node.nodeName)];
  const ringCls = RING_BY_STATUS[status];
  const stripeCls = STRIPE_BY_STATUS[status];
  const badgeCls = BADGE_BY_STATUS[status];

  // Show a status-tinted progress bar at the bottom:
  //   waiting   → 0% grey
  //   running   → indeterminate flow (CSS keyframe) + faint fill 30%
  //   completed → solid 100% green
  //   failed    → solid 100% red
  const progressFill: Record<DisplayStatus, string> = {
    waiting: 'w-0',
    running: 'w-1/3',
    completed: 'w-full',
    failed: 'w-full',
  };
  const progressTint: Record<DisplayStatus, string> = {
    waiting: 'bg-border/40',
    running: 'bg-accent',
    completed: 'bg-emerald-500',
    failed: 'bg-destructive',
  };

  // Subtle per-step stagger so siblings reveal sequentially on first mount.
  // Step index is stable across polls so the stagger fires once.
  const stepIndex = node.workflowNode?.stepIndex ?? 0;
  const entryDelay = useMemo(() => Math.min(stepIndex, 11) * 0.04, [stepIndex]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 280,
        damping: 24,
        delay: entryDelay,
      }}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'group relative w-[264px] rounded-2xl border p-0 overflow-hidden cursor-pointer select-none',
        'backdrop-blur-sm',
        ringCls,
        selected && 'ring-2 ring-primary/70 ring-offset-2 ring-offset-background',
      )}
    >
      {/* Status-driven left stripe */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-0 top-0 h-full w-[3px]',
          stripeCls,
        )}
      />

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

      <div className="p-3">
        {/* Top row — status icon + stage icon + stage name + status badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Status badge (rotates while running) */}
            <div
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-md border',
                badgeCls,
              )}
              aria-label={status}
            >
              {status === 'running' ? (
                <motion.span
                  className="inline-flex"
                  animate={{ rotate: 360 }}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    ease: 'linear',
                  }}
                >
                  <Icon className={cn('size-3.5', 'text-accent')} />
                </motion.span>
              ) : (
                <Icon
                  className={cn('size-3.5', {
                    'text-muted-foreground': status === 'waiting',
                    'text-emerald-400': status === 'completed',
                    'text-destructive': status === 'failed',
                  })}
                />
              )}
            </div>

            <div className="min-w-0">
              <div
                className={cn(
                  'truncate text-sm font-medium text-foreground/90 flex items-center gap-1.5',
                  status === 'running' && 'animate-pulse-node',
                )}
                title={node.displayLabel}
              >
                <StageIcon
                  className={cn(
                    'size-3.5 shrink-0',
                    status === 'completed' && 'text-emerald-400/80',
                    status === 'running' && 'text-accent/80',
                    status === 'failed' && 'text-destructive/80',
                    status === 'waiting' && 'text-muted-foreground/70',
                  )}
                />
                {node.displayLabel}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/80">
                Step {String(stepIndex + 1).padStart(2, '0')}
              </div>
            </div>
          </div>

          <span
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider',
              badgeCls,
            )}
          >
            {status}
          </span>
        </div>

        {/* Hash + duration row */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-md border border-border/50 bg-background/30 px-2 py-1.5 min-w-0">
            <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-muted-foreground/70">
              <HashIcon className="size-2.5" />
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
            <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-muted-foreground/70">
              <Timer className="size-2.5" />
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

      {/* Bottom progress bar */}
      <div className="relative h-1 w-full overflow-hidden bg-border/20">
        <div
          className={cn(
            'h-full transition-all duration-500 ease-out',
            progressFill[status],
            progressTint[status],
          )}
        />
        {status === 'running' ? (
          <div className="absolute inset-y-0 left-0 w-1/3 animate-progress-flow bg-gradient-to-r from-transparent via-accent-foreground/40 to-transparent" />
        ) : null}
      </div>
    </motion.div>
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

// Re-exported for any caller that wants the display label without
// pulling the full lib/workflow/stages import.
export { getDisplayLabel };
