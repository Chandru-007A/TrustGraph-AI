// frontend/components/verification/root-comparison.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 24 — Computed vs Stored Merkle Root comparison.
// Green if identical, red if different.
// ─────────────────────────────────────────────────────────────────────────────

import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RootComparisonProps {
  computedRoot: string | null | undefined;
  storedRoot: string | null | undefined;
  className?: string;
}

export function RootComparison({
  computedRoot,
  storedRoot,
  className,
}: RootComparisonProps) {
  const bothPresent = !!(computedRoot && storedRoot);
  const match = bothPresent && computedRoot === storedRoot;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid sm:grid-cols-2 gap-3">
        <RootField label="Computed Root" value={computedRoot} />
        <RootField label="Stored Root" value={storedRoot} />
      </div>

      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-xl border transition-all',
          !bothPresent
            ? 'border-border/40 bg-muted/20'
            : match
              ? 'border-primary/40 bg-primary/5'
              : 'border-destructive/40 bg-destructive/5',
        )}
      >
        {bothPresent && match && (
          <CheckCircle2 className="size-5 text-primary shrink-0" />
        )}
        {bothPresent && !match && (
          <XCircle className="size-5 text-destructive shrink-0" />
        )}
        <p
          className={cn(
            'text-sm font-semibold',
            !bothPresent
              ? 'text-muted-foreground'
              : match
                ? 'text-primary'
                : 'text-destructive',
          )}
        >
          {!bothPresent
            ? 'Awaiting root data…'
            : match
              ? '✓ Roots are identical — Merkle tree is intact'
              : '✗ Root mismatch — tree may have been tampered'}
        </p>
      </div>
    </div>
  );
}

function RootField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      <div className="px-3 py-2 rounded-lg bg-muted/20 border border-border/40">
        <code className="text-[11px] font-mono text-foreground/80 break-all select-all">
          {value ?? <span className="text-muted-foreground/40 italic">—</span>}
        </code>
      </div>
    </div>
  );
}
