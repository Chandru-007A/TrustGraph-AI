// frontend/components/verification/verification-timeline.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 24 — 7-step verification lifecycle timeline.
// Steps animate in as each one becomes "done".
// ─────────────────────────────────────────────────────────────────────────────

import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VerificationDetail } from '@/lib/api';

interface TimelineStep {
  label: string;
  done: boolean;
  timestamp?: string | null;
}

function buildSteps(detail: VerificationDetail): TimelineStep[] {
  const report = detail.integrityReport as Record<string, unknown> | null;
  return [
    {
      label: 'Workflow Completed',
      done: detail.status === 'COMPLETED',
      timestamp: detail.updatedAt,
    },
    {
      label: 'Hashes Generated',
      done: detail.totalNodes > 0 && detail.completedNodes > 0,
      timestamp: null,
    },
    {
      label: 'Merkle Root Created',
      done: !!detail.merkle,
      timestamp: detail.merkle?.createdAt ?? null,
    },
    {
      label: 'Receipt Published',
      done: !!detail.receipt?.paidAt,
      timestamp: detail.receipt?.paidAt ?? null,
    },
    {
      label: 'Transaction Confirmed',
      done: !!detail.blockchain?.txHash,
      timestamp: detail.blockchain?.anchoredAt ?? null,
    },
    {
      label: 'Proof Verified',
      done:
        !!report &&
        ((report as Record<string, unknown>).overallResult === 'VERIFIED' ||
          (report as Record<string, unknown>).isMerkleRootValid === true),
      timestamp: detail.integrityReport
        ? ((detail.integrityReport as Record<string, unknown>).verificationTime as string ?? null)
        : null,
    },
    {
      label: 'Reasoning Trusted',
      done:
        !!report &&
        (report as Record<string, unknown>).overallResult === 'VERIFIED' &&
        !!detail.blockchain?.txHash,
      timestamp: detail.blockchain?.anchoredAt ?? null,
    },
  ];
}

interface VerificationTimelineProps {
  detail: VerificationDetail;
  className?: string;
}

export function VerificationTimeline({ detail, className }: VerificationTimelineProps) {
  const steps = buildSteps(detail);

  return (
    <div className={cn('relative pl-6', className)}>
      {/* Vertical track */}
      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border/40" />

      <ol className="space-y-4">
        {steps.map((step, i) => (
          <li key={i} className="relative flex items-start gap-3">
            {/* Connector node */}
            <div
              className={cn(
                'absolute -left-6 flex size-5 shrink-0 items-center justify-center rounded-full border transition-all duration-500',
                step.done
                  ? 'border-primary/50 bg-primary/15 text-primary'
                  : 'border-border/50 bg-card/40 text-muted-foreground/40',
              )}
            >
              {step.done ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <Circle className="size-3" />
              )}
            </div>

            {/* Arrow between steps */}
            {i < steps.length - 1 && (
              <div className="absolute -left-4 top-5 text-[8px] text-muted-foreground/30">
                ↓
              </div>
            )}

            <div className="pt-0.5">
              <p
                className={cn(
                  'text-sm font-medium transition-colors',
                  step.done ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </p>
              {step.timestamp && step.done && (
                <p className="mt-0.5 text-[11px] font-mono text-muted-foreground/70">
                  {new Date(step.timestamp).toLocaleString()}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
