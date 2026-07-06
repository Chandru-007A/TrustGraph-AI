// frontend/components/dashboard/blockchain-status-card.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Small card showing the current Arc L1 mode (connected / mock / disconnected)
// and the number of receipts anchored for the user.
// ─────────────────────────────────────────────────────────────────────────────

import { Boxes, CircleDot } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { BlockchainStatus } from '@/lib/api/workflow.types';
import { cn } from '@/lib/utils';

interface BlockchainStatusCardProps {
  status?: BlockchainStatus;
  anchoredCount?: number;
  loading?: boolean;
  className?: string;
}

const STATUS_COPY: Record<BlockchainStatus, { label: string; description: string; tone: string }> = {
  connected: {
    label: 'Connected',
    description: 'Live Arc L1 — transactions broadcast in real time.',
    tone: 'bg-emerald-400',
  },
  mock: {
    label: 'Mock mode',
    description: 'No RPC configured. Receipts are simulated locally.',
    tone: 'bg-amber-400',
  },
  disconnected: {
    label: 'Disconnected',
    description: 'RPC was configured but the provider failed to initialise.',
    tone: 'bg-destructive',
  },
};

export function BlockchainStatusCard({
  status,
  anchoredCount,
  loading,
  className,
}: BlockchainStatusCardProps) {
  const copy = status ? STATUS_COPY[status] : null;

  return (
    <div className={cn('glass-strong rounded-2xl p-6 border border-border/60', className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-secondary flex items-center justify-center">
            <Boxes className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Blockchain
            </div>
            <div className="text-base font-medium text-foreground">Arc L1</div>
          </div>
        </div>
        {loading || !copy ? (
          <Skeleton className="h-6 w-24" />
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/60 bg-card/40 text-[10px] font-mono uppercase tracking-wider">
            <span className={cn('inline-block w-1.5 h-1.5 rounded-full', copy.tone)} />
            {copy.label}
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Anchored receipts
          </span>
          {loading ? (
            <Skeleton className="h-4 w-12" />
          ) : (
            <span className="text-sm text-foreground/90">{anchoredCount ?? 0}</span>
          )}
        </div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
          <CircleDot className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{copy?.description ?? 'Loading blockchain status…'}</span>
        </div>
      </div>
    </div>
  );
}
