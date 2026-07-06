// frontend/components/admin/phase28/failure-monitor.tsx
'use client';

import { useAdminFailures } from '@/lib/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertOctagon, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function FailureMonitor() {
  const { data, isLoading, isError } = useAdminFailures();

  if (isLoading || !data) {
    return <Skeleton className="w-full h-80 rounded-2xl" />;
  }

  if (isError) {
    return <div className="text-destructive text-sm p-4">Failed to load failure monitor.</div>;
  }

  return (
    <div className="glass-strong rounded-2xl border border-border/60 flex flex-col h-[400px]">
      <div className="p-4 border-b border-border/40 shrink-0 flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2 text-destructive">
          <AlertOctagon className="size-4" /> Failure Monitor
        </h3>
        <span className="text-xs font-mono text-muted-foreground">{data.length} failed workflows</span>
      </div>
      
      <div className="overflow-auto flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workflow ID</TableHead>
              <TableHead>Error Message</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Retries</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead>Time</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-mono text-[10px]">{f.id.slice(0, 8)}…</TableCell>
                <TableCell className="text-xs text-destructive max-w-[200px] truncate" title={f.errorMessage}>
                  {f.errorMessage}
                </TableCell>
                <TableCell className="text-[10px] font-mono">{f.stage}</TableCell>
                <TableCell className="text-right text-[10px] font-mono">{f.retryCount}</TableCell>
                <TableCell className="text-right text-[10px] font-mono">{f.durationMs}ms</TableCell>
                <TableCell className="text-[10px] text-muted-foreground">
                  {new Date(f.timestamp).toLocaleTimeString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1">
                    <Eye className="size-3" /> View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No workflow failures recorded.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
