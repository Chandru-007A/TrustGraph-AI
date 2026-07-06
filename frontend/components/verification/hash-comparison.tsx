// frontend/components/verification/hash-comparison.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 24 — Hash Verification panel.
// Shows original, recomputed, and stored hashes with ✔/✖ match indicators.
// ─────────────────────────────────────────────────────────────────────────────

import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodeVerificationResult } from '@/lib/api';

interface HashComparisonProps {
  result: NodeVerificationResult;
  className?: string;
}

export function HashComparison({ result, className }: HashComparisonProps) {
  const match = result.isValid;

  return (
    <div className={cn('space-y-3', className)}>
      <HashRow label="Stored Hash" value={result.expectedHash} />
      <HashRow label="Recomputed Hash" value={result.computedHash} />

      {/* Match indicator */}
      <div
        className={cn(
          'flex items-start gap-3 p-3 rounded-xl border transition-colors',
          match
            ? 'border-primary/30 bg-primary/5'
            : 'border-destructive/30 bg-destructive/5',
        )}
      >
        {match ? (
          <CheckCircle2 className="size-5 text-primary shrink-0 mt-0.5" />
        ) : (
          <XCircle className="size-5 text-destructive shrink-0 mt-0.5" />
        )}
        <div>
          <p
            className={cn(
              'text-sm font-semibold',
              match ? 'text-primary' : 'text-destructive',
            )}
          >
            {match ? '✔ Hash Matches' : '✖ Hash Mismatch'}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Status: <span className="font-mono uppercase">{result.status}</span>
            {result.discrepancy && (
              <> — {result.discrepancy}</>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Verified at:{' '}
            {new Date(result.verifiedAt).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

function HashRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      <div className="px-3 py-2 rounded-lg bg-muted/20 border border-border/40">
        <code className="text-[11px] font-mono text-foreground/80 break-all select-all">
          {value || <span className="text-muted-foreground/50 italic">—</span>}
        </code>
      </div>
    </div>
  );
}
