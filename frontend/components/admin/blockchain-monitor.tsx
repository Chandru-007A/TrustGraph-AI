// frontend/components/admin/blockchain-monitor.tsx
'use client';

import { useAdminBlockchain } from '@/lib/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CopyField } from '@/components/receipts/copy-field';

export function BlockchainMonitor() {
  const { data, isLoading, isError } = useAdminBlockchain();

  if (isLoading || !data) {
    return <Skeleton className="w-full h-64 rounded-2xl" />;
  }

  if (isError) {
    return <div className="text-destructive text-sm p-4">Failed to load blockchain monitor.</div>;
  }

  return (
    <div className="glass-strong rounded-2xl border border-border/60 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Receipt ID</TableHead>
            <TableHead>On-Chain ID</TableHead>
            <TableHead>Tx Hash</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Timestamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((r) => (
            <TableRow key={r.receiptId}>
              <TableCell className="font-mono text-xs">{r.receiptId.slice(0, 12)}…</TableCell>
              <TableCell className="font-mono text-[10px]">
                {r.onChainId ? r.onChainId : 'Pending'}
              </TableCell>
              <TableCell className="w-1/3">
                <CopyField label="Tx Hash" value={r.txHash} truncate />
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={`font-mono text-[9px] rounded-full ${
                  r.confirmationStatus === 'REGISTERED' ? 'text-accent border-accent/30 bg-accent/10' :
                  'text-amber-500 border-amber-500/30 bg-amber-500/10'
                }`}>
                  {r.confirmationStatus}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-[10px] text-muted-foreground">
                {new Date(r.timestamp).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
