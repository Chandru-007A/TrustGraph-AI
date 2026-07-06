// frontend/components/admin/workflow-queue.tsx
'use client';

import { useAdminWorkflows } from '@/lib/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function WorkflowQueue() {
  const { data, isLoading, isError } = useAdminWorkflows({ page: 1, limit: 10 });

  if (isLoading || !data) {
    return <Skeleton className="w-full h-64 rounded-2xl" />;
  }

  if (isError) {
    return <div className="text-destructive text-sm p-4">Failed to load workflow queue.</div>;
  }

  return (
    <div className="glass-strong rounded-2xl border border-border/60 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Session ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead className="text-right">Last Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((wf) => (
            <TableRow key={wf.id}>
              <TableCell className="font-mono text-xs">{wf.id.slice(0, 12)}…</TableCell>
              <TableCell>
                <Badge variant="outline" className={`font-mono text-[9px] rounded-full ${
                  wf.status === 'COMPLETED' ? 'text-green-500 border-green-500/30 bg-green-500/10' :
                  wf.status === 'FAILED' ? 'text-destructive border-destructive/30 bg-destructive/10' :
                  'text-primary border-primary/30 bg-primary/10'
                }`}>
                  {wf.status}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">{wf.currentStage}</TableCell>
              <TableCell className="text-right text-[10px] text-muted-foreground">
                {new Date(wf.started).toLocaleTimeString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
