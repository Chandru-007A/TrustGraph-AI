// frontend/components/admin/phase28/platform-overview.tsx
'use client';

import { useAdminOverview } from '@/lib/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Activity, Play, CheckCircle2, XCircle, ShieldCheck, Blocks, Wallet, CreditCard, Clock } from 'lucide-react';

export function PlatformOverview() {
  const { data, isLoading, isError } = useAdminOverview();

  if (isLoading || !data) {
    return <Skeleton className="w-full h-40 rounded-2xl" />;
  }

  if (isError) {
    return <div className="text-destructive text-sm p-4">Failed to load platform overview.</div>;
  }

  const cards = [
    { label: 'Total Users', value: data.totalUsers, icon: <Users className="size-4" /> },
    { label: 'Active Sessions', value: data.activeSessions, icon: <Activity className="size-4" /> },
    { label: 'Running Workflows', value: data.runningWorkflows, icon: <Play className="size-4" /> },
    { label: 'Completed', value: data.completedWorkflows, icon: <CheckCircle2 className="size-4 text-green-500" /> },
    { label: 'Failed', value: data.failedWorkflows, icon: <XCircle className="size-4 text-destructive" /> },
    { label: 'Verification Reqs', value: data.verificationRequests, icon: <ShieldCheck className="size-4" /> },
    { label: 'Blockchain Anchors', value: data.blockchainAnchors, icon: <Blocks className="size-4" /> },
    { label: 'x402 Payments', value: data.x402Payments, icon: <Wallet className="size-4" /> },
    { label: 'Gateway Tx', value: data.gatewayTransactions, icon: <CreditCard className="size-4" /> },
    { label: 'Avg Time (ms)', value: data.averageWorkflowTimeMs.toFixed(0), icon: <Clock className="size-4" /> },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map((card, i) => (
        <div key={i} className="glass-strong rounded-xl border border-border/60 p-4 flex flex-col justify-between hover:border-primary/30 transition-colors">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            {card.icon}
            <span className="text-[10px] font-mono uppercase tracking-wider">{card.label}</span>
          </div>
          <p className="text-2xl font-mono text-foreground">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
