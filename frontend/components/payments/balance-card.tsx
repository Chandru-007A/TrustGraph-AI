// frontend/components/payments/balance-card.tsx
// ----------------------------------------------------------------------------
// Circle Gateway Unified Balance card.
//
// Embedded into <WalletCard> when the user is connected. Shows the
// LIVE/MOCK mode badge, three stat rows (Available / Locked / Spendable
// USDC) with the per-chain breakdown chips, and a manual refresh
// button. The card auto-updates after a successful payment because
// <PaymentModal> calls `useInvalidatePaymentQueries()` on success.
//
// Visual contract matches the rest of the dashboard:
// `glass-strong rounded-2xl p-6 border border-border/60`.
// ----------------------------------------------------------------------------

'use client';

import {
  Coins,
  Loader2,
  Lock as LockIcon,
  RefreshCcw,
  Wallet as WalletIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatUsdc } from '@/lib/api/x402.client';
import { shortNetwork } from '@/lib/web3/chains';
import type {
  GatewayBalanceSnapshot,
  GatewayChainBalance,
} from '@/lib/api';

interface BalanceCardProps {
  snapshot: GatewayBalanceSnapshot | null;
  isLoading: boolean;
  isError: boolean;
  isMock: boolean;
  onRefresh: () => void;
  className?: string;
}

export function BalanceCard({
  snapshot,
  isLoading,
  isError,
  isMock,
  onRefresh,
  className,
}: BalanceCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/50 bg-card/30 p-4 space-y-3',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <Coins className="size-3" />
          Circle Gateway · USDC
        </div>
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn(
              'rounded-full text-[9px] font-mono uppercase tracking-wider px-1.5 py-0',
              isMock
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
            )}
          >
            {isMock ? 'MOCK' : 'LIVE'}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 w-6 rounded-full p-0 text-muted-foreground hover:text-foreground"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Refresh balance"
          >
            {isLoading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCcw className="size-3" />
            )}
          </Button>
        </div>
      </div>

      {isError ? (
        <p className="text-xs text-destructive">
          Couldn't load balance. Try refreshing.
        </p>
      ) : isLoading && !snapshot ? (
        <BalanceSkeleton />
      ) : snapshot ? (
        <BalanceBody snapshot={snapshot} />
      ) : (
        <p className="text-xs text-muted-foreground">No balance available.</p>
      )}
    </div>
  );
}

function BalanceBody({ snapshot }: { snapshot: GatewayBalanceSnapshot }) {
  const total = formatUsdc(
    // totalConfirmed is human-readable (e.g. "1000.000000") — multiply
    // back to atomic so formatUsdc can divide by 1e6 again.
    String(Math.round(Number(snapshot.totalConfirmed) * 1_000_000)),
  );
  const pending = snapshot.totalPending
    ? formatUsdc(String(Math.round(Number(snapshot.totalPending) * 1_000_000)))
    : null;

  // Treat pending + locked as "locked" for display. The backend's
  // pendingBalance is the closest equivalent to "locked" in the
  // Circle Unified Balance world.
  const locked = pending ?? '0';

  return (
    <div className="space-y-2.5">
      <Stat
        icon={<WalletIcon className="size-3" />}
        label="Available"
        value={`${total} USDC`}
        accent="text-emerald-300"
      />
      <Stat
        icon={<LockIcon className="size-3" />}
        label="Locked"
        value={`${locked} USDC`}
        accent="text-amber-300"
      />
      <Stat
        icon={<Coins className="size-3" />}
        label="Spendable"
        value={`${total} USDC`}
        accent="text-accent"
      />
      {snapshot.breakdown.length > 0 ? (
        <div className="pt-1.5 space-y-1.5">
          <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/70">
            Chain breakdown
          </div>
          <div className="flex flex-wrap gap-1.5">
            {snapshot.breakdown.map((b: GatewayChainBalance) => (
              <span
                key={b.chain}
                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] font-mono text-foreground/80"
                title={`${b.chain} · ${b.confirmedBalance} USDC`}
              >
                {shortNetwork(b.chain)} · {b.confirmedBalance}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={cn('text-sm font-mono truncate', accent)} title={value}>
        {value}
      </span>
    </div>
  );
}

function BalanceSkeleton() {
  return (
    <div className="space-y-2.5">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-36" />
    </div>
  );
}
