// frontend/components/admin/phase28/live-workflow-activity.tsx
'use client';

import { useState } from 'react';
import { useAdminWorkflows } from '@/lib/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LiveWorkflowActivity() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  
  // Basic debounce implementation inline for simplicity
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    // Simple inline debounce
    setTimeout(() => setDebouncedSearch(e.target.value), 500);
  };

  const { data, isLoading, isError } = useAdminWorkflows({ page, limit: 10, search: debouncedSearch });

  return (
    <div className="glass-strong rounded-2xl border border-border/60 flex flex-col h-[500px]">
      <div className="p-4 border-b border-border/40 shrink-0 flex items-center justify-between gap-4">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Activity className="size-4 text-primary" /> Live Workflow Activity
        </h3>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input 
            placeholder="Search ID or User..." 
            className="pl-8 h-8 text-xs bg-muted/50" 
            value={search}
            onChange={handleSearchChange}
          />
        </div>
      </div>
      
      <div className="overflow-auto flex-1">
        {isLoading || !data ? (
          <Skeleton className="w-full h-full rounded-none" />
        ) : isError ? (
          <div className="text-destructive text-sm p-4 text-center">Failed to load workflows.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Current Stage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Elapsed (ms)</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Blockchain</TableHead>
                <TableHead>Verification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((wf) => (
                <TableRow key={wf.id}>
                  <TableCell className="font-mono text-[10px]">{wf.id.slice(0, 8)}…</TableCell>
                  <TableCell className="text-xs">{wf.user}</TableCell>
                  <TableCell className="text-[10px] font-mono">{wf.currentStage}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      'font-mono text-[9px] rounded-full',
                      wf.status === 'COMPLETED' ? 'text-green-500 border-green-500/30 bg-green-500/10' :
                      wf.status === 'FAILED' ? 'text-destructive border-destructive/30 bg-destructive/10' :
                      'text-primary border-primary/30 bg-primary/10'
                    )}>
                      {wf.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[10px]">{wf.elapsedTimeMs}</TableCell>
                  <TableCell className="text-[10px]">{wf.paymentStatus}</TableCell>
                  <TableCell className="text-[10px]">{wf.blockchainStatus}</TableCell>
                  <TableCell className="text-[10px]">{wf.verification}</TableCell>
                </TableRow>
              ))}
              {data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No workflows found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="p-4 border-t border-border/40 shrink-0 flex items-center justify-between text-xs text-muted-foreground">
        <span>Showing page {page} of {data?.totalPages || 1}</span>
        <div className="flex gap-2">
          <Button 
            variant="outline" size="icon" className="h-7 w-7" 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || isLoading}
          >
            <ChevronLeft className="size-3" />
          </Button>
          <Button 
            variant="outline" size="icon" className="h-7 w-7" 
            onClick={() => setPage(p => Math.min(data?.totalPages || 1, p + 1))}
            disabled={page === (data?.totalPages || 1) || isLoading}
          >
            <ChevronRight className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
