// frontend/components/dashboard/stat-card.tsx
// ─────────────────────────────────────────────────────────────────────────────
// One small glass card that shows a labelled numeric stat. Used 6× on the
// dashboard (Total Workflows, Verified Receipts, Purchased Nodes, etc).
// Shows a <Skeleton> while `loading` is true.
// ─────────────────────────────────────────────────────────────────────────────

import { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  /** Optional small caption shown under the value (e.g. "across 3 sessions"). */
  hint?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, icon, loading, hint, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'glass-strong rounded-2xl p-6 border border-border/60 flex flex-col gap-3',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon ? (
          <span className="text-muted-foreground/80" aria-hidden>
            {icon}
          </span>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className="text-3xl font-display tracking-tight text-foreground">{value}</div>
      )}
      {hint && !loading ? (
        <div className="text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}
