// frontend/components/admin/payment-monitor.tsx
'use client';

import { useAdminPayments } from '@/lib/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export function PaymentMonitor() {
  const { data, isLoading, isError } = useAdminPayments();

  if (isLoading || !data) {
    return <Skeleton className="w-full h-32 rounded-2xl" />;
  }

  if (isError) {
    return <div className="text-destructive text-sm p-4">Failed to load payment monitor.</div>;
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="glass-strong rounded-xl border border-green-500/20 p-5 flex flex-col justify-between bg-green-500/5">
        <div className="flex items-center gap-2 mb-2 text-green-500">
          <CheckCircle2 className="size-4" />
          <span className="text-xs font-mono uppercase">Successful</span>
        </div>
        <p className="text-3xl font-display">{data.successful}</p>
      </div>
      <div className="glass-strong rounded-xl border border-amber-500/20 p-5 flex flex-col justify-between bg-amber-500/5">
        <div className="flex items-center gap-2 mb-2 text-amber-500">
          <AlertTriangle className="size-4" />
          <span className="text-xs font-mono uppercase">Pending</span>
        </div>
        <p className="text-3xl font-display">{data.pending}</p>
      </div>
      <div className="glass-strong rounded-xl border border-destructive/20 p-5 flex flex-col justify-between bg-destructive/5">
        <div className="flex items-center gap-2 mb-2 text-destructive">
          <XCircle className="size-4" />
          <span className="text-xs font-mono uppercase">Failed</span>
        </div>
        <p className="text-3xl font-display">{data.failed}</p>
      </div>
    </div>
  );
}
