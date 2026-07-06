// frontend/components/payments/payment-history.tsx
// ----------------------------------------------------------------------------
// Full-width dashboard section: the user's full payment-entitlement
// history, rendered as a table.
//
// Cached via React Query (`usePaymentHistory`) and invalidated on
// every successful x402 settlement. Empty state, loading skeleton,
// and per-row explorer links all match the dashboard's
// `glass-strong` shell.
// ----------------------------------------------------------------------------

'use client';

import { useMemo } from 'react';
import {
  CircleDollarSign,
  ExternalLink,
  Hash as HashIcon,
  Loader2,
  Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatUsdc } from '@/lib/api/x402.client';
import { usePaymentHistory } from '@/lib/hooks/use-dashboard';
import type { PaymentEntitlementRow } from '@/lib/api';

interface PaymentHistoryProps {
  className?: string;
}

export function PaymentHistory({ className }: PaymentHistoryProps) {
  const query = usePaymentHistory();
  const rows = query.data ?? [];

  return (
    <section
      className={cn(
        'glass-strong rounded-2xl border border-border/60 overflow-hidden',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent">
            <Receipt className="size-4" />
          </div>
          <div>
            <div className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Payment history
            </div>
            <div className="text-base font-medium text-foreground">
              x402 entitlements
            </div>
          </div>
        </div>
        <Badge
          variant="outline"
          className="rounded-full border-border/60 bg-card/40 font-mono text-[10px] uppercase tracking-wider"
        >
          {query.isLoading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <CircleDollarSign className="size-3" />
          )}
          {query.isLoading ? 'Loading' : `${rows.length} entries`}
        </Badge>
      </header>

      {query.isLoading ? (
        <PaymentHistorySkeleton />
      ) : query.isError ? (
        <div className="px-6 py-10 text-sm text-destructive">
          Couldn't load payment history. Try refreshing.
        </div>
      ) : rows.length === 0 ? (
        <PaymentHistoryEmpty />
      ) : (
        <PaymentHistoryTable rows={rows} />
      )}
    </section>
  );
}

function PaymentHistoryTable({ rows }: { rows: PaymentEntitlementRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Workflow</TableHead>
          <TableHead>Node</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Tx Hash</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead className="text-right">Explorer</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <PaymentRow key={row.id} row={row} />
        ))}
      </TableBody>
    </Table>
  );
}

function PaymentRow({ row }: { row: PaymentEntitlementRow }) {
  const atomic = useMemo(
    () => String(Math.round(Number(row.amount) * 1_000_000)),
    [row.amount],
  );
  const txHash = row.facilitatorReference ?? '';
  return (
    <TableRow>
      <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
        {new Date(row.createdAt).toLocaleString()}
      </TableCell>
      <TableCell className="text-xs font-mono">
        <span title={row.workflowId} className="block max-w-[160px] truncate">
          {row.workflowId}
        </span>
      </TableCell>
      <TableCell className="text-xs font-mono">
        <span title={row.nodeId} className="block max-w-[160px] truncate">
          {row.nodeId}
        </span>
      </TableCell>
      <TableCell className="text-right text-xs font-mono">
        {formatUsdc(atomic)} {row.currency}
      </TableCell>
      <TableCell>
        <PaymentStatusBadge status={row.paymentStatus} />
      </TableCell>
      <TableCell>
        {txHash ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[10px] font-mono text-foreground/80 hover:text-accent"
            onClick={() => copyToClipboard(txHash, 'Tx hash')}
            title={txHash}
          >
            <HashIcon className="size-2.5" />
            {shortHash(txHash)}
          </button>
        ) : (
          <span className="text-[10px] font-mono text-muted-foreground/60">
            —
          </span>
        )}
      </TableCell>
      <TableCell>
        <button
          type="button"
          className="text-[10px] font-mono text-foreground/80 hover:text-accent"
          onClick={() => copyToClipboard(row.paymentReference, 'Reference')}
          title={row.paymentReference}
        >
          {shortRef(row.paymentReference)}
        </button>
      </TableCell>
      <TableCell className="text-right">
        {txHash ? (
          <a
            href={buildExplorerUrl(row, txHash)}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-[10px] font-mono text-accent hover:underline"
          >
            <ExternalLink className="size-2.5" />
            View
          </a>
        ) : (
          <span className="text-[10px] font-mono text-muted-foreground/60">
            —
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}

function PaymentStatusBadge({
  status,
}: {
  status: PaymentEntitlementRow['paymentStatus'];
}) {
  const meta = STATUS_META[status];
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full font-mono text-[10px] uppercase tracking-wider',
        meta.className,
      )}
    >
      {meta.label}
    </Badge>
  );
}

const STATUS_META: Record<
  PaymentEntitlementRow['paymentStatus'],
  { label: string; className: string }
> = {
  PAID: {
    label: 'Paid',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  },
  PENDING: {
    label: 'Pending',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  },
  UNPAID: {
    label: 'Unpaid',
    className: 'border-border/60 bg-card/40 text-muted-foreground',
  },
  FAILED: {
    label: 'Failed',
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
  EXPIRED: {
    label: 'Expired',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  },
  REFUNDED: {
    label: 'Refunded',
    className: 'border-border/60 bg-card/40 text-muted-foreground',
  },
};

function PaymentHistoryEmpty() {
  return (
    <Empty className="border-0 py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Receipt className="size-5" />
        </EmptyMedia>
        <EmptyTitle>No payments yet</EmptyTitle>
        <EmptyDescription>
          Unlock a reasoning trace or output preview to see your x402
          payment history here.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function PaymentHistorySkeleton() {
  return (
    <div className="space-y-2 px-6 py-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

// ── Small helpers ───────────────────────────────────────────────────────

function shortHash(s: string): string {
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function shortRef(s: string): string {
  if (s.length <= 14) return s;
  return `${s.slice(0, 10)}…${s.slice(-2)}`;
}

function copyToClipboard(value: string, label: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return;
  void navigator.clipboard
    .writeText(value)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error('Copy failed'));
}

function buildExplorerUrl(
  _row: PaymentEntitlementRow,
  txHash: string,
): string {
  // The Circle Gateway / Arc Testnet block explorer. Uses the env
  // var from Phase 21 if set, otherwise the public Arc testnet URL.
  const base =
    process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? 'https://testnet.arcscan.app';
  return `${base.replace(/\/$/, '')}/tx/${txHash}`;
}
