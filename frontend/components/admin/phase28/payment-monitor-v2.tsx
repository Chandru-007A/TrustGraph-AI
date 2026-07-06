// frontend/components/admin/phase28/payment-monitor-v2.tsx
'use client';

import { useAdminPayments } from '@/lib/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Repeat, ArrowUpRight, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PaymentMonitorV2() {
  const { data, isLoading, isError } = useAdminPayments();

  if (isLoading || !data) {
    return <Skeleton className="w-full h-80 rounded-2xl" />;
  }

  if (isError) {
    return <div className="text-destructive text-sm p-4">Failed to load payment monitor.</div>;
  }

  return (
    <div className="glass-strong rounded-2xl border border-border/60 flex flex-col h-[400px]">
      <div className="p-4 border-b border-border/40 shrink-0 grid grid-cols-3 gap-4 bg-muted/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 text-green-500 rounded-lg">
            <CheckCircle2 className="size-4" />
          </div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase">Successful</p>
            <p className="font-mono">{data.successful}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
            <AlertTriangle className="size-4" />
          </div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase">Pending</p>
            <p className="font-mono">{data.pending}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-destructive/10 text-destructive rounded-lg">
            <XCircle className="size-4" />
          </div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase">Failed</p>
            <p className="font-mono">{data.failed}</p>
          </div>
        </div>
      </div>
      
      <div className="overflow-auto flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Wallet</TableHead>
              <TableHead className="text-right">Amount (USDC)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {p.type === 'Gateway' ? <ArrowUpRight className="size-3 text-primary" /> : <Repeat className="size-3 text-accent" />}
                    {p.type}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-[10px] text-muted-foreground">
                  {p.wallet ? `${p.wallet.slice(0, 6)}…${p.wallet.slice(-4)}` : 'N/A'}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-medium text-foreground">
                  {p.amount.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn(
                    'font-mono text-[9px] rounded-full',
                    (p.status === 'COMPLETED' || p.status === 'PAID') ? 'text-green-500 border-green-500/30 bg-green-500/10' :
                    p.status === 'FAILED' ? 'text-destructive border-destructive/30 bg-destructive/10' :
                    'text-amber-500 border-amber-500/30 bg-amber-500/10'
                  )}>
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-[10px] text-muted-foreground whitespace-nowrap">
                  {new Date(p.timestamp).toLocaleTimeString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
