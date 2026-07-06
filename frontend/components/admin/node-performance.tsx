// frontend/components/admin/node-performance.tsx
'use client';

import { useAdminPerformance } from '@/lib/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Cpu } from 'lucide-react';

export function NodePerformance() {
  const { data, isLoading, isError } = useAdminPerformance();

  if (isLoading || !data) {
    return <Skeleton className="w-full h-80 rounded-2xl" />;
  }

  if (isError) {
    return <div className="text-destructive text-sm p-4">Failed to load node performance.</div>;
  }

  return (
    <div className="glass-strong rounded-2xl border border-border/60 overflow-hidden h-96 flex flex-col">
      <div className="p-6 border-b border-border/40 shrink-0">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Cpu className="size-4 text-primary" /> Node Agent Performance
        </h3>
      </div>

      <div className="overflow-auto flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent Name</TableHead>
              <TableHead className="text-right">Avg Duration (ms)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.nodeExecutionTime.map((node: { name: string; value: number }) => (
              <TableRow key={node.name}>
                <TableCell className="text-xs font-medium text-primary/80">{node.name}</TableCell>
                <TableCell className="text-xs font-mono text-right">{node.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
