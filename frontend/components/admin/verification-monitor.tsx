// frontend/components/admin/verification-monitor.tsx
'use client';

import { useAdminOverview } from '@/lib/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, XCircle, Clock } from 'lucide-react';

export function VerificationMonitor() {
  const { data, isLoading, isError } = useAdminOverview();

  if (isLoading || !data) {
    return <Skeleton className="w-full h-32 rounded-2xl" />;
  }

  if (isError) {
    return <div className="text-destructive text-sm p-4">Failed to load verification monitor.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="glass-strong rounded-xl border border-border/60 p-5 flex flex-col justify-between">
        <div className="flex items-center gap-2 mb-2 text-green-500">
          <ShieldCheck className="size-4" />
          <span className="text-xs font-mono uppercase">Total Verifications</span>
        </div>
        <p className="text-3xl font-display">{data.verificationRequests}</p>
      </div>

      <div className="glass-strong rounded-xl border border-border/60 p-5 flex flex-col justify-between">
        <div className="flex items-center gap-2 mb-2 text-destructive">
          <XCircle className="size-4" />
          <span className="text-xs font-mono uppercase">Failed Workflows</span>
        </div>
        <p className="text-3xl font-display">{data.failedWorkflows}</p>
      </div>

      <div className="glass-strong rounded-xl border border-border/60 p-5 flex flex-col justify-between">
        <div className="flex items-center gap-2 mb-2 text-primary">
          <Clock className="size-4" />
          <span className="text-xs font-mono uppercase">Avg Time</span>
        </div>
        <p className="text-3xl font-display">
          {(data.averageWorkflowTimeMs / 1000).toFixed(1)}
          <span className="text-sm font-mono text-muted-foreground ml-1">s</span>
        </p>
      </div>
    </div>
  );
}
