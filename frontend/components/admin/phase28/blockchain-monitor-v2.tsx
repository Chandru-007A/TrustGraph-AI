// frontend/components/admin/phase28/blockchain-monitor-v2.tsx
'use client';

import { useAdminBlockchain } from '@/lib/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CopyField } from '@/components/receipts/copy-field';
import { Blocks, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export function BlockchainMonitorV2() {
  const { data, isLoading, isError } = useAdminBlockchain();

  if (isLoading || !data) {
    return <Skeleton className="w-full h-80 rounded-2xl" />;
  }

  if (isError) {
    return <div className="text-destructive text-sm p-4">Failed to load blockchain monitor.</div>;
  }

  return (
    <div className="glass-strong rounded-2xl border border-border/60 flex flex-col h-[400px]">
      <div className="p-4 border-b border-border/40 shrink-0">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Blocks className="size-4 text-accent" /> Arc Blockchain Transactions
        </h3>
      </div>
      
      <div className="overflow-auto flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt ID</TableHead>
              <TableHead>Merkle Root</TableHead>
              <TableHead>Tx Hash</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Time</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r) => (
              <TableRow key={r.receiptId}>
                <TableCell className="font-mono text-[10px]">{r.receiptId.slice(0, 8)}…</TableCell>
                <TableCell className="font-mono text-[10px] text-muted-foreground">
                  {r.merkleRoot ? `${r.merkleRoot.slice(0, 8)}…` : 'Pending'}
                </TableCell>
                <TableCell className="w-48">
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
                <TableCell className="text-right text-[10px] text-muted-foreground whitespace-nowrap">
                  {new Date(r.timestamp).toLocaleTimeString()}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={r.explorerLink} target="_blank" className="inline-flex items-center text-[10px] text-primary hover:underline gap-1">
                    Explorer <ExternalLink className="size-3" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
