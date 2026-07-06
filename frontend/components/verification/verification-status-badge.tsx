// frontend/components/verification/verification-status-badge.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Status badge for VERIFIED / TAMPERED / INCOMPLETE verification results.
// ─────────────────────────────────────────────────────────────────────────────

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { WorkflowIntegrityReport } from '@/lib/api';

type OverallResult = WorkflowIntegrityReport['overallResult'];

const META: Record<OverallResult, { label: string; className: string }> = {
  VERIFIED: {
    label: 'Verified',
    className: 'border-primary/40 bg-primary/10 text-primary',
  },
  TAMPERED: {
    label: 'Tampered',
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
  INCOMPLETE: {
    label: 'Incomplete',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  },
};

export function VerificationStatusBadge({
  result,
  className,
}: {
  result: OverallResult | string;
  className?: string;
}) {
  const meta = META[result as OverallResult] ?? {
    label: result ?? 'Unknown',
    className: 'border-border/60 bg-card/40 text-muted-foreground',
  };
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full font-mono text-[10px] uppercase tracking-wider',
        meta.className,
        className,
      )}
    >
      {meta.label}
    </Badge>
  );
}

export function IntegrityScore({ score }: { score: number }) {
  const color =
    score >= 90
      ? 'text-primary'
      : score >= 60
        ? 'text-amber-300'
        : 'text-destructive';
  return (
    <span className={cn('font-mono text-sm font-semibold tabular-nums', color)}>
      {score}%
    </span>
  );
}
