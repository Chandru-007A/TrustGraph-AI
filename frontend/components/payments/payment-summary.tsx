// frontend/components/payments/payment-summary.tsx
'use client';

import { Activity, CheckCircle2, Clock, XCircle, Package, TrendingUp } from 'lucide-react';
import { usePaymentStats } from '@/lib/hooks/use-payments';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function PaymentSummary() {
  const { data: stats, isLoading, isError } = usePaymentStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="h-28 rounded-xl border border-destructive/30 bg-destructive/5 flex items-center justify-center text-sm text-destructive">
        Failed to load payment statistics.
      </div>
    );
  }

  const cards = [
    {
      label: 'Total USDC Spent',
      value: `${stats.totalSpent.toFixed(2)} USDC`,
      icon: <Activity className="size-4" />,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: "Today's Spending",
      value: `${stats.todaySpent.toFixed(2)} USDC`,
      icon: <TrendingUp className="size-4" />,
      color: 'text-accent',
      bg: 'bg-accent/10',
    },
    {
      label: 'Successful Payments',
      value: stats.successfulCount.toString(),
      icon: <CheckCircle2 className="size-4" />,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Pending Payments',
      value: stats.pendingCount.toString(),
      icon: <Clock className="size-4" />,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Failed Payments',
      value: stats.failedCount.toString(),
      icon: <XCircle className="size-4" />,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
    },
    {
      label: 'Purchased Nodes',
      value: stats.purchasedNodes.toString(),
      icon: <Package className="size-4" />,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card, idx) => (
        <div key={idx} className="glass-strong rounded-xl border border-border/60 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={cn('flex size-8 items-center justify-center rounded-lg', card.bg, card.color)}>
              {card.icon}
            </div>
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {card.label}
            </span>
          </div>
          <p className="text-2xl font-mono text-foreground/90">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
