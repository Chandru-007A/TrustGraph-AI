// frontend/components/payments/purchased-nodes.tsx
'use client';

import { usePaymentHistory } from '@/lib/hooks/use-payments';
import type { PaymentHistoryItem } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Blocks, CheckCircle2, PackageOpen } from 'lucide-react';
import Link from 'next/link';

export function PurchasedNodes() {
  const { data, isLoading, isError } = usePaymentHistory({
    page: 1,
    limit: 6,
    status: 'PAID', // Only show purchased nodes
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError || !data || data.items.length === 0) {
    return (
      <div className="p-10 border border-border/40 rounded-xl bg-muted/10 text-center">
        <p className="text-sm text-muted-foreground">No purchased reasoning nodes found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.items.map((item: PaymentHistoryItem) => (
        <div key={item.id} className="glass-strong rounded-xl border border-border/60 p-5 flex flex-col justify-between hover:border-accent/50 transition-colors">
          <div>
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-medium text-foreground">{item.nodeName}</h4>
              <Badge variant="outline" className="rounded-full font-mono text-[10px] bg-green-500/10 text-green-500 border-green-500/30">
                Unlocked
              </Badge>
            </div>
            
            <div className="space-y-1 mb-4">
              <p className="text-[11px] font-mono text-muted-foreground flex items-center justify-between">
                <span>Workflow:</span>
                <span className="text-foreground/80">{item.workflowId.slice(0, 8)}…</span>
              </p>
              <p className="text-[11px] font-mono text-muted-foreground flex items-center justify-between">
                <span>Cost:</span>
                <span className="text-foreground/80">{item.amount.toFixed(2)} USDC</span>
              </p>
              <p className="text-[11px] font-mono text-muted-foreground flex items-center justify-between">
                <span>Purchased:</span>
                <span className="text-foreground/80">{new Date(item.createdAt).toLocaleDateString()}</span>
              </p>
            </div>

            <div className="flex gap-2 mb-4">
              <Badge variant="outline" className="rounded-full text-[9px] gap-1 px-2 py-0.5 border-border/60">
                <CheckCircle2 className="size-2.5 text-green-500" /> Verified
              </Badge>
              <Badge variant="outline" className="rounded-full text-[9px] gap-1 px-2 py-0.5 border-border/60">
                <Blocks className="size-2.5 text-primary" /> Anchored
              </Badge>
            </div>
          </div>
          
          <Button asChild variant="outline" size="sm" className="w-full gap-2 text-xs rounded-full">
            <Link href={`/dashboard/${item.sessionId}/dag`}>
              <PackageOpen className="size-3.5" /> Open Workflow
            </Link>
          </Button>
        </div>
      ))}
    </div>
  );
}
