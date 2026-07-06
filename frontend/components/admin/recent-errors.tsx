// frontend/components/admin/recent-errors.tsx
'use client';

import { useAdminSecurity } from '@/lib/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, AlertCircle } from 'lucide-react';

export function RecentErrors() {
  const { data, isLoading, isError } = useAdminSecurity();

  if (isLoading || !data) {
    return <Skeleton className="w-full h-80 rounded-2xl" />;
  }

  if (isError) {
    return <div className="text-destructive text-sm p-4">Failed to load recent errors.</div>;
  }

  return (
    <div className="glass-strong rounded-2xl border border-border/60 overflow-hidden h-96 flex flex-col">
      <div className="p-6 border-b border-border/40 shrink-0">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" /> Recent Security Events
        </h3>
      </div>

      <div className="overflow-auto flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item: { id: string; type: string; details: string; timestamp: string }) => (
              <TableRow key={item.id}>
                <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </TableCell>
                <TableCell className="text-xs font-medium">{item.type}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={item.details}>
                  {item.details}
                </TableCell>
              </TableRow>
            ))}
            {data.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No recent errors detected. System is stable.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
